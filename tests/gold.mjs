import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolveListing,calculate,validateBasket,contractSize,wear,outcomesFor} from '../src/core.js';
import {makeCatalog} from '../catalog.mjs';

const catalog=JSON.parse(await fs.readFile('dist/catalog.json','utf8'));
const raw=JSON.parse(await fs.readFile('skins.json','utf8'));
const crates=JSON.parse(await fs.readFile('crates.json','utf8'));
assert.deepEqual(makeCatalog(raw,crates),catalog,'Bundled catalog must match its reproducible source inputs.');
let sequence=500000;
export function goldRecord(name,st=false){
  const skin=catalog.find(s=>!s.gold && s.name===name);assert.ok(skin);
  const float=skin.min+(skin.max-skin.min)*.25;
  const id=String(sequence++);
  return {adapter:'steam-beta',listingId:id,assetId:id,name:`${st?'StatTrak™ ':''}${name} (${wear(float)})`,nativeFloat:float,inspect:'',priceMinor:10000,currency:1};
}
const make=(name,st=false)=>resolveListing(goldRecord(name,st),catalog);
const repeat=(name,n=5,st=false)=>Array.from({length:n},()=>make(name,st));

const gloves=repeat('USP-S | Printstream');
const gloveResult=calculate(gloves,catalog);
assert.equal(contractSize(gloves),5);assert.equal(gloveResult.required,5);assert.equal(gloveResult.complete,true);
assert.equal(gloveResult.total,50000);assert.equal(gloveResult.outcomes.length,24);
assert.ok(gloveResult.outcomes.every(o=>o.skin.category==='Gloves' && !o.skin.stattrak));
assert.ok(gloveResult.outcomes.every(o=>Math.abs(o.probability-1/24)<1e-12));
assert.ok(gloveResult.outcomes.every(o=>Math.abs(o.float-(o.skin.min+.25*(o.skin.max-o.skin.min)))<1e-12));
assert.equal(calculate(gloves.slice(0,4),catalog).complete,false);
assert.throws(()=>validateBasket([...gloves,make('USP-S | Printstream')],catalog),/takes 5/);
assert.throws(()=>make('USP-S | Printstream',true),/cannot be used in any contract/);
assert.throws(()=>make('AWP | Dragon Lore'),/no mapped/);
assert.throws(()=>resolveListing({...goldRecord('AK-47 | Vulcan'),souvenir:true},catalog),/Souvenir/);
assert.throws(()=>validateBasket([make('AK-47 | Vulcan'),make('AK-47 | Vulcan',true)],catalog),/mixed/);
assert.throws(()=>validateBasket([make('AK-47 | Vulcan'),make('AK-47 | Redline')],catalog),/same rarity/);
const knives=calculate(repeat('AK-47 | Vulcan',5,true),catalog);
assert.equal(knives.outcomes.length,13);
assert.ok(knives.outcomes.every(o=>o.skin.category==='Knives' && o.skin.stattrak));
const vanilla=knives.outcomes.find(o=>!o.skin.name.includes(' | '));
assert.ok(vanilla);assert.equal(vanilla.wear,null);assert.equal(vanilla.float,null);

// Two knife inputs and three glove inputs produce 40% knives / 60% gloves.
const mixed=calculate([...repeat('AK-47 | Vulcan',2),...repeat('USP-S | Printstream',3)],catalog);
const knifeChance=mixed.outcomes.filter(o=>o.skin.category==='Knives').reduce((a,o)=>a+o.probability,0);
const gloveChance=mixed.outcomes.filter(o=>o.skin.category==='Gloves').reduce((a,o)=>a+o.probability,0);
assert.ok(Math.abs(knifeChance-.4)<1e-12);assert.ok(Math.abs(gloveChance-.6)<1e-12);
assert.ok(Math.abs(knifeChance+gloveChance-1)<1e-12);

// Different cases with identical gold pools must accumulate rather than duplicate outcomes.
const snake=crates.find(c=>c.name==='Snakebite Case').contains.find(s=>s.rarity.name==='Covert');
const shared=calculate([...repeat('USP-S | Printstream',2),...repeat(snake.name,3)],catalog);
assert.equal(shared.outcomes.length,24);assert.ok(shared.outcomes.every(o=>Math.abs(o.probability-1/24)<1e-12));

// Doppler is one finish-family ticket, not seven equally likely phase tickets.
const spectrum=calculate(repeat('P250 | See Ya Later'),catalog);
assert.equal(spectrum.outcomes.length,30);
const doppler=spectrum.outcomes.find(o=>o.skin.name==='★ Butterfly Knife | Doppler');
assert.ok(doppler);assert.equal(doppler.skin.phases.length,7);assert.ok(Math.abs(doppler.probability-1/30)<1e-12);
assert.ok(Math.abs(spectrum.outcomes.reduce((a,o)=>a+o.probability,0)-1)<1e-12);
assert.throws(()=>resolveListing({adapter:'steam-beta',listingId:'1',assetId:'1',name:'★ Butterfly Knife | Doppler (Factory New)',nativeFloat:.02,inspect:''},catalog),/uniquely matched/);

// Every mapped input has a complete normal pool and every outcome is a catalogued gold item.
for(const skin of catalog.filter(s=>s.goldPool)){
  const pool=outcomesFor({skinId:skin.id,rarity:'Covert',stattrak:false},catalog);
  assert.equal(pool.length,skin.goldPool.outcomeIds.length);
  assert.ok(pool.every(s=>s.gold && ['Knives','Gloves'].includes(s.category)));
}
const gloveCoverts=catalog.filter(s=>s.goldPool?.kind==='gloves');
assert.ok(new Set(gloveCoverts.map(s=>s.goldPool.id)).size>=8);
for(const skin of gloveCoverts){
  assert.throws(()=>make(skin.name,true),/cannot be used in any contract/);
  const normal=make(skin.name),invalid={...normal,stattrak:true,name:`StatTrak™ ${normal.name}`};
  assert.equal(outcomesFor(invalid,catalog).length,0);
  assert.throws(()=>validateBasket([invalid],catalog),/cannot be used in any contract/);
  assert.throws(()=>calculate([invalid],catalog),/cannot be used in any contract/);
  assert.throws(()=>validateBasket([make('AK-47 | Vulcan',true),invalid],catalog),/cannot be used in any contract/);
}
// Do not exclude lower-rarity StatTrak skins just because their collection has gloves.
const lower=catalog.find(s=>s.rarity==='Classified' && s.collections.some(c=>gloveCoverts.some(g=>g.collections.some(gc=>gc.id===c.id))));
assert.ok(lower);assert.ok(make(lower.name,true));
console.log(`PASS: blanket exclusion for ${gloveCoverts.length} StatTrak glove-collection Coverts, including stale baskets and mixed knife drafts; lower rarities remain eligible.`);
console.log('PASS: gold catalog integrity, 5-input contracts, normal/StatTrak eligibility, glove gating, mixed/shared pool odds, normalized floats, vanilla outputs and Doppler family grouping.');
