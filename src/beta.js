// Selectors observed in Steam's public Market Beta card/list components on
// 2026-10-14 (B9PZEMjO.js). React props are read; never patched or invoked.
export const betaRows = '.TfblJ5tKSxE-, .tTW8H6l2CzQ-';
export const listingRows = `[id^="listing_"], [data-listingid], [data-listing-id], [data-cs2-tradeup-listing], ${betaRows}`;
export function betaListingFor(element) {
  const key = Object.keys(element).find(k=>k.startsWith('__reactFiber$'));
  let fiber=key && element[key];
  // Choose React's committed tree after cards are reused by filtering/sorting.
  if(fiber?.alternate){let top=fiber;for(let n=0;top.return && n<100;n++)top=top.return;
    if(top.stateNode?.current && top.stateNode.current!==top)fiber=fiber.alternate;
  }
  for(let depth=0;fiber && depth<24;depth++,fiber=fiber.return){
    const listing=fiber.memoizedProps?.listing;
    if(listing && /^\d+$/.test(String(listing.listingid)) && listing.asset?.assetid && listing.description) return listing;
  }
  return null;
}
export function betaRecord(listing,element) {
  const asset=listing.asset,description=listing.description;
  if(Number(asset?.appid ?? description?.appid)!==730 || !/^\d+$/.test(String(asset?.assetid)))return null;
  const tags=description.tags || [],properties=asset.asset_properties || [];
  const property=properties.find(p=>Number(p.propertyid)===2);
  const float=property?.float_value==null ? null : Number(property.float_value);
  const action=[...(description.market_actions || []),...(description.actions || [])].find(a=>a.link?.includes('csgo_econ_action_preview'));
  let inspect=action?.link || '';
  const substitutions={assetid:String(asset.assetid),contextid:String(asset.contextid || ''),listingid:String(listing.listingid),owner_steamid:''};
  inspect=inspect.replace(/%(assetid|contextid|listingid|owner_steamid)%/g,(_,key)=>substitutions[key]);
  inspect=inspect.replace(/%propid:(\d+)%/g,(_,id)=>{const p=properties.find(p=>Number(p.propertyid)===Number(id));return String(p?.string_value ?? p?.int_value ?? p?.float_value ?? '');});
  const price=Number(listing.unPricePerUnit),fee=Number(listing.unFeePerUnit ?? 0);
  const collection=tags.find(t=>t.category==='ItemSet');
  // Pattern Template is an exact integer displayed on English Beta cards.
  // Avoid guessing an undocumented property ID or parsing a rounded float.
  const seeds=[...(element?.textContent || '').matchAll(/Pattern Template\s*:\s*(\d+)/g)];
  const nativeSeed=seeds.length===1 ? Number(seeds[0][1]) : null;
  return {adapter:'steam-beta',listingId:String(listing.listingid),assetId:String(asset.assetid),name:description.market_hash_name || description.market_name || description.name,
    nativeFloat:float,nativeSeed,inspect,unavailable:Number(asset.amount)===0,
    stattrak:tags.some(t=>t.category==='Quality' && t.internal_name==='strange'),
    souvenir:tags.some(t=>t.category==='Quality' && t.internal_name==='tournament'),
    collectionName:collection?.localized_tag_name,collectionTag:collection?.internal_name,
    priceMinor:Number.isSafeInteger(price) && price>=0 && Number.isSafeInteger(fee) && fee>=0 ? price+fee : null,
    currency:Number.isInteger(Number(listing.eCurrency)) && Number(listing.eCurrency)>0 ? Number(listing.eCurrency) : null,
    priceText:listing.strTotal || ''};
}
