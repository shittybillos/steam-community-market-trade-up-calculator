export function makeCatalog(raw,crates){
  const isGold=s=>['Knives','Gloves'].includes(s.category?.name);
  const normalize=s=>({id:s.id,name:s.name,weaponId:s.weapon.weapon_id,paintIndex:s.paint_index==null?null:Number(s.paint_index),min:s.min_float,max:s.max_float,rarity:s.rarity.name,stattrak:s.stattrak,image:s.image || null,gold:isGold(s),category:s.category?.name,collections:(s.collections || []).map(c=>({id:c.id,name:c.name}))});
  const skins=raw.filter(s=>!isGold(s) && s.min_float!=null && s.max_float!=null).map(normalize);
  const byRaw=new Map(raw.map(s=>[s.id,s]));
  const families=new Map();
  for(const s of raw.filter(isGold)){
    let group=families.get(s.name);
    if(!group){group={...normalize(s),id:`gold-${s.id}`,gold:true,phases:[],variants:[]};families.set(s.name,group);}
    if(group.min!==s.min_float || group.max!==s.max_float || group.stattrak!==s.stattrak)throw new Error(`Inconsistent gold-family range: ${s.name}`);
    if(s.phase && !group.phases.includes(s.phase))group.phases.push(s.phase);
    if(s.phase)group.variants.push({id:s.id,phase:s.phase,paintIndex:Number(s.paint_index),min:s.min_float,max:s.max_float,image:s.image || null});
  }
  const inputPools=new Map();
  for(const c of crates.filter(c=>c.contains_rare?.length)){
    const outcomeIds=[...new Set(c.contains_rare.map(ref=>{
      const skin=byRaw.get(ref.id);if(!skin || !isGold(skin))throw new Error(`Missing gold mapping ${c.name}: ${ref.id}`);
      return families.get(skin.name).id;
    }))].sort();
    const categories=new Set(c.contains_rare.map(ref=>byRaw.get(ref.id).category.name));
    const kind=categories.size===1 && categories.has('Gloves')?'gloves':categories.size===1 && categories.has('Knives')?'knives':'mixed';
    const variantIds=[...new Set(c.contains_rare.map(ref=>ref.id))].sort();
    const pool={id:c.id,name:c.name,kind,outcomeIds,variantIds};
    for(const ref of c.contains.filter(s=>s.rarity.name==='Covert')){
      const prior=inputPools.get(ref.id);
      if(prior && (JSON.stringify(prior.outcomeIds)!==JSON.stringify(outcomeIds) || JSON.stringify(prior.variantIds)!==JSON.stringify(variantIds)))throw new Error(`Ambiguous gold pool for ${ref.name}`);
      inputPools.set(ref.id,prior || pool);
    }
  }
  for(const s of skins)if(s.rarity==='Covert' && inputPools.has(s.id))s.goldPool=inputPools.get(s.id);
  return [...skins,...families.values()];
}
