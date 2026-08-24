import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL=process.env.BCFV_URL??'http://127.0.0.1:4173';
const executablePath=process.env.BCFV_BROWSER??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root=path.resolve(process.env.BCFV_CAPTURE_DIR??'.gauntlet/iteration-26/temporal-polish');
const after=path.join(root,'after');
await mkdir(after,{recursive:true});
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
const page=await browser.newPage({viewport:{width:960,height:540}});
page.setDefaultTimeout(30_000);
const runtimeErrors=[];
page.on('pageerror',error=>runtimeErrors.push(`pageerror: ${error.message}`));
page.on('console',message=>{if(message.type()==='error')runtimeErrors.push(`console: ${message.text()}`);});
page.on('requestfailed',request=>runtimeErrors.push(`request: ${request.url()} (${request.failure()?.errorText??'failed'})`));
const assert=(condition,message,details)=>{if(!condition)throw new Error(`${message}${details===undefined?'':`\n${JSON.stringify(details,null,2)}`}`);};
const state=()=>page.evaluate(()=>window.__BCFV_DEBUG__.snapshot());
const brawler=async()=>(await state()).brawler;
const shot=async name=>{const dataURL=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));await writeFile(path.join(after,`${name}.png`),Buffer.from(dataURL.split(',')[1],'base64'));};
const movement=new Set();
const setMovement=async wanted=>{for(const key of ['KeyA','KeyD','KeyW','KeyS']){if(wanted.has(key)&&!movement.has(key)){await page.keyboard.down(key);movement.add(key);}if(!wanted.has(key)&&movement.has(key)){await page.keyboard.up(key);movement.delete(key);}}};
const release=()=>setMovement(new Set());
const approach=async()=>{
  const b=await brawler();const player=b.players[0];
  const target=b.enemies.reduce((best,enemy)=>!best||Math.hypot(enemy.x-player.x,(enemy.y-player.y)*1.5)<Math.hypot(best.x-player.x,(best.y-player.y)*1.5)?enemy:best,null);
  if(!target){await setMovement(new Set(['KeyD']));return null;}
  const dx=target.x-player.x,dy=target.y-player.y,wanted=new Set();
  if(Math.abs(dx)>59)wanted.add(dx>0?'KeyD':'KeyA');
  if(Math.abs(dy)>15)wanted.add(dy>0?'KeyS':'KeyW');
  await setMovement(wanted);return {b,player,target,dx,dy};
};

