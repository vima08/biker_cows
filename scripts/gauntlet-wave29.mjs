import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base=(process.env.BCFV_URL??'http://127.0.0.1:4299/biker_cows').replace(/\/$/,'');
const out=path.resolve(process.env.BCFV_CAPTURE_DIR??'.gauntlet/iteration-32/canonical');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BCFV_BROWSER??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--no-sandbox','--mute-audio','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}});
const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{const url=new URL(r.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==new URL(base).origin)external.push(r.url());});
const report={ok:false,errors,external,walk:{},contactPairs:{},scarves:{},pause:{},miniboss:{}};
const series=[];
const snap=()=>page.evaluate(()=>window.__BCFV_DEBUG__.snapshot());
async function open(scene,hero='cassia'){await page.goto(`${base}/?scene=${scene}&hero=${hero}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>Boolean(window.__BCFV_DEBUG__));}
async function shot(name){const result=await page.evaluate(()=>({png:document.querySelector('canvas').toDataURL(),state:window.__BCFV_DEBUG__.snapshot()}));const buffer=Buffer.from(result.png.split(',')[1],'base64');await writeFile(path.join(out,name+'.png'),buffer);return{state:result.state,hash:createHash('sha256').update(buffer).digest('hex')};}
function check(condition,why){if(!condition)throw Error(why);}
try{
 for(const hero of ['cassia','bruna','nova']){
  await open('brawler-walk',hero);
  const contactPairs=await page.evaluate(async hero=>{
   const image=new Image();image.src=new URL(`assets/brawler/${hero}-brawler-walk-v9.png`,document.baseURI).href;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const bounds=(frame,row)=>{let l=256,t=192,r=-1,b=-1;for(let y=0;y<192;y++)for(let x=0;x<256;x++){const i=((row*192+y)*canvas.width+frame*256+x)*4;if(pixels[i+3]>20){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}return{width:r-l+1,height:b-t+1};};
   const lowerBodyDifference=(row)=>{let sum=0,count=0;for(let y=82;y<190;y++)for(let x=0;x<256;x++){const a=((row*192+y)*canvas.width+x)*4;const b=((row*192+y)*canvas.width+2*256+x)*4;sum+=Math.abs(pixels[a]-pixels[b])+Math.abs(pixels[a+1]-pixels[b+1])+Math.abs(pixels[a+2]-pixels[b+2])+Math.abs(pixels[a+3]-pixels[b+3]);count+=4;}return sum/count;};
   return [0,1].map(row=>{const sizes=[0,1,2,3].map(frame=>bounds(frame,row));return{row,lowerBodyDifference:lowerBodyDifference(row),widthRatio:Math.max(...sizes.map(s=>s.width))/Math.min(...sizes.map(s=>s.width)),heightRatio:Math.max(...sizes.map(s=>s.height))/Math.min(...sizes.map(s=>s.height))};});
  },hero);
  check(contactPairs.every(row=>row.lowerBodyDifference>4),hero+' contact frames are not distinct in the lower body');
  check(contactPairs.every(row=>row.widthRatio<1.45&&row.heightRatio<1.12),hero+' walk cycle changes body scale too sharply');
  report.contactPairs[hero]=contactPairs;
  for(const direction of ['right','left']){
   console.log('walk',hero,direction);
   await open(direction==='right'?'brawler-walk':'brawler-walk-left',hero);
   await page.waitForFunction(h=>window.__BCFV_DEBUG__.snapshot().brawler?.assets[h+'Walk']==='ready',hero);
   const samples=[],names=[];
   for(let i=0;i<17;i++){await page.waitForTimeout(137);const name=`walk-${hero}-${direction}-${String(i).padStart(2,'0')}`;const r=await shot(name);samples.push(r.state.brawler.players[0]);names.push(name+'.png');}
   const phases=new Set(samples.filter(s=>s.moving).map(s=>s.walkPhase));check(phases.size===4,hero+direction+' did not walk through every phase');
   const moving=samples.filter(s=>s.moving);check(moving.every(s=>direction==='right'?s.frame<4:s.frame>=4&&s.frame<8),'wrong directional atlas row');
   check(Math.abs(samples.at(-1).x-samples[0].x)>180,'no meaningful walk displacement');
   report.walk[hero+'-'+direction]={samples,phases:[...phases]};series.push({title:hero+' '+direction,frames:names});
  }
  console.log('scarves',hero);
  await open('sustain',hero);await page.waitForFunction(()=>window.__BCFV_DEBUG__.snapshot().fireState?.wheelMotion?.active);
  const samples=[],names=[];
  for(let i=0;i<13;i++){await page.waitForTimeout(240);const name=`fire-${hero}-${String(i).padStart(2,'0')}`;const r=await shot(name);samples.push(r.state.fireState);names.push(name+'.png');}
  check(samples.every(s=>s.kineticPose.secondaryActive&&!s.kineticPose.active&&s.bodyMode==='sustained'),'cloth disabled or firing body moved');
  check(new Set(samples.map(s=>s.kineticPose.secondaryA)).size>3,'cloth frozen');
  check(samples.every(s=>s.projectileOriginDeltaPx===0),'shot origin moved');
  check(samples.at(-1).shotsFired>samples[0].shotsFired+6,'sustained shooting stopped');
  const release=await page.evaluate(()=>window.__BCFV_DEBUG__.setDebugFireHeld(false));
  check(release.fireState.kineticPose.secondaryActive,'cloth vanished at release');
  await shot('release-'+hero);await page.waitForTimeout(220);await shot('ride-'+hero);
  await page.keyboard.press('KeyX');await page.waitForTimeout(95);await shot('jump-'+hero);
  report.scarves[hero]={samples,release:release.fireState};series.push({title:hero+' held fire',frames:names});
 }
 await open('select');await shot('select');
 for(const hero of ['cassia','bruna','nova']){
  await open('miniboss',hero);await page.waitForTimeout(500);const r=await shot('miniboss-'+hero);
  check(r.state.state==='playing'&&r.state.boss?.kind==='miniboss','direct miniboss URL did not enter battle');
  check(r.state.hero===hero||r.state.players?.[0]?.hero===hero,'miniboss lost selected hero');report.miniboss[hero]=r.state.boss;
 }
 for(const scene of ['sustain','brawler','road-rash']){
  await open(scene);await page.waitForTimeout(350);
  if(scene==='sustain')await page.evaluate(()=>window.__BCFV_DEBUG__.damagePlayer(1,24));
  await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.__BCFV_DEBUG__.snapshot().state==='paused');
  const captures=[];for(let i=0;i<5;i++){await page.waitForTimeout(120);captures.push(await shot(`pause-${scene}-${i}`));}
  check(new Set(captures.map(c=>c.hash)).size===1,scene+' paused pixels still jitter');
  await page.keyboard.press('KeyP');await page.waitForTimeout(150);check((await snap()).state!=='paused','resume failed');
  report.pause[scene]={identicalFrames:5,hash:captures[0].hash};
 }
 check(errors.length===0,'browser errors: '+errors.join(';'));check(external.length===0,'external network requests');
 report.ok=true;
}catch(e){report.error=e.stack;process.exitCode=1;}finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 const html=`<!doctype html><meta charset="utf-8"><title>Current gait motion</title><style>body{background:#14101e;color:#fff;font:16px system-ui}section{display:inline-block;width:48%;margin:1%}img{width:100%;image-rendering:pixelated}button{font:inherit}</style><h1>Current gait · real production motion</h1><button id="toggle">Pause / play</button><main></main><script>const series=${JSON.stringify(series)};let playing=true;document.querySelector('#toggle').onclick=()=>playing=!playing;for(const s of series){const e=document.createElement('section');e.innerHTML='<h2>'+s.title+'</h2><img>';document.querySelector('main').append(e);let i=0;setInterval(()=>{if(playing)e.querySelector('img').src=s.frames[i++%s.frames.length]},s.title.includes('fire')?240:137)}<\/script>`;
 await writeFile(path.join(out,'index.html'),html);await browser.close();console.log(JSON.stringify({ok:report.ok,error:report.error,errors,external}));
}
