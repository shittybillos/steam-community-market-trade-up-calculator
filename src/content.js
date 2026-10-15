import {calculate,contractSize,decodeInspect,resolveListing,wear} from './core.js';
import css from './panel.css';
import {listingRows,betaRows} from './beta.js';

(async () => {
  if (document.getElementById('cs2-tradeup-bench')) return;
  const catalog = await fetch(chrome.runtime.getURL('catalog.json')).then(r=>r.json());
  const host = document.createElement('div');
  host.id = 'cs2-tradeup-bench';
  host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;color-scheme:dark;';
  const root = host.attachShadow({mode:'open'});
  const style = document.createElement('style'); style.textContent=css; root.append(style);
  const launcher = document.createElement('button'); launcher.className='launcher'; launcher.textContent='◈ Trade-up bench';
  const panel = document.createElement('section'); panel.className='panel'; panel.hidden=true;
  panel.innerHTML = `<header><div><span class="eyebrow">CS2 / COMMUNITY MARKET</span><h1>Trade-up bench</h1></div><button id="close" aria-label="Minimize calculator">×</button></header>
    <nav><button id="contract" class="active">Contract <span id="count">0/10</span></button><button id="browse">Page listings</button></nav>
    <p id="error" role="alert" hidden></p>
    <div id="contractView"><div id="stats"></div><div id="basket"></div><div class="actions"><button id="export">Export JSON</button><button id="clear">Clear basket</button></div><h2>Possible outcomes</h2><p id="resultNote" class="muted"></p><div id="outcomes"></div></div>
    <div id="browseView" hidden><form id="searchForm"><label>Search CS2 market<input id="marketSearch" type="search" placeholder="AK-47 Redline" maxlength="160"></label><button type="submit">Search Steam</button></form><p class="muted">Search opens Steam’s CS2 results. Float filters below apply to loaded individual listings in this panel.</p><label>Filter loaded skins<input id="nameFilter" type="search" placeholder="Name or collection"></label><div class="filters"><label>Min float<input id="min" type="number" min="0" max="1" step="0.001" placeholder="0"></label><label>Max float<input id="max" type="number" min="0" max="1" step="0.001" placeholder="1"></label><label>Sort<select id="sort"><option value="float">Lowest float</option><option value="price">Lowest price</option></select></label></div><button id="scan">Refresh loaded listings</button><p id="scanNote" class="muted"></p><div id="candidates"></div></div>
    <footer>Listing snapshots · 10-skin standard / 5-Covert gold contracts<br>Floats read locally. Prices include Steam’s listing fee when available.</footer>`;
  root.append(panel,launcher); document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  let basket=[], records=new Map(), view='contract', scanning=false, scanTimer;
  let visibleRows=new Map();
  const resolved=new Map();
  const candidateByRow=new WeakMap();
  function open(){panel.hidden=false;launcher.hidden=true;}
  function showError(message){$('error').textContent=message;$('error').hidden=!message;if(message)open();}
  async function command(type,extra={}) {
    try {
      const response=await chrome.runtime.sendMessage({type,...extra});
      if(response.error) throw new Error(response.error);
      basket=response.basket;showError('');render();
    } catch(e){showError(e.message);}
  }
  launcher.onclick=open;
  $('close').onclick=()=>{panel.hidden=true;launcher.hidden=false;};
  function setView(next){view=next;open();$('contractView').hidden=next!=='contract';$('browseView').hidden=next!=='browse';$('contract').classList.toggle('active',next==='contract');$('browse').classList.toggle('active',next==='browse');if(next==='browse')scan();}
  $('contract').onclick=()=>setView('contract');$('browse').onclick=()=>setView('browse');
  $('clear').onclick=()=>command('clear');
  $('scan').onclick=()=>{scan();requestListings();};
  ['min','max','sort','nameFilter'].forEach(id=>$(id).oninput=()=>renderCandidates());
  $('sort').onchange=()=>renderCandidates();
  $('searchForm').onsubmit=e=>{e.preventDefault();const q=$('marketSearch').value.trim();if(q)location.assign(`https://steamcommunity.com/market/search?appid=730&q=${encodeURIComponent(q)}`);};
  function requestListings(){window.postMessage({source:'cs2-tradeup-request-v1'},location.origin);}
  $('export').onclick=()=>{
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),basket},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cs2-tradeup-contract.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function el(tag,text,className){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;}
  function marketLink(name,url){const a=el('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function money(minor,currency){
    const codes={1:'USD',2:'GBP',3:'EUR',4:'CHF',5:'RUB',6:'PLN',7:'BRL',8:'JPY',9:'NOK',10:'IDR',11:'MYR',12:'PHP',13:'SGD',14:'THB',15:'VND',16:'KRW',17:'TRY',18:'UAH',19:'MXN',20:'CAD',21:'AUD',22:'NZD',23:'CNY',24:'INR'};
    const code=codes[currency >= 2000 ? currency-2000 : currency];
    return code ? new Intl.NumberFormat(undefined,{style:'currency',currency:code}).format(minor/100) : `${(minor/100).toFixed(2)} (Steam currency ${currency})`;
  }
  function render(){
    const required=contractSize(basket);
    $('count').textContent=`${basket.length}/${required}`;launcher.textContent=`◈ Trade-up bench · ${basket.length}/${required}`;
    let result;try{result=calculate(basket,catalog);}catch(e){showError(e.message);return;}
    $('stats').replaceChildren();
    const stat=el('div',null,'stats');
    for(const [label,value] of [['INPUT COST',result.total==null?'Unavailable':money(result.total,result.currency)],['ADJUSTED AVG',result.average==null?'—':result.average.toFixed(8)]]){
      const cell=el('div');cell.append(el('small',label),el('strong',value));stat.append(cell);
    }
    $('stats').append(stat);
    $('basket').replaceChildren();
    if(!basket.length)$('basket').append(el('p','Add individual listings to compare a contract. Use 10 skins for a standard trade-up, or 5 Coverts for knives/gloves.','empty'));
    basket.forEach((i,n)=>{
      const card=el('article',null,'card');const content=el('div');
      content.append(marketLink(`${n+1}. ${i.name}`,i.url),el('p',`${i.float.toFixed(10)} · ${wear(i.float)} · Seed ${i.seed ?? '—'}`,'detail'),el('p',`${i.collection.name} · ${i.priceText || (i.priceMinor!=null && i.currency!=null ? money(i.priceMinor,i.currency):'Price unavailable')}`,'muted'),el('p',`Listing ${i.listingId} · captured ${new Date(i.capturedAt).toLocaleString()}`,'micro'));
      const remove=el('button','×');remove.setAttribute('aria-label',`Remove ${i.name}`);remove.onclick=()=>command('remove',{listingId:i.listingId});card.append(content,remove);$('basket').append(card);
    });
    const state=!basket.length?'Outcomes appear after the first skin.':result.complete?`Complete ${result.gold?'gold':'standard'} contract · predicted floats and odds.`:`Preview for the current ${basket.length} inputs. Add ${required-basket.length} more to complete the contract; predictions will change.`;
    $('resultNote').textContent=state+(result.gold?' Gold odds are per finish family. Eligible Doppler gems/phases are listed individually below their finish; individual phase odds are not estimated.':'');
    $('outcomes').replaceChildren();
    result.outcomes.forEach(o=>{
      const prefix=basket[0].stattrak?'StatTrak™ ':'';
      const displayName=o.skin.gold?o.skin.name.replace(/^★ /,`★ ${prefix}`):`${prefix}${o.skin.name}`;
      const name=displayName+(o.wear?` (${o.wear})`:'');
      const card=el('article',null,'outcome'),line=el('div');
      line.append(marketLink(displayName,`https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`),el('b',`${(o.probability*100).toFixed(2)}%`));
      if(o.variants?.length){
        line.lastElementChild.textContent=`${(o.probability*100).toFixed(2)}% combined`;
        card.append(line,el('p','Finish chance covers the eligible outcomes below. Individual phase/gem odds are unavailable.','muted'));
        for(const v of o.variants){
          const variant=el('article',null,'phase-output');variant.dataset.phase=v.phase;variant.dataset.paintIndex=String(v.paintIndex);
          const label=marketLink(`${displayName} — ${v.phase}`,`https://steamcommunity.com/market/listings/730/${encodeURIComponent(displayName+` (${v.wear})`)}`);
          label.title='Steam groups phases in this finish’s market listings.';
          variant.append(label,el('p',`${v.float.toFixed(10)} · ${v.wear}`,'detail'));
          card.append(variant);
        }
      }else card.append(line,el('p',o.float==null?'Vanilla · no exterior':`${o.float.toFixed(10)} · ${o.wear}`,'detail'));
      $('outcomes').append(card);
    });
    renderCandidates();
  }
  function rowFor(id){return visibleRows.get(String(id));}
  function evaluate(record){
    const signature=JSON.stringify(record);
    if(resolved.get(record.listingId)?.signature===signature)return resolved.get(record.listingId).value;
    let value;try{value={record,item:resolveListing(record,catalog)};}catch(e){value={record,error:e.message};}
    resolved.set(record.listingId,{signature,value});return value;
  }
  function evaluated(){
    return [...records.values()].filter(r=>rowFor(r.listingId)).map(evaluate);
  }
  function renderCandidates(){
    const all=evaluated();
    const min=$('min').value===''?0:Number($('min').value),max=$('max').value===''?1:Number($('max').value);
    const query=$('nameFilter').value.trim().toLowerCase();
    if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>1||min>max){$('scanNote').textContent='Enter a float range from 0 to 1, with min no greater than max.';$('candidates').replaceChildren();return;}
    const list=all.filter(x=>x.item && x.item.float>=min && x.item.float<=max && `${x.item.name} ${x.item.collection.name}`.toLowerCase().includes(query));
    list.sort((a,b)=>$('sort').value==='price'?(a.item.priceMinor ?? Infinity)-(b.item.priceMinor ?? Infinity):a.item.float-b.item.float);
    $('candidates').replaceChildren();
    $('scanNote').textContent=all.length?`${list.length} matching / ${all.length} listings detected. ${all.filter(x=>x.error).length} unavailable or ineligible.`:'No individual listings detected. Open a CS2 skin page and wait for listing cards to load, then refresh loaded listings. Search results may show skin groups rather than individual listings.';
    list.forEach(({record,item})=>{
      const card=el('article',null,'card'),content=el('div');content.append(el('b',item.name),el('p',`${item.float.toFixed(10)} · ${item.priceText || (item.priceMinor!=null && item.currency!=null ? money(item.priceMinor,item.currency):'Price unavailable')}`,'detail'));
      const add=el('button',basket.some(i=>i.listingId===item.listingId)?'Added':'+ Add');add.disabled=basket.some(i=>i.listingId===item.listingId);add.onclick=()=>command('add',{record});card.append(content,add);$('candidates').append(card);
    });
    all.filter(x=>x.error).forEach(x=>{const entry=el('p',`${x.record.name || 'Listing'}: ${x.error}`,'muted');$('candidates').append(entry);});
  }
  function scan(){
    if(scanning)return;scanning=true;
    try {
      visibleRows=new Map();
      for(const row of Array.from(document.querySelectorAll(listingRows)).slice(0,200)){
        const id=row.id?.match(/^listing_(\d+)$/)?.[1] || row.dataset.listingid || row.dataset.listingId || row.dataset.cs2TradeupListing;
        if(/^\d+$/.test(id || ''))visibleRows.set(id,row);
      }
      // Prune departed rows so repeated pagination cannot grow scan cost.
      for(const id of records.keys())if(!visibleRows.has(id)){records.delete(id);resolved.delete(id);}
      // An inspect link alone is insufficient: also require a listing ID and asset ID.
      for(const [id,row] of visibleRows){
        if(records.has(id))continue;
        const a=row.querySelector('a[href*="csgo_econ_action_preview"]');if(!a)continue;
        try{const d=decodeInspect(a.href);if(!d.itemid)continue;records.set(id,{listingId:id,assetId:String(d.itemid),inspect:a.href,name:decodeURIComponent(location.pathname.split('/')[4] || ''),priceText:row.querySelector('.market_listing_price_with_fee')?.textContent.trim() || ''});}catch{}
      }
      for(const record of records.values()) {
        const row=rowFor(record.listingId);if(!row)continue;
        record.priceText=row.querySelector('.market_listing_price_with_fee')?.textContent.trim() || record.priceText || '';
        const signature=JSON.stringify(record)+basket.some(i=>i.listingId===record.listingId);
        if(candidateByRow.get(row)===signature && row.querySelector('.cs2-tradeup-row'))continue;
        const candidate=evaluate(record),item=candidate.item;
        const status=item?`Float ${item.float.toFixed(10)} · Seed ${item.seed ?? '—'}`:candidate.error;
        candidateByRow.set(row,signature);
        let block=row.querySelector('.cs2-tradeup-row');
        if(!block){block=document.createElement('div');block.className='cs2-tradeup-row';block.style.cssText='clear:both;padding:8px 12px;background:#16222e;color:#b6d4e6;font:12px/1.5 Arial,sans-serif;display:flex;gap:12px;align-items:center;';row.append(block);}
        if(row.matches(betaRows)){
          // A positioned badge avoids adding a track to Beta's subgrid layout.
          if(getComputedStyle(row).position==='static' || !getComputedStyle(row).position)row.style.position='relative';
          block.style.cssText='position:absolute;top:5px;right:5px;z-index:2;padding:5px;background:#16222ef0;color:#b6d4e6;font:10px/1.4 Arial,sans-serif;display:flex;flex-direction:column;gap:3px;max-width:85%;border-radius:5px;';
        }
        block.replaceChildren();const text=el('span',status);const add=el('button','Add to trade-up');add.style.cssText='padding:5px 10px;background:#85e7c2;color:#10291f;border:0;border-radius:4px;cursor:pointer;';
        const selected=basket.some(i=>i.listingId===record.listingId);if(selected){add.textContent='Added';add.disabled=true;}
        if(!item){add.disabled=true;add.title=status;}
        add.onclick=async e=>{e.preventDefault();e.stopPropagation();await command('add',{record});scan();};
        block.onclick=e=>e.stopPropagation();block.append(text,add);
      }
      if(view==='browse')renderCandidates();
    }finally{scanning=false;}
  }
  window.addEventListener('message',e=>{
    if(e.source!==window || e.origin!==location.origin || e.data?.source!=='cs2-tradeup-listings-v1' || !Array.isArray(e.data.records))return;
    for(const r of e.data.records.slice(0,1000)) if(r && /^\d+$/.test(String(r.listingId)) && typeof r.inspect==='string' && r.inspect.length<=20000) records.set(String(r.listingId),r);
    scan();
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local' && changes.basket){basket=changes.basket.newValue || [];render();scan();}});
  new MutationObserver(changes=>{
    const rows=listingRows;
    // Ignore our own writes and unrelated search/filter/header mutations.
    const relevant=changes.some(c=>{
      const target=c.target.nodeType===1?c.target:c.target.parentElement;
      if(target?.closest?.('.cs2-tradeup-row, #cs2-tradeup-bench'))return false;
      const nodes=[...c.addedNodes,...c.removedNodes];
      if(nodes.length && nodes.every(n=>n.nodeType===1 && n.matches?.('.cs2-tradeup-row, #cs2-tradeup-bench')))return false;
      return !!target?.closest?.(rows) || nodes.some(n=>n.nodeType===1 && (n.matches?.(rows) || n.querySelector?.(rows)));
    });
    if(!relevant || scanTimer)return;
    scanTimer=setTimeout(()=>{scanTimer=null;scan();requestListings();},250);
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
  await command('get');
  scan();requestListings();
})();
