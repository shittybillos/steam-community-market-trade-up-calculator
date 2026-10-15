// Steam Community Market price lookups and trade-up value analysis.
// All amounts are integer minor currency units (for example cents).

export const REQUEST_SPACING_MS = 3000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = 'cs2-tradeup-prices-v1';

export function parsePrice(text) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!/\d/.test(s)) return null;
  const m = s.match(/[.,](\d{1,2})$/);
  const frac = m ? m[1] : '';
  const whole = (m ? s.slice(0, s.length - m[0].length) : s).replace(/[.,]/g, '') || '0';
  if (!/^\d+$/.test(whole)) return null;
  const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

// Steam's CS2 fees are 5% (Steam) + 10% (game), each at least one minor unit.
const fee = s => Math.max(1, Math.floor(s * 0.05)) + Math.max(1, Math.floor(s * 0.1));
export function netProceeds(buyerPays) {
  if (!Number.isFinite(buyerPays) || buyerPays <= 2) return 0;
  let seller = Math.max(0, Math.floor(buyerPays / 1.15) - 2);
  while (seller + 1 + fee(seller + 1) <= buyerPays) seller++;
  while (seller > 0 && seller + fee(seller) > buyerPays) seller--;
  return seller;
}

export const steamCurrency = c => Number.isInteger(c) && c > 0 ? (c >= 2000 ? c - 2000 : c) : 1;

export function marketName(displayName, wearName) {
  return displayName + (wearName ? ` (${wearName})` : '');
}

