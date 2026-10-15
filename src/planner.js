// "Make My Trade Up": plans the best-odds contract for a target skin and budget.
// Inputs are baseline catalog skins at a planned float, not specific listings.
import {ranks, wear} from './core.js';

export const WEARS = [
  {name: 'Factory New', lo: 0, hi: 0.07},
  {name: 'Minimal Wear', lo: 0.07, hi: 0.15},
  {name: 'Field-Tested', lo: 0.15, hi: 0.38},
  {name: 'Well-Worn', lo: 0.38, hi: 0.45},
  {name: 'Battle-Scarred', lo: 0.45, hi: 1}
];

export const targetSkins = catalog => catalog
  .filter(s => !s.gold && ranks.indexOf(s.rarity) >= 1 && s.min != null && s.max > s.min)
  .sort((a, b) => a.name.localeCompare(b.name));

// Wear tiers the target skin can actually come out as.
export const achievableWears = target => WEARS.filter(w => w.lo < target.max && w.hi > target.min);

// Normalized average float (0-1 across each skin's range) needed to land in the wear.
export function plannedAverage(target, wearName) {
  const w = WEARS.find(x => x.name === wearName);
  if (!w || w.lo >= target.max || w.hi <= target.min) return null;
  const range = target.max - target.min;
  const hi = (Math.min(w.hi, target.max) - target.min) / range;
  const lo = (Math.max(w.lo, target.min) - target.min) / range;
  const a = Math.max(lo, hi - 1e-4);
  return {average: Math.min(1, Math.max(0, a)), low: lo, high: hi};
}

export const marketNameFor = (skin, stattrak, floatValue) =>
  `${stattrak ? 'StatTrak™ ' : ''}${skin.name} (${wear(floatValue)})`;

// Every (collection, input skin) that can feed the target, with the planned input float.
export function candidates(target, stattrak, wearName, catalog) {
  const plan = plannedAverage(target, wearName);
  if (!plan || (stattrak && !target.stattrak)) return null;
  const prev = ranks[ranks.indexOf(target.rarity) - 1];
  const groups = [];
  for (const collection of target.collections) {
    const pool = catalog.filter(s => !s.gold && s.rarity === target.rarity && (!stattrak || s.stattrak) && s.collections.some(c => c.id === collection.id)).length;
    const inputs = catalog
      .filter(s => !s.gold && s.rarity === prev && (!stattrak || s.stattrak) && s.min != null && s.collections.some(c => c.id === collection.id))
      .map(skin => {
        const float = skin.min + plan.average * (skin.max - skin.min);
        return {skin, float, name: marketNameFor(skin, stattrak, float)};
      });
    if (pool && inputs.length) groups.push({collection, pool, inputs});
  }
  return {plan, groups, size: 10};
}

export const priceOf = entry => {
  const v = entry?.lowest ?? entry?.sell ?? entry?.median;
  return Number.isFinite(v) && v > 0 ? v : null;
};

// Picks the contract with the highest odds inside the budget; if nothing fits,
// the cheapest contract that can still produce the target.
export function plan(cand, budgetMinor, lookup) {
  const N = cand.size;
  const options = cand.groups.map(g => {
    let best = null;
    for (const input of g.inputs) {
      const price = priceOf(lookup(input.name));
      if (price != null && (!best || price < best.price)) best = {...input, price};
    }
    return best && {collection: g.collection, pool: g.pool, input: best};
  }).filter(Boolean);
  if (!options.length) return null;

  let bestFit = null, cheapest = null;
  const counts = new Array(options.length).fill(0);
  const consider = () => {
    if (counts.reduce((a, b) => a + b, 0) !== N) return;
    const odds = counts.reduce((s, n, i) => s + n / N / options[i].pool, 0);
    if (odds <= 0) return;
    const cost = counts.reduce((s, n, i) => s + n * options[i].input.price, 0);
    const candidate = {counts: [...counts], odds, cost};
    if (!cheapest || cost < cheapest.cost || (cost === cheapest.cost && odds > cheapest.odds)) cheapest = candidate;
    if (cost <= budgetMinor && (!bestFit || odds > bestFit.odds + 1e-12 || (Math.abs(odds - bestFit.odds) <= 1e-12 && cost < bestFit.cost))) bestFit = candidate;
  };
  const walk = (i, left) => {
    if (i === options.length - 1) { counts[i] = left; consider(); return; }
    for (let n = 0; n <= left; n++) { counts[i] = n; walk(i + 1, left - n); }
  };
  walk(0, N);

  const chosen = bestFit || cheapest;
  if (!chosen) return null;
  return {
    withinBudget: !!bestFit,
    odds: chosen.odds,
    cost: chosen.cost,
    lines: options.map((o, i) => ({...o, count: chosen.counts[i]})).filter(l => l.count > 0)
  };
}
