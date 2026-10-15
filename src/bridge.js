import {betaRows,betaListingFor,betaRecord} from './beta.js';
// Read-only adapters. No Steam APIs, React calls, fetch hooks or purchases.
(() => {
  let last = '';
  function publish() {
    const records = [];
    const listings = window.g_rgListingInfo;
    const assets = window.g_rgAssets;
    for(const row of Array.from(document.querySelectorAll(betaRows)).slice(0,200)){
      const listing=betaListingFor(row),record=listing && betaRecord(listing,row);
      if(!record){row.removeAttribute('data-cs2-tradeup-listing');continue;}
      row.setAttribute('data-cs2-tradeup-listing',record.listingId);
      records.push(record);
    }
    // Steam can retain thousands of old listings after pagination. Read only
    // IDs attached to currently rendered rows, and only when explicitly asked.
    const rows = document.querySelectorAll('[id^="listing_"], [data-listingid], [data-listing-id]');
    if (listings && assets) for (const row of Array.from(rows).slice(0,200)) {
      const id = row.id?.match(/^listing_(\d+)$/)?.[1] || row.dataset.listingid || row.dataset.listingId;
      const listing = listings[id];
      if (!listing) continue;
      const ref = listing.asset;
      if (!ref || Number(ref.appid) !== 730) continue;
      const asset = assets[730]?.[ref.contextid]?.[ref.id];
      if (!asset) continue;
      const action = asset.market_actions?.find(a => a.link?.includes('csgo_econ_action_preview'));
      if (!action) continue;
      const tags = asset.tags || [];
      const collection = tags.find(t => t.category === 'ItemSet');
      const base = listing.converted_price ?? listing.price;
      const fee = listing.converted_fee ?? listing.fee;
      records.push({listingId:id, assetId:String(ref.id), name:asset.market_hash_name,
        inspect:action.link.replaceAll('%listingid%',id).replaceAll('%assetid%',String(ref.id)).replaceAll('%owner_steamid%',String(listing.steamid_lister || '')),
        souvenir:tags.some(t => /souvenir/i.test(t.internal_name || '')),
        collectionName:collection?.localized_tag_name,
        priceMinor: Number.isSafeInteger(base) && Number.isSafeInteger(fee) ? base+fee : null,
        currency: listing.converted_currencyid ?? listing.currencyid});
    }
    const message = JSON.stringify(records);
    if (message !== last) {last=message; window.postMessage({source:'cs2-tradeup-listings-v1',records},location.origin);}
  }
  window.addEventListener('message',e => {if(e.source === window && e.origin === location.origin && e.data?.source === 'cs2-tradeup-request-v1') {last=''; publish();}});
  // No polling, fetching or enumeration of Steam's accumulated listing cache.
})();
