import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {makeCatalog} from './catalog.mjs';
const out=path.resolve(process.argv[2] || 'dist');
await fs.mkdir(out,{recursive:true});
await Promise.all([
  build({entryPoints:['src/content.js'],outfile:path.join(out,'content.js'),bundle:true,format:'iife',platform:'browser',target:'chrome111',loader:{'.css':'text'},legalComments:'eof'}),
  build({entryPoints:['src/background.js'],outfile:path.join(out,'background.js'),bundle:true,format:'iife',platform:'browser',target:'chrome111',legalComments:'eof'}),
  build({entryPoints:['src/bridge.js'],outfile:path.join(out,'bridge.js'),bundle:true,format:'iife',platform:'browser',target:'chrome111',legalComments:'eof'}),
  fs.copyFile('manifest.json',path.join(out,'manifest.json'))
]);
const raw=JSON.parse(await fs.readFile('skins.json','utf8'));
const crates=JSON.parse(await fs.readFile('crates.json','utf8'));
const skins=makeCatalog(raw,crates);
await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify(skins));
await fs.copyFile('catalog-LICENSE.txt',path.join(out,'CATALOG-LICENSE.txt'));
await fs.writeFile(path.join(out,'THIRD-PARTY.txt'),`CS2 skin catalog: https://github.com/ByMykel/CSGO-API (MIT), snapshot 2026-10-14.\nInspect decoder: @csfloat/cs2-inspect-serializer 1.1.6 (MIT) and its dependencies. License notices are included in the generated bundles.\n`);
const licenseDir=path.join(out,'licenses');await fs.mkdir(licenseDir,{recursive:true});
for(const name of ['@csfloat/cs2-inspect-serializer','@protobuf-ts/runtime','buffer','crc-32','base64-js','ieee754']) {
  const folder=path.join('node_modules',name);
  const files=await fs.readdir(folder);
  const license=files.find(n=>/^licen[cs]e/i.test(n));
  if(!license)throw new Error(`Missing dependency license: ${name}`);
  await fs.copyFile(path.join(folder,license),path.join(licenseDir,`${name.replaceAll('/','-').replaceAll('@','')}.txt`));
}
await fs.copyFile('README.md',path.join(out,'README.md'));
for(const file of ['LICENSE','PRIVACY.md','THIRD_PARTY_NOTICES.md'])await fs.copyFile(file,path.join(out,file));
console.log(`Built ${skins.length} catalog skins in ${out}`);