export function grossValue(entry, basis) {
  const v = basis === 'buy' ? entry?.buy : (entry?.median ?? entry?.lowest);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export const TIERS = [
  {id:0, label:'Deep loss', note:'under 50% of cost', max:0.5, color:'#e5605a'},
  {id:1, label:'Heavy loss', note:'50–80% of cost', max:0.8, color:'#ee8f5f'},
  {id:2, label:'Small loss', note:'80–100% of cost', max:1, color:'#f0c35f'},
  {id:3, label:'Small profit', note:'100–150% of cost', max:1.5, color:'#b8d86b'},
  {id:4, label:'Good profit', note:'150–300% of cost', max:3, color:'#5fd08f'},
  {id:5, label:'Jackpot', note:'over 300% of cost', max:Infinity, color:'#4fc3e8'}
];

export function tierFor(net, cost) {
  const ratio = net / cost;
  if (ratio < 0.5) return 0;
  if (ratio < 0.8) return 1;
  if (ratio <= 1) return 2;
  if (ratio <= 1.5) return 3;
  if (ratio <= 3) return 4;
  return 5;
}

// items: [{probability, entry}] where entry holds median/lowest/buy prices.
export function analyze(items, cost, basis) {
  const rows = items.map(i => {
    const gross = grossValue(i.entry, basis);
    return {...i, gross, net: gross == null ? null : netProceeds(gross)};
  });
  let pricedMass = 0, weighted = 0, winMass = 0;
  const tiers = TIERS.map(t => ({...t, probability: 0}));
  let unknown = 0;
  for (const r of rows) {
    if (r.net == null) { unknown += r.probability; continue; }
    pricedMass += r.probability;
    weighted += r.probability * r.net;
    if (cost > 0) {
      if (r.net > cost) winMass += r.probability;
      tiers[tierFor(r.net, cost)].probability += r.probability;
    }
  }
  const expected = pricedMass > 0 ? weighted / pricedMass : null;
  return {
    rows, tiers, unknown, coverage: pricedMass,
    expected, roi: expected != null && cost > 0 ? (expected - cost) / cost : null,
    chanceOfProfit: cost > 0 && pricedMass > 0 ? winMass : null
  };
}

export const SORTS = {
  chance: (a, b) => b.probability - a.probability,
  'value-desc': (a, b) => (b.net ?? -1) - (a.net ?? -1) || b.probability - a.probability,
  'value-asc': (a, b) => (a.net ?? Infinity) - (b.net ?? Infinity) || b.probability - a.probability,
  'buy-desc': (a, b) => (b.entry?.buy ?? -1) - (a.entry?.buy ?? -1) || b.probability - a.probability,
  name: (a, b) => a.name.localeCompare(b.name)
};

class RateLimited extends Error {}

export function createPriceLoader({fetchFn = (...a) => fetch(...a), sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => Date.now(), spacing = REQUEST_SPACING_MS, store = null} = {}) {
  const prices = new Map();
  const nameIds = new Map();
  try {
    const saved = JSON.parse(store?.getItem(CACHE_KEY) || 'null');
    for (const [k, v] of Object.entries(saved?.prices || {})) prices.set(k, v);
    for (const [k, v] of Object.entries(saved?.nameIds || {})) nameIds.set(k, v);
  } catch { /* A corrupt cache is simply ignored. */ }
  const persist = () => {
    try {
      const recent = [...prices].sort((a, b) => b[1].at - a[1].at).slice(0, 300);
      store?.setItem(CACHE_KEY, JSON.stringify({prices: Object.fromEntries(recent), nameIds: Object.fromEntries([...nameIds].slice(-600))}));
    } catch { /* Storage can be full or blocked. */ }
  };
  const key = (name, cur) => `${cur}|${name}`;
  const fresh = e => e && now() - e.at < CACHE_TTL_MS;
  let lastRequest = 0;
  async function get(url, kind, signal) {
    const wait = lastRequest + spacing - now();
    if (wait > 0) await sleep(wait);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    lastRequest = now();
    const res = await fetchFn(url, {credentials: 'same-origin', signal});
    if (res.status === 429) throw new RateLimited('Steam is rate limiting price requests. Wait a few minutes and try again.');
    if (!res.ok) return null;
    return kind === 'text' ? res.text() : res.json();
  }
  async function loadOne(name, cur, signal) {
    const entry = {at: now(), median: null, lowest: null, volume: null, buy: null, sell: null};
    const enc = encodeURIComponent(name);
    const overview = await get(`/market/priceoverview/?appid=730&currency=${cur}&market_hash_name=${enc}`, 'json', signal).catch(e => { if (e instanceof RateLimited || e.name === 'AbortError') throw e; return null; });
    if (overview?.success) {
      entry.median = parsePrice(overview.median_price);
      entry.lowest = parsePrice(overview.lowest_price);
      const volume = Number(String(overview.volume ?? '').replace(/,/g, ''));
      entry.volume = Number.isFinite(volume) ? volume : null;
    }
    let id = nameIds.get(name);
    if (!id) {
      const html = await get(`/market/listings/730/${enc}`, 'text', signal).catch(e => { if (e instanceof RateLimited || e.name === 'AbortError') throw e; return null; });
      id = html?.match(/Market_LoadOrderSpread\(\s*(\d+)\s*\)/)?.[1];
      if (id) nameIds.set(name, id);
    }
    if (id) {
      const histogram = await get(`/market/itemordershistogram?country=US&language=english&currency=${cur}&item_nameid=${id}&two_factor=0`, 'json', signal).catch(e => { if (e instanceof RateLimited || e.name === 'AbortError') throw e; return null; });
      if (histogram?.success) {
        const buy = Number(histogram.highest_buy_order), sell = Number(histogram.lowest_sell_order);
        entry.buy = Number.isFinite(buy) && buy > 0 ? buy : null;
        entry.sell = Number.isFinite(sell) && sell > 0 ? sell : null;
      }
    }
    return entry;
  }
  // Requests run one at a time and are spaced out to stay inside Steam's limits.
  async function load(names, cur, {onUpdate, signal} = {}) {
    let done = 0;
    for (const name of names) {
      if (signal?.aborted) break;
      if (!fresh(prices.get(key(name, cur)))) {
        const entry = await loadOne(name, cur, signal);
        prices.set(key(name, cur), entry);
        persist();
      }
      done++;
      onUpdate?.(name, prices.get(key(name, cur)), done, names.length);
    }
  }
  return {load, get: (name, cur) => prices.get(key(name, cur)), pending: (names, cur) => names.filter(n => !fresh(prices.get(key(n, cur)))).length, RateLimited};
}
