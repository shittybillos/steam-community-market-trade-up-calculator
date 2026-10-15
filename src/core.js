import { decodeLink } from '@csfloat/cs2-inspect-serializer';

export const ranks = ['Consumer Grade', 'Industrial Grade', 'Mil-Spec Grade', 'Restricted', 'Classified', 'Covert'];
export const contractSize=items=>items[0]?.rarity==='Covert'?5:10;
const gloveCovertError='StatTrak Covert skins from glove collections cannot be used in any contract.';
function gloveCovert(skin,st,catalog){
  if(skin?.rarity!=='Covert' || !st || !skin.goldPool)return false;
  if(skin.goldPool.kind==='gloves')return true;
  const ids=new Set(skin.goldPool.outcomeIds);
  const pool=catalog.filter(s=>s.gold && ids.has(s.id));
  return pool.length>0 && pool.every(s=>s.category==='Gloves');
}
export function wear(f) {
  return f < .07 ? 'Factory New' : f < .15 ? 'Minimal Wear' : f < .38 ? 'Field-Tested' : f < .45 ? 'Well-Worn' : 'Battle-Scarred';
}
export function decodeInspect(link) {
  if (typeof link !== 'string' || link.length > 20000) throw new Error('Invalid inspect link.');
  const plain = decodeURIComponent(link);
  if (!/^steam:\/\/rungame\/730\//i.test(plain)) throw new Error('Not a CS2 inspect link.');
  if (/\b[SM]\d+A\d+D\d+$/i.test(plain)) throw new Error('Legacy inspect link: float cannot be decoded locally.');
  const d = decodeLink(plain);
  if (!Number.isFinite(d.paintwear) || d.paintwear < 0 || d.paintwear > 1 || !d.defindex || d.paintindex == null) throw new Error('Inspect link has no valid skin float.');
  return d;
}
export function resolveListing(record, catalog) {
  if (!record || !/^\d+$/.test(String(record.listingId)) || !/^\d+$/.test(String(record.assetId))) throw new Error('Listing identity is missing.');
  if(record.unavailable)throw new Error('This listing is no longer available.');
  let d;
  let nativeSkin;
  if(record.adapter==='steam-beta'){
    if(typeof record.name!=='string' || record.name.length>250)throw new Error('Beta listing name is missing.');
    const name=record.name.replace(/^(?:StatTrak™ |Souvenir )/,'').replace(/ \((?:Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/,'');
    const matches=catalog.filter(s=>!s.gold && s.name===name && ranks.includes(s.rarity));
    if(matches.length!==1)throw new Error('Beta skin could not be uniquely matched to the catalog.');
    nativeSkin=matches[0];
    const f=record.nativeFloat;
    if(typeof f!=='number' || !Number.isFinite(f) || f<0 || f>1){
      d=decodeInspect(record.inspect);
    }else{
      d={defindex:nativeSkin.weaponId,paintindex:nativeSkin.paintIndex,paintwear:f};
      if(Number.isInteger(record.nativeSeed) && record.nativeSeed>=0 && record.nativeSeed<=1000)d.paintseed=record.nativeSeed;
      // Seed and identity can also be decoded when Beta supplies an inspect payload.
      if(record.inspect){let decoded;try{decoded=decodeInspect(record.inspect);}catch{/* Native property is authoritative when inspect decoding is unavailable. */}
        if(decoded){
        if(decoded.defindex!==d.defindex || decoded.paintindex!==d.paintindex || Math.abs(decoded.paintwear-f)>1e-7)throw new Error('Beta float or skin does not match its inspect payload.');
        d=decoded;
      }}
    }
  }else d = decodeInspect(record.inspect);
  if (d.itemid && String(d.itemid) !== String(record.assetId)) throw new Error('Inspect item does not match this listing.');
  if (record.souvenir || d.quality === 12 || /Souvenir/i.test(record.name || '')) throw new Error('Souvenir skins cannot be used in trade-ups.');
  const candidates = catalog.filter(s => !s.gold && s.weaponId === d.defindex && s.paintIndex === d.paintindex && ranks.includes(s.rarity));
  if (candidates.length !== 1) throw new Error('Skin could not be uniquely matched to the catalog.');
  const skin = candidates[0];
  const st = d.quality === 9 || record.stattrak === true || /StatTrak/i.test(record.name || '');
  if (st && !skin.stattrak) throw new Error('Catalog does not support this StatTrak skin.');
  if(skin.rarity==='Covert' && !skin.goldPool)throw new Error('This Covert collection has no mapped knife/glove trade-up pool.');
  if(gloveCovert(skin,st,catalog))throw new Error(gloveCovertError);
  if (d.paintwear < skin.min - 1e-7 || d.paintwear > skin.max + 1e-7) throw new Error('Float is outside the catalog range.');
  const collection = skin.collections.find(c => c.id === record.collectionId || c.name === record.collectionName || c.id === `collection-${record.collectionTag}`) || (skin.collections.length === 1 ? skin.collections[0] : null);
  if (!collection) throw new Error('This listing’s collection is unknown or ambiguous.');
  const item = {
    listingId: String(record.listingId), assetId: String(record.assetId), skinId: skin.id,
    name: `${st ? 'StatTrak™ ' : ''}${skin.name}`, float: d.paintwear, seed: d.paintseed ?? null,
    min: skin.min, max: skin.max, rarity: skin.rarity, stattrak: st, collection,
    inspect: record.inspect, priceMinor: Number.isSafeInteger(record.priceMinor) && record.priceMinor >= 0 ? record.priceMinor : null,
    currency: Number.isInteger(record.currency) ? record.currency : null,
    priceText: typeof record.priceText === 'string' ? record.priceText.slice(0,100) : '',
    url: `https://steamcommunity.com/market/listings/730/${encodeURIComponent(record.name || `${st ? 'StatTrak™ ' : ''}${skin.name} (${wear(d.paintwear)})`)}`,
    capturedAt: new Date().toISOString(),
    floatSource: record.adapter==='steam-beta' && typeof record.nativeFloat==='number' ? 'Steam Beta asset property 2' : 'Inspect payload'
  };
  if (!outcomesFor(item, catalog).length) throw new Error('This collection has no eligible next-rarity output.');
  return item;
}
export function outcomesFor(item, catalog) {
  if(item.rarity==='Covert'){
    const input=catalog.find(s=>s.id===item.skinId && !s.gold);
    if(gloveCovert(input,item.stattrak,catalog))return [];
    const ids=new Set(input?.goldPool?.outcomeIds || []);
    return catalog.filter(s=>s.gold && ids.has(s.id) && (!item.stattrak || s.stattrak));
  }
  const next = ranks[ranks.indexOf(item.rarity) + 1];
  return catalog.filter(s => s.rarity === next && (!item.stattrak || s.stattrak) && s.collections.some(c => c.id === item.collection.id));
}
export function validateBasket(items, catalog) {
  if (!Array.isArray(items)) throw new Error('Invalid basket.');
  if(items.length>contractSize(items))throw new Error(`This contract takes ${contractSize(items)} skins.`);
  const ids = new Set();
  const assets = new Set();
  for (const item of items) {
    if (ids.has(item.listingId)) throw new Error('This listing is already in the basket.');
    ids.add(item.listingId);
    if (assets.has(item.assetId)) throw new Error('This asset is already in the basket under another listing.');
    assets.add(item.assetId);
    const skin = catalog.find(s => s.id === item.skinId);
    if(gloveCovert(skin,item.stattrak,catalog))throw new Error(gloveCovertError);
    if (!skin || skin.gold || !ranks.includes(skin.rarity) || skin.rarity !== item.rarity || skin.min !== item.min || skin.max !== item.max || !Number.isFinite(item.float) || item.float < item.min - 1e-7 || item.float > item.max + 1e-7 || item.max <= item.min || !skin.collections.some(c => c.id === item.collection?.id) || (item.stattrak && !skin.stattrak) || !outcomesFor(item, catalog).length) throw new Error('Basket contains an invalid or unsupported skin.');
    if (items[0].rarity !== item.rarity) throw new Error('All inputs must have the same rarity.');
    if (items[0].stattrak !== item.stattrak) throw new Error('Regular and StatTrak inputs cannot be mixed.');
  }
}
export function calculate(items, catalog) {
  validateBasket(items, catalog);
  if (!items.length) return { complete: false, outcomes: [], average: null, total: null };
  const average = items.reduce((a,i) => a + Math.max(0,Math.min(1,(i.float-i.min)/(i.max-i.min))),0)/items.length;
  const pools = new Map();
  const poolId=i=>i.rarity==='Covert'?catalog.find(s=>s.id===i.skinId).goldPool.id:i.collection.id;
  items.forEach(i => pools.set(poolId(i), (pools.get(poolId(i)) || 0)+1));
  const result = new Map();
  for (const [id,count] of pools) {
    const input=items.find(i=>poolId(i)===id);
    const pool = outcomesFor(input,catalog);
    const allowedVariants=new Set(input.rarity==='Covert'?catalog.find(s=>s.id===input.skinId).goldPool.variantIds || []:[]);
    for (const skin of pool) {
      const probability = count / items.length / pool.length;
      const f = skin.min==null || skin.max==null ? null : average * (skin.max-skin.min)+skin.min;
      const old = result.get(skin.id);
      const variants=new Map((old?.variants || []).map(v=>[v.id,v]));
      for(const v of skin.variants || [])if(allowedVariants.has(v.id)){
        const vf=average*(v.max-v.min)+v.min;
        variants.set(v.id,{...v,float:vf,wear:wear(vf),probability:null});
      }
      const phaseOrder=['Ruby','Sapphire','Black Pearl','Emerald','Phase 1','Phase 2','Phase 3','Phase 4'];
      result.set(skin.id, {skin, probability: probability+(old?.probability || 0), float:f, wear:f==null?null:wear(f),variants:[...variants.values()].sort((a,b)=>phaseOrder.indexOf(a.phase)-phaseOrder.indexOf(b.phase))});
    }
  }
  const currency = items[0].currency;
  const total = currency != null && items.every(i => i.currency === currency && Number.isSafeInteger(i.priceMinor)) ? items.reduce((a,i) => a+i.priceMinor,0) : null;
  return {complete:items.length === contractSize(items),required:contractSize(items),gold:items[0].rarity==='Covert', average, total, currency, outcomes:[...result.values()].sort((a,b)=>b.probability-a.probability || a.skin.name.localeCompare(b.skin.name))};
}