const report={ok:false,intervalMs:110,phaseWindowsMs:{windup:118,contact:151,recovery:151},configuredHitStopMs:70,playerStrip:[],enemyStrip:[],contact:null,trio:null,rider:null,runtimeErrors};
try{
  await page.goto(`${baseURL}/?scene=brawler&hero=cassia`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>{const b=window.__BCFV_DEBUG__?.snapshot().brawler;return b?.status==='running'&&Object.values(b.assets).every(value=>value==='ready');});
  await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>{const b=window.__BCFV_DEBUG__.snapshot().brawler;return b.wave===0&&b.arenaLocked&&b.enemies.length===3;});
  await page.keyboard.up('KeyD');movement.delete('KeyD');
  await page.waitForTimeout(900);
  const trioState=await brawler();
  const trioPairs=[];
  for(let first=0;first<trioState.enemies.length;first++)for(let second=first+1;second<trioState.enemies.length;second++){
    const a=trioState.enemies[first],b=trioState.enemies[second];trioPairs.push({ids:[a.id,b.id],dx:Number(Math.abs(a.x-b.x).toFixed(2)),dy:Number(Math.abs(a.y-b.y).toFixed(2)),distance:Number(Math.hypot(a.x-b.x,a.y-b.y).toFixed(2))});
  }
  report.trio={pairs:trioPairs,minDistance:Math.min(...trioPairs.map(pair=>pair.distance))};
  await shot('trio-spacing');

  const approachStarted=Date.now();let near=null;
  while(Date.now()-approachStarted<12_000){near=await approach();if(near&&Math.abs(near.dx)<=61&&Math.abs(near.dy)<=17&&!near.player.reactionPhase)break;await page.waitForTimeout(24);}
  await release();assert(near&&Math.abs(near.dx)<=61&&Math.abs(near.dy)<=20,'Could not stage Cassia beside a normal enemy',near);
  await page.keyboard.press('KeyZ');await page.waitForTimeout(18);
  let maxHitStop=0,maxSlash=0,contactAttachment=null;
  const playerPhases=new Set(),playerSignatures=new Set(),stripStarted=Date.now();
  while(Date.now()-stripStarted<900&&playerPhases.size<3){
    const b=await brawler(),player=b.players[0],target=b.enemies.reduce((best,enemy)=>!best||Math.abs(enemy.x-player.x)<Math.abs(best.x-player.x)?enemy:best,null);
    maxHitStop=Math.max(maxHitStop,b.hitStop);maxSlash=Math.max(maxSlash,b.contactFx.length);
    if(b.contactFx.length&&target){const fx=b.contactFx[0];contactAttachment={distanceToTarget:Number(Math.hypot(fx.x-(target.x-b.cameraX),fx.y-(target.y-42)).toFixed(2)),direction:Math.sign(fx.vx),facing:player.facing,fx,target:{x:Number((target.x-b.cameraX).toFixed(2)),y:target.y-42}};}
    if(player.attackPhase&&!playerPhases.has(player.attackPhase)){
      playerPhases.add(player.attackPhase);playerSignatures.add(`${player.attackPhase}:${player.frame}:${player.pose.offsetX}:${player.pose.rotation}:${player.pose.scaleX}:${player.pose.scaleY}`);
      report.playerStrip.push({t:Date.now()-stripStarted,phase:player.attackPhase,frame:player.frame,pose:player.pose,enemyReaction:target?.reactionPhase??null,hitStop:b.hitStop,contactFx:b.contactFx.length,separation:target?Number(Math.hypot(target.x-player.x,target.y-player.y).toFixed(2)):null});
      await shot(`cassia-${player.attackPhase}`);
    }
    await page.waitForTimeout(8);
  }
  assert(['windup','contact','recovery'].every(phase=>playerPhases.has(phase)),'Cassia strip missed a phase',report.playerStrip);
  assert(playerSignatures.size>=3,'Cassia phases did not resolve to three distinct poses',report.playerStrip);
  // RAF sampling observes the configured 70ms hold after zero to one frame has
  // elapsed, so 50-90ms is the correct sampled acceptance window.
  assert(maxHitStop>=.05&&maxHitStop<=.09,'Sampled contact hit-stop outside the configured 70ms budget',{maxHitStop,strip:report.playerStrip});
  assert(maxSlash>=3,'Attached contact slash did not emit at least three hot elements',{maxSlash,strip:report.playerStrip});
  assert(contactAttachment&&contactAttachment.distanceToTarget<70&&contactAttachment.direction===contactAttachment.facing,'Contact slash was detached or pointed backwards',contactAttachment);
  report.contact={maxHitStop,maxSlash,attachment:contactAttachment};

  // Let the same surviving raider recover and perform its production attack.
  await page.waitForTimeout(350);
  const enemyPhases=new Set();const enemyFrames=new Set();const enemyStarted=Date.now();let attackerId=null;
  while(Date.now()-enemyStarted<5_000&&enemyPhases.size<3){
    const b=await brawler(),target=attackerId===null?b.enemies.find(enemy=>enemy.attackPhase):b.enemies.find(enemy=>enemy.id===attackerId);
    if(target?.attackPhase&&attackerId===null)attackerId=target.id;
    if(target?.attackPhase&&!enemyPhases.has(target.attackPhase)){
      enemyPhases.add(target.attackPhase);enemyFrames.add(target.frame);
      const player=b.players[0];report.enemyStrip.push({t:Date.now()-enemyStarted,phase:target.attackPhase,frame:target.frame,pose:target.pose,separation:Number(Math.hypot(target.x-player.x,target.y-player.y).toFixed(2))});
      await shot(`enemy-${target.attackPhase}`);
    }
    await page.waitForTimeout(22);
  }
  assert(['anticipation','contact','recovery'].every(phase=>enemyPhases.has(phase)),'Normal enemy strip missed a phase',report.enemyStrip);
  assert(enemyFrames.size>=3,'Normal enemy attack did not use three authored silhouettes',report.enemyStrip);
  assert(report.trio.minDistance>=52,'Three-enemy encounter collapsed into one silhouette cluster',report.trio);

  await page.goto(`${baseURL}/?scene=sustain&hero=cassia`,{waitUntil:'networkidle'});await page.waitForTimeout(260);const sustain=await state();await shot('rider-muzzle-attached');
  await page.evaluate(()=>window.__BCFV_DEBUG__.gotoScene('impact-4'));await page.waitForTimeout(160);const impact=await state();await shot('rider-impact-attached');
  assert((sustain.fireState?.projectileOriginDeltaPx??999)<=.01,'Rider projectile origin detached from visible barrel',sustain.fireState);
  assert(impact.impact?.contact?.emitterOrigin&&impact.impact.contact.emitterOrigin.x===impact.impact.contact.coreCenterX&&impact.impact.contact.emitterOrigin.y===impact.impact.contact.coreCenterY,'Rider hit effect detached from contact core',impact.impact?.contact);
  report.rider={projectileOriginDeltaPx:sustain.fireState.projectileOriginDeltaPx,muzzle:sustain.fireState.visibleBarrelHardpoint,impactEmitter:impact.impact.contact.emitterOrigin,impactCore:{x:impact.impact.contact.coreCenterX,y:impact.impact.contact.coreCenterY}};
  assert(runtimeErrors.length===0,'Runtime errors recorded',runtimeErrors);
  report.ok=true;
}catch(error){report.error=error instanceof Error?error.stack:String(error);process.exitCode=1;}finally{
  await release().catch(()=>{});await writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
}
