import assert from 'node:assert/strict';
import {parsePrice,netProceeds,analyze,SORTS,createPriceLoader,steamCurrency} from '../src/prices.js';

assert.equal(parsePrice('$1,234.56'),123456);
assert.equal(parsePrice('1.234,56€'),123456);
assert.equal(parsePrice('$0.03'),3);
assert.equal(parsePrice('$5'),500);
assert.equal(parsePrice('n/a'),null);
assert.equal(netProceeds(115),100);
assert.equal(netProceeds(3),1);
assert.equal(netProceeds(2),0);
assert.equal(steamCurrency(2001),1);
assert.equal(steamCurrency(3),3);

const items=[
  {name:'B',probability:.5,entry:{median:230,buy:200}},
  {name:'A',probability:.3,entry:{median:50,buy:40}},
  {name:'C',probability:.2,entry:null}
];
const a=analyze(items,100,'median');
assert.ok(Math.abs(a.coverage-.8)<1e-9);
assert.ok(Math.abs(a.chanceOfProfit-.5)<1e-9);
assert.ok(Math.abs(a.unknown-.2)<1e-9);
assert.equal(a.tiers.length,6);
assert.ok(Math.abs(a.tiers.reduce((s,t)=>s+t.probability,0)-.8)<1e-9);
assert.deepEqual([...a.rows].sort(SORTS.name).map(r=>r.name),['A','B','C']);
assert.deepEqual([...a.rows].sort(SORTS['value-desc']).map(r=>r.name),['B','A','C']);
assert.deepEqual([...analyze(items,100,'buy').rows].sort(SORTS['buy-desc']).map(r=>r.name),['B','A','C']);

const calls=[];let t=0;
const loader=createPriceLoader({
  spacing:0,now:()=>t,sleep:async()=>{},
  fetchFn:async url=>{
    calls.push(url);
    if(url.includes('priceoverview'))return {status:200,ok:true,json:async()=>({success:true,median_price:'$1.50',lowest_price:'$1.40',volume:'1,200'})};
    if(url.includes('/listings/'))return {status:200,ok:true,text:async()=>'Market_LoadOrderSpread( 4242 );'};
    return {status:200,ok:true,json:async()=>({success:true,highest_buy_order:'120',lowest_sell_order:'140'})};
  }
});
await loader.load(['X (Factory New)'],1);
assert.deepEqual(loader.get('X (Factory New)',1),{...loader.get('X (Factory New)',1),median:150,lowest:140,buy:120,sell:140,volume:1200});
assert.equal(calls.length,3);
await loader.load(['X (Factory New)'],1);
assert.equal(calls.length,3,'fresh results are cached');
assert.equal(loader.pending(['X (Factory New)','Y'],1),1);

const limited=createPriceLoader({spacing:0,sleep:async()=>{},fetchFn:async()=>({status:429,ok:false})});
await assert.rejects(()=>limited.load(['Z'],1),/rate limiting/);

console.log('PASS: Steam price parsing, fee inversion, ROI/profit/tier analysis, sorting, rate-limited cached loader.');
