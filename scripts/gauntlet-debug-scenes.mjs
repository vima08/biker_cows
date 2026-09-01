import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.BCFV_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:process.env.BCFV_BROWSER??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--no-sandbox','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[],outputDir=path.resolve('.gauntlet/debug-scenes');
await mkdir(outputDir,{recursive:true});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
page.on('requestfailed',r=>errors.push(`request: ${r.url()} (${r.failure()?.errorText})`));
const shot=async name=>{const url=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));await writeFile(path.join(outputDir,`${name}.png`),Buffer.from(url.split(',')[1],'base64'))};
const state=()=>page.evaluate(()=>window.__BCFV_DEBUG__.snapshot());
const open=async route=>{await page.goto(`${baseURL}/${route}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.__BCFV_DEBUG__))};
const signature=()=>page.evaluate(()=>{const c=document.querySelector('canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<p.length;i+=16)h=Math.imul(h^p[i]^(p[i+1]<<8)^(p[i+2]<<16),16777619);return h>>>0});
const report={scenes:{},vectorSurfaces:{},toggle:{},errors};
try{
 for(const hero of ['cassia','bruna','nova']){
  await open(`?scene=brawler-walk&hero=${hero}`);await page.waitForFunction(()=>window.__BCFV_DEBUG__.snapshot().brawler?.status==='running');
  const walk=[];for(let i=0;i<18;i++){await page.waitForTimeout(70);walk.push((await state()).brawler.players[0])}
  const phases=[...new Set(walk.map(s=>s.walkPhase))],xDelta=walk.at(-1).x-walk[0].x;
  if(xDelta<100||phases.length!==4||walk.some(s=>!s.moving))throw Error(`${hero} walk failed: ${JSON.stringify({xDelta,phases})}`);await shot(`${hero}-walk`);
  await open(`?scene=brawler-jump&hero=${hero}`);await page.waitForFunction(()=>window.__BCFV_DEBUG__.snapshot().brawler?.players[0].z>8);
  const jump=[];for(let i=0;i<16;i++){await page.waitForTimeout(30);jump.push((await state()).brawler.players[0])}const maxZ=Math.max(...jump.map(s=>s.z));
  if(maxZ<=20||jump.some(s=>s.attackPhase!==null))throw Error(`${hero} jump failed: ${maxZ}`);await shot(`${hero}-jump`);
  await open(`?scene=brawler-air-attack&hero=${hero}`);await page.waitForFunction(()=>window.__BCFV_DEBUG__.snapshot().brawler?.players[0].airborneAttack===true);
  const air=[];for(let i=0;i<8;i++){await page.waitForTimeout(35);air.push((await state()).brawler.players[0])}
  const frames=[...new Set(air.map(s=>s.frame))],attackPhases=[...new Set(air.map(s=>s.attackPhase).filter(Boolean))],expected=[5,6];
  if(!air.every(s=>s.z>8)||!frames.every(f=>expected.includes(f))||!attackPhases.includes('contact'))throw Error(`${hero} air failed: ${JSON.stringify({frames,attackPhases})}`);await shot(`${hero}-air-attack`);
  report.scenes[hero]={walk:{xDelta:Number(xDelta.toFixed(2)),phases},jump:{maxZ},airAttack:{frames,phases:attackPhases}};
 }
 for(const [name,route] of Object.entries({title:'?art=vector',select:'?scene=select&art=vector',stage1:'?scene=game&hero=cassia&art=vector',stage1Boss:'?scene=boss&hero=bruna&art=vector',stage2:'?scene=brawler&hero=nova&art=vector',stage2Boss:'?scene=brawler-boss&hero=bruna&art=vector'})){
  await open(route);await page.waitForTimeout(140);const s=await state();if(s.artEnabled!==false||s.renderMode!=='vector')throw Error(`${name} vector mode failed`);report.vectorSurfaces[name]={state:s.state,mode:s.renderMode,signature:await signature()};await shot(`vector-${name}`);
 }
 await open('?scene=brawler-walk&hero=cassia');await page.waitForTimeout(180);const authored=await signature(),disabled=await page.evaluate(()=>window.__BCFV_DEBUG__.setArtEnabled(false));await page.waitForTimeout(100);const vector=await signature();await shot('toggle-vector');const enabled=await page.evaluate(()=>window.__BCFV_DEBUG__.setArtEnabled(true));await page.waitForTimeout(100);const restored=await signature();await shot('toggle-authored-restored');
 if(authored===vector||vector===restored||disabled.renderMode!=='vector'||enabled.renderMode!=='authored')throw Error(`toggle failed: ${JSON.stringify({authored,vector,restored})}`);report.toggle={authored,vector,restored,modes:[disabled.renderMode,enabled.renderMode],reloads:0};
 if(errors.length)throw Error(errors.join('\n'));await writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,...report},null,2));
}finally{await browser.close()}
