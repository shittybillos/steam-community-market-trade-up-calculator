import {calculate,contractSize,decodeInspect,resolveListing,wear} from './core.js';
import css from './panel.css';
import {listingRows,betaRows} from './beta.js';
import {analyze,createPriceLoader,marketName,SORTS,steamCurrency,TIERS} from './prices.js';
import {targetSkins,achievableWears,candidates,plan} from './planner.js';

(async () => {
  if (document.getElementById('cs2-tradeup-bench')) return;
  const catalog = await fetch(chrome.runtime.getURL('catalog.json')).then(r=>r.json());
  const host = document.createElement('div');
  host.id = 'cs2-tradeup-bench';
  host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;color-scheme:dark;';
  const root = host.attachShadow({mode:'open'});
  const style = document.createElement('style'); style.textContent=css; root.append(style);
  const launcher = document.createElement('button'); launcher.className='launcher'; launcher.textContent='◈ Trade-up bench';
  launcher.setAttribute('aria-label','Open CS2 trade-up bench');
  const panel = document.createElement('section'); panel.className='panel'; panel.hidden=true;
  panel.innerHTML = `<header><div><span class="eyebrow">CS2 / COMMUNITY MARKET</span><h1>Trade-up bench</h1></div><div class="window-actions"><button id="size" aria-label="Expand calculator" aria-pressed="false" title="Expand to 75% of the screen">⤢</button><button id="close" aria-label="Minimize calculator" title="Minimize">×</button></div></header>
    <nav aria-label="Trade-up bench views"><button id="contract" class="active">Contract <span id="count">0/10</span></button><button id="browse">Page listings</button><button id="plan">Make My Trade Up</button></nav>
    <p id="error" role="alert" hidden></p>
    <div id="contractView"><div class="toolbar"><button id="clear">Clear basket</button><button id="export">Export JSON</button></div><div class="cols"><section class="col"><div id="stats"></div><div id="basket"></div></section><section class="col"><h2>Possible outcomes</h2>
      <div class="out-tools"><button id="loadPrices" title="Fetch Steam Community Market prices for every outcome">Load Steam prices</button><label>Sort<select id="outSort"><option value="chance">Highest chance</option><option value="value-desc">Highest value</option><option value="value-asc">Lowest value</option><option value="buy-desc">Highest buy order</option><option value="name">Name</option></select></label><label>Value basis<select id="basis"><option value="median">Avg market price</option><option value="buy">Highest buy order</option></select></label></div>
      <p id="priceNote" class="muted"></p><div id="roi"></div><div id="pie"></div><p id="resultNote" class="muted"></p><div id="outcomes"></div></section></div></div>
    <div id="browseView" hidden><form id="searchForm"><label>Search CS2 market<input id="marketSearch" type="search" placeholder="AK-47 Redline" maxlength="160"></label><button type="submit">Search Steam</button></form><p class="muted">Search opens Steam’s CS2 results. Float filters below apply to loaded individual listings in this panel.</p><label>Filter loaded skins<input id="nameFilter" type="search" placeholder="Name or collection"></label><div class="filters"><label>Min float<input id="min" type="number" min="0" max="1" step="0.001" placeholder="0"></label><label>Max float<input id="max" type="number" min="0" max="1" step="0.001" placeholder="1"></label><label>Sort<select id="sort"><option value="float">Lowest float</option><option value="price">Lowest price</option></select></label></div><button id="scan">Refresh loaded listings</button><p id="scanNote" class="muted"></p><div id="candidates"></div></div>
    <div id="planView" hidden><p class="muted">Pick the skin you want and a budget. The best-odds contract (10 skins, or 5 Coverts for knife/glove targets) is built from baseline skins at planned floats — you find listings with those floats.</p>
      <label>Find target skin<input id="planSearch" type="search" placeholder="AK-47 Redline" maxlength="80"></label>
      <label>Target skin<select id="planTarget"></select></label>
      <div class="filters"><label>Wanted wear<select id="planWear"></select></label><label>Budget<input id="planBudget" type="number" min="0" step="0.01" value="20"></label><label>Currency<select id="planCurrency"></select></label></div>
      <label class="check"><input id="planST" type="checkbox"> StatTrak™</label>
      <div class="toolbar"><button id="planGo">Build best trade-up</button></div>
      <p id="planNote" class="muted"></p><div id="planResult"></div></div>
    <footer>Listing snapshots · 10-skin standard / 5-Covert gold contracts<br>Floats read locally. Prices include Steam’s listing fee when available.</footer>`;
  root.append(panel,launcher); document.documentElement.append(host);
  const $ = id => root.getElementById(id);
  let basket=[], records=new Map(), view='contract', scanning=false, scanTimer;
  let visibleRows=new Map();
  let lastResult=null,priceAbort=null;
  const prices=createPriceLoader({store:(()=>{try{return localStorage;}catch{return null;}})()});
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
  function setLarge(large){
    panel.classList.toggle('large',large);host.classList.toggle('large',large);
    $('size').textContent=large?'⤡':'⤢';$('size').setAttribute('aria-pressed',String(large));
    $('size').setAttribute('aria-label',large?'Shrink calculator':'Expand calculator');$('size').title=large?'Back to compact size':'Expand to 75% of the screen';
    try{localStorage.setItem('cs2-tradeup-size',large?'large':'compact');}catch{/* Storage can be blocked. */}
  }
  $('size').onclick=()=>setLarge(!panel.classList.contains('large'));
  try{if(localStorage.getItem('cs2-tradeup-size')==='large')setLarge(true);}catch{/* Storage can be blocked. */}
  $('close').onclick=()=>{panel.hidden=true;launcher.hidden=false;};
  function setView(next){view=next;open();$('contractView').hidden=next!=='contract';$('browseView').hidden=next!=='browse';$('planView').hidden=next!=='plan';$('contract').classList.toggle('active',next==='contract');$('browse').classList.toggle('active',next==='browse');$('plan').classList.toggle('active',next==='plan');if(next==='browse')scan();}
  $('contract').onclick=()=>setView('contract');$('browse').onclick=()=>setView('browse');$('plan').onclick=()=>setView('plan');
  const CURRENCIES={1:'USD',2:'GBP',3:'EUR',20:'CAD',21:'AUD',7:'BRL',23:'CNY',17:'TRY',19:'MXN',13:'SGD',24:'INR'};
  for(const [id,code] of Object.entries(CURRENCIES)){const o=el('option',code);o.value=id;$('planCurrency').append(o);}
  const targets=targetSkins(catalog);
  function fillTargets(){
    const q=$('planSearch').value.trim().toLowerCase(),keep=$('planTarget').value;
    $('planTarget').replaceChildren();
    for(const s of targets.filter(s=>!q||s.name.toLowerCase().includes(q)).slice(0,300)){const o=el('option',`${s.name} · ${s.gold?'Gold':s.rarity}`);o.value=s.id;$('planTarget').append(o);}
    if(keep&&[...$('planTarget').options].some(o=>o.value===keep))$('planTarget').value=keep;
    fillWears();
  }
  function fillWears(){
    const s=targets.find(t=>t.id===$('planTarget').value),keep=$('planWear').value;
    $('planWear').replaceChildren();
    for(const w of s?achievableWears(s):[]){const o=el('option',w.name);o.value=w.name;$('planWear').append(o);}
    if(keep&&[...$('planWear').options].some(o=>o.value===keep))$('planWear').value=keep;
    $('planST').disabled=!s?.stattrak;if(!s?.stattrak)$('planST').checked=false;
  }
  $('planSearch').oninput=fillTargets;$('planTarget').onchange=fillWears;
  fillTargets();
  let planAbort=null;
  $('planGo').onclick=async()=>{
    if(planAbort){planAbort.abort();return;}
    const target=targets.find(t=>t.id===$('planTarget').value);if(!target)return;
    const st=$('planST').checked,cur=Number($('planCurrency').value);
    const budget=Math.round(Number($('planBudget').value)*100);
    if(!Number.isFinite(budget)||budget<0){showError('Enter a valid budget.');return;}
    showError('');
    const cand=candidates(target,st,$('planWear').value,catalog);
    if(!cand||!cand.groups.length){$('planResult').replaceChildren(el('p','No trade-up can produce this skin with the chosen options.','empty'));return;}
    const names=[...new Set(cand.groups.flatMap(g=>g.inputs.map(i=>i.name)))];
    const controller=planAbort=new AbortController();$('planGo').textContent='Stop';
    try{
      await prices.load(names,cur,{signal:controller.signal,onUpdate:(n,e,done,total)=>{$('planNote').textContent=`Loading input prices ${done}/${total}…`;}});
      if(controller.signal.aborted)return;
      renderPlan(target,st,cand,plan(cand,budget,n=>prices.get(n,cur)),budget,cur);
    }catch(e){if(e.name!=='AbortError')showError(e.message);}
    finally{planAbort=null;$('planGo').textContent='Build best trade-up';}
  };
  function renderPlan(target,st,cand,result,budget,cur){
    const box=$('planResult');box.replaceChildren();
    if(!result){$('planNote').textContent='';box.append(el('p','No Steam prices were found for the possible input skins, so a plan could not be built.','empty'));return;}
    $('planNote').textContent=`Prices come from the Steam Community Market (lowest listing). Target adjusted average float ≈ ${cand.plan.average.toFixed(4)} or lower.`;
    const stats=el('div',null,'stats three');
    for(const [label,value] of [['CHANCE OF TARGET',`${(result.odds*100).toFixed(2)}%`],['TOTAL COST',money(result.cost,cur)],['BUDGET',money(budget,cur)]]){const c=el('div');c.append(el('small',label),el('strong',value));stats.append(c);}
    box.append(stats,el('p',result.withinBudget?'Highest odds that fit your budget.':`Nothing fits ${money(budget,cur)} — this is the cheapest contract that can still produce the skin.`,result.withinBudget?'muted':'warn'));
    const displayName=`${st?'StatTrak™ ':''}${target.name}`;
    box.append(el('h2',`Inputs for ${displayName} (${$('planWear').value})`));
    for(const l of result.lines){
      const card=el('article',null,'card'),body=el('div');
      body.append(marketLink(`${l.count} × ${l.input.name}`,`https://steamcommunity.com/market/listings/730/${encodeURIComponent(l.input.name)}`),
        el('p',`Find floats ≤ ${l.input.float.toFixed(4)} (valid range ${l.input.skin.min}–${l.input.skin.max}) · ${money(l.input.price,cur)} each`,'detail'),
        el('p',`${l.collection.name} · ${l.pool} possible outcomes in this collection · ${(l.count/cand.size*100/l.pool).toFixed(2)}% from these`,'muted'));
      card.append(thumb(l.input.skin.image,l.input.name),body);box.append(card);
    }
    box.append(el('p','Floats are planned from the average: lower-float inputs can offset higher ones, so any set whose adjusted floats average at or below the target works. Prices are for the planned wear; real listings vary.','micro'));
  }
  $('clear').onclick=()=>command('clear');
  $('outSort').onchange=renderOutcomes;$('basis').onchange=renderOutcomes;
  $('loadPrices').onclick=async()=>{
    if(priceAbort){priceAbort.abort();return;}
    if(!lastResult?.outcomes.length)return;
    const cur=steamCurrency(lastResult.currency);
    const names=[...lastResult.outcomes].sort((a,b)=>b.probability-a.probability).map(o=>outcomeName(o).name);
    const controller=priceAbort=new AbortController();
    $('loadPrices').textContent='Stop loading';
    try{
      await prices.load(names,cur,{signal:controller.signal,onUpdate:(name,entry,done,total)=>{$('priceNote').textContent=`Loading Steam prices ${done}/${total}…`;renderOutcomes();}});
    }catch(e){if(e.name!=='AbortError')showError(e.message);}
    finally{priceAbort=null;$('loadPrices').textContent='Load Steam prices';renderOutcomes();}
  };
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
  function thumb(src,alt){
    const frame=el('div',null,'thumb');
    if(src){const img=document.createElement('img');img.src=src;img.alt=alt;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();frame.append(img);}
    return frame;
  }
  const catalogImage=id=>catalog.find(s=>s.id===id)?.image || null;
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
      const remove=el('button','×');remove.setAttribute('aria-label',`Remove ${i.name}`);remove.onclick=()=>command('remove',{listingId:i.listingId});card.append(thumb(i.image || catalogImage(i.skinId),i.name),content,remove);$('basket').append(card);
    });
    const state=!basket.length?'Outcomes appear after the first skin.':result.complete?`Complete ${result.gold?'gold':'standard'} contract · predicted floats and odds.`:`Preview for the current ${basket.length} inputs. Add ${required-basket.length} more to complete the contract; predictions will change.`;
    $('resultNote').textContent=state+(result.gold?' Gold odds are per finish family. Eligible Doppler gems/phases are listed individually below their finish; individual phase odds are not estimated.':'');
    lastResult=result;renderOutcomes();
    renderCandidates();
  }
  function outcomeName(o){
    const prefix=basket[0]?.stattrak?'StatTrak™ ':'';
    const displayName=o.skin.gold?o.skin.name.replace(/^★ /,`★ ${prefix}`):`${prefix}${o.skin.name}`;
    return {displayName,name:marketName(displayName,o.wear)};
  }
  function pct(n,digits=1){return `${n>=0?'+':''}${(n*100).toFixed(digits)}%`;}
  function renderSummary(a,result,cost,cur){
    const box=$('roi'),pie=$('pie');box.replaceChildren();pie.replaceChildren();
    if(!result.outcomes.length)return;
    if(!result.complete||cost==null){box.append(el('p','Complete the contract to see ROI, chance of profit and the value breakdown.','muted'));return;}
    if(!a.coverage){box.append(el('p','Load Steam prices to see ROI, chance of profit and the value breakdown.','muted'));return;}
    const stats=el('div',null,'stats three');
    const cells=[['EXPECTED ROI',pct(a.roi),a.roi>=0?'good':'bad'],['EXPECTED RETURN',money(Math.round(a.expected),cur),''],['CHANCE OF PROFIT',`${a.coverage<.9995?'≥ ':''}${(a.chanceOfProfit*100).toFixed(1)}%`,a.chanceOfProfit>=.5?'good':'bad']];
    for(const [label,value,tone] of cells){const cell=el('div');if(tone)cell.dataset.tone=tone;cell.append(el('small',label),el('strong',value));stats.append(cell);}
    const covered=`${(a.coverage*100).toFixed(0)}% of outcome odds priced`;
    box.append(stats,el('p',`Net of Steam’s 15% sale fee (5% Steam + 10% CS2) against your ${money(cost,cur)} input cost; ${covered}${a.coverage<.9995?', so ROI assumes unpriced outcomes match the priced average':''}. Rough estimate, not a guarantee.`,'micro'));
    const slices=[...a.tiers.map(t=>({color:t.color,probability:t.probability})),{color:'#5b6b75',probability:a.unknown}];
    const total=slices.reduce((s,t)=>s+t.probability,0)||1;
    let acc=0;const stops=[];
    for(const s of slices){if(s.probability<=0)continue;const from=acc/total*360;acc+=s.probability;stops.push(`${s.color} ${from.toFixed(2)}deg ${(acc/total*360).toFixed(2)}deg`);}
    const chart=el('div',null,'pie-chart');chart.style.background=`conic-gradient(${stops.join(',')})`;chart.setAttribute('role','img');chart.setAttribute('aria-label','Probability of each outcome value tier');
    const lows=[0,.5,.8,1,1.5,3],highs=[.5,.8,1,1.5,3,Infinity];
    const legend=el('ul',null,'pie-key');
    a.tiers.forEach((t,i)=>{
      const range=highs[i]===Infinity?`over ${money(Math.round(lows[i]*cost),cur)}`:`${money(Math.round(lows[i]*cost),cur)} – ${money(Math.round(highs[i]*cost),cur)}`;
      const li=el('li');const swatch=el('i');swatch.style.background=t.color;
      const label=el('span');label.append(el('b',`${t.label} · ${(t.probability/total*100).toFixed(1)}%`),el('small',`${range} (${t.note})`));
      li.append(swatch,label);legend.append(li);
    });
    if(a.unknown>1e-9){const li=el('li');const swatch=el('i');swatch.style.background='#5b6b75';const label=el('span');label.append(el('b',`No price data · ${(a.unknown/total*100).toFixed(1)}%`),el('small','Not on the Steam market or not loaded'));li.append(swatch,label);legend.append(li);}
    const wrap=el('div',null,'pie-wrap');wrap.append(chart,legend);pie.append(el('h2','Value tiers'),wrap);
  }
  function renderOutcomes(){
    const result=lastResult;if(!result)return;
    const cur=steamCurrency(result.currency);
    const infos=result.outcomes.map(o=>({o,...outcomeName(o),probability:o.probability}));
    for(const i of infos)i.entry=prices.get(i.name,cur);
    const cost=result.complete&&result.total>0?result.total:null;
    const analysis=analyze(infos,cost,$('basis').value);
    renderSummary(analysis,result,cost,cur);
    if(!priceAbort){
      const missing=prices.pending(infos.map(i=>i.name),cur);
      $('priceNote').textContent=!infos.length?'':missing?`${missing} of ${infos.length} outcome prices not loaded. Loading takes roughly ${Math.max(1,Math.ceil(missing*2/60))} min because Steam limits request speed.`:'Prices loaded from Steam Community Market (cached for 30 minutes).';
    }
    $('outcomes').replaceChildren();
    analysis.rows.sort(SORTS[$('outSort').value]||SORTS.chance).forEach(({o,displayName,name,entry,net})=>{
      const priceLine=()=>{
        if(!entry)return el('p','Steam prices not loaded','micro');
        const parts=[`Top buy order ${entry.buy!=null?money(entry.buy,cur):'—'}`,`Avg price ${entry.median!=null?money(entry.median,cur):entry.lowest!=null?`${money(entry.lowest,cur)} (lowest)`:'—'}`];
        if(net!=null)parts.push(`Net after fees ${money(net,cur)}${cost?` (${pct(net/cost-1,0)} vs cost)`:''}`);
        return el('p',parts.join(' · '),'price');
      };
      const card=el('article',null,'outcome'),line=el('div',null,'outcome-line');
      line.append(marketLink(displayName,`https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`),el('b',`${(o.probability*100).toFixed(2)}%`));
      if(o.variants?.length){
        line.lastElementChild.textContent=`${(o.probability*100).toFixed(2)}% combined`;
        card.append(thumb(o.skin.image,displayName),el('div',null,'outcome-body'));const body=card.lastElementChild;
        body.append(line,el('p','Finish chance covers the eligible outcomes below. Individual phase/gem odds are unavailable.','muted'),priceLine());
        for(const v of o.variants){
          const variant=el('article',null,'phase-output');variant.dataset.phase=v.phase;variant.dataset.paintIndex=String(v.paintIndex);
          const label=marketLink(`${displayName} — ${v.phase}`,`https://steamcommunity.com/market/listings/730/${encodeURIComponent(displayName+` (${v.wear})`)}`);
          label.title='Steam groups phases in this finish’s market listings.';
          const text=el('div');text.append(label,el('p',`${v.float.toFixed(10)} · ${v.wear}`,'detail'));
          variant.append(thumb(v.image || o.skin.image,`${displayName} ${v.phase}`),text);
          body.append(variant);
        }
      }else{
        const body=el('div',null,'outcome-body');body.append(line,el('p',o.float==null?'Vanilla · no exterior':`${o.float.toFixed(10)} · ${o.wear}`,'detail'),priceLine());
        card.append(thumb(o.skin.image,displayName),body);
      }
      $('outcomes').append(card);
    });
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
      const add=el('button',basket.some(i=>i.listingId===item.listingId)?'Added':'+ Add');add.disabled=basket.some(i=>i.listingId===item.listingId);add.onclick=()=>command('add',{record});card.append(thumb(item.image || catalogImage(item.skinId),item.name),content,add);$('candidates').append(card);
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
        try{const d=decodeInspect(a.href);if(!d.itemid)continue;records.set(id,{listingId:id,assetId:String(d.itemid),inspect:a.href,image:row.querySelector('img[src*="steamstatic.com/economy/image"]')?.src || null,name:decodeURIComponent(location.pathname.split('/')[4] || ''),priceText:row.querySelector('.market_listing_price_with_fee')?.textContent.trim() || ''});}catch{}
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
        if(!block){block=document.createElement('div');block.className='cs2-tradeup-row';block.style.cssText='clear:both;padding:9px 12px;background:linear-gradient(110deg,#192a31,#16222e);color:#c3d8df;font:12px/1.5 Arial,sans-serif;display:flex;gap:12px;align-items:center;border-top:1px solid #85e7c21c;';row.append(block);}
        if(row.matches(betaRows)){
          // A positioned badge avoids adding a track to Beta's subgrid layout.
          if(getComputedStyle(row).position==='static' || !getComputedStyle(row).position)row.style.position='relative';
          block.style.cssText='position:absolute;top:5px;right:5px;z-index:2;padding:7px;background:#16222ef5;color:#c3d8df;font:10px/1.4 Arial,sans-serif;display:flex;flex-direction:column;gap:5px;max-width:85%;border:1px solid #85e7c238;border-radius:7px;box-shadow:0 4px 14px #0006;';
        }
        block.replaceChildren();const text=el('span',status);const add=el('button','Add to trade-up');add.style.cssText='padding:6px 10px;background:#85e7c2;color:#10291f;border:1px solid #a4f2d5;border-radius:6px;cursor:pointer;font:600 11px/1.2 Arial,sans-serif;white-space:nowrap;';
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
