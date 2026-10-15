import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {targetSkins,achievableWears,plannedAverage,candidates,plan} from '../src/planner.js';

const catalog=JSON.parse(await fs.readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const target=targetSkins(catalog).find(s=>s.rarity==='Classified'&&s.collections.length>=1&&s.max-s.min>0.3);
assert.ok(target);
const wears=achievableWears(target);
assert.ok(wears.length>0);
const wearName=wears[wears.length-1].name;
const pa=plannedAverage(target,wearName);
assert.ok(pa.average>=0&&pa.average<=1);

const cand=candidates(target,false,wearName,catalog);
assert.ok(cand.groups.length>=1);
for(const g of cand.groups)for(const i of g.inputs)assert.equal(i.skin.rarity,'Restricted');

const priceFor=base=>name=>({lowest:base+(name.length%7)*10});
const rich=plan(cand,10**9,priceFor(100));
assert.ok(rich.withinBudget);
assert.equal(rich.lines.reduce((s,l)=>s+l.count,0),10);
const bestOdds=Math.max(...cand.groups.map(g=>1/g.pool));
assert.ok(Math.abs(rich.odds-bestOdds)<1e-9,'unlimited budget uses the best-odds collection');

const broke=plan(cand,1,priceFor(100));
assert.equal(broke.withinBudget,false);
assert.ok(broke.odds>0);
assert.ok(broke.cost<=rich.cost+1e-9||cand.groups.length===1);

assert.equal(plan(cand,10**9,()=>null),null);
console.log('PASS: Make My Trade Up planner — candidates, planned floats, best odds within budget and cheapest fallback.');
