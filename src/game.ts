import {
  drawBoss as drawPixelBoss,
  drawEnemy as drawPixelEnemy,
  drawHero as drawPixelHero,
  drawPickup as drawPixelPickup,
} from './art';
import { drawEnvironment, drawEnvironmentForeground } from './environment';

const W = 960;
const H = 540;
const LEVEL_BOSS_TIME = 465;

type GameMode = 'title' | 'select' | 'playing' | 'paused' | 'win' | 'lose';
type HeroId = 'throttle' | 'modo' | 'vinnie';
type Weapon = 'blaster' | 'spread' | 'laser' | 'rockets';
type EnemyKind = 'rider' | 'tank' | 'drone' | 'skimmer' | 'mine' | 'miniboss' | 'boss' | 'pod';
type PickupKind = 'health' | 'armor' | 'weapon' | 'rapid' | 'score';

interface HeroSpec {
  id: HeroId;
  name: string;
  epithet: string;
  color: string;
  accent: string;
  maxHp: number;
  maxArmor: number;
  speed: number;
  fireRate: number;
  weapon: Weapon;
  special: string;
  stats: [number, number, number];
}

const HEROES: HeroSpec[] = [
  { id: 'throttle', name: 'THROTTLE', epithet: 'THE ROAD CAPTAIN', color: '#d5bd82', accent: '#ffcf32', maxHp: 110, maxArmor: 45, speed: 330, fireRate: .145, weapon: 'blaster', special: 'REDLINE FOCUS', stats: [4, 4, 4] },
  { id: 'modo', name: 'MODO', epithet: 'THE IRON FIST', color: '#b7c1ce', accent: '#55d6ff', maxHp: 150, maxArmor: 80, speed: 285, fireRate: .24, weapon: 'spread', special: 'METAL QUAKE', stats: [5, 2, 5] },
  { id: 'vinnie', name: 'VINNIE', epithet: 'THE WILD CARD', color: '#f1e6d3', accent: '#ff4b72', maxHp: 90, maxArmor: 30, speed: 375, fireRate: .105, weapon: 'laser', special: 'WHITE-KNUCKLE', stats: [3, 5, 2] },
];

interface Player {
  x: number; y: number; jump: number; jumpV: number;
  hp: number; armor: number; invuln: number; cooldown: number;
  weapon: Weapon; weaponRank: number; rapid: number; special: number;
  specialTime: number; lean: number; wheel: number; recoil: number;
}

interface Enemy {
  id: number; kind: EnemyKind; x: number; y: number; w: number; h: number;
  hp: number; maxHp: number; vx: number; vy: number; t: number; fire: number;
  aerial: boolean; phase: number; flash: number; hitReact: number; score: number;
}

interface Projectile {
  x: number; y: number; vx: number; vy: number; r: number; life: number;
  damage: number; friendly: boolean; color: string; kind: Weapon | 'enemy' | 'orb';
  pierce: number; homing?: boolean; age?: number; phase?: number;
}

interface Pickup { x: number; y: number; kind: PickupKind; t: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark'|'smoke'|'fire'|'dust'|'debris'|'ring'|'star'|'impact'|'shard'|'blast'; rot: number; }
interface Floater { x: number; y: number; text: string; color: string; life: number; }

class Input {
  held = new Set<string>();
  pressed = new Set<string>();
  private padPrev: boolean[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    addEventListener('keydown', (event) => {
      if (block.has(event.code)) event.preventDefault();
      if (!this.held.has(event.code)) this.pressed.add(event.code);
      this.held.add(event.code);
    });
    addEventListener('keyup', (event) => this.held.delete(event.code));
    addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('pointerdown', () => { canvas.focus(); this.pressed.add('Enter'); });
    canvas.tabIndex = 0;
  }

  pollGamepad() {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    const buttons = pad.buttons.map((b) => b.pressed);
    const map: Array<[number, string]> = [[0,'KeyZ'],[1,'KeyX'],[2,'KeyC'],[9,'Enter'],[8,'Escape'],[12,'ArrowUp'],[13,'ArrowDown'],[14,'ArrowLeft'],[15,'ArrowRight']];
    for (const [i, key] of map) {
      if (buttons[i]) this.held.add(key); else if (this.padPrev[i]) this.held.delete(key);
      if (buttons[i] && !this.padPrev[i]) this.pressed.add(key);
    }
    const [ax = 0, ay = 0] = pad.axes;
    this.axis('PadLeft', ax < -.28); this.axis('PadRight', ax > .28);
    this.axis('PadUp', ay < -.28); this.axis('PadDown', ay > .28);
    this.padPrev = buttons;
  }

  private axis(key: string, on: boolean) { if (on) this.held.add(key); else this.held.delete(key); }
  down(...codes: string[]) { return codes.some((code) => this.held.has(code)); }
  tap(...codes: string[]) { return codes.some((code) => this.pressed.has(code)); }
  endFrame() { this.pressed.clear(); }
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rnd(min: number, max: number) { return min + Math.random() * (max - min); }
function hit(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function emitAudio(name: string, volume = 1, pitch = 1) {
  window.dispatchEvent(new CustomEvent('redline:sfx', { detail: { name, volume, pitch } }));
}
function emitMusic(cue: string, intensity = 1) {
  window.dispatchEvent(new CustomEvent('redline:music', { detail: { cue, intensity } }));
}

export class RedlineGame {
  private ctx: CanvasRenderingContext2D;
  private input: Input;
  private mode: GameMode = 'title';
  private last = 0;
  private time = 0;
  private selected = 0;
  private player!: Player;
  private enemies: Enemy[] = [];
  private shots: Projectile[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private enemyId = 0;
  private elapsed = 0;
  private distance = 0;
  private worldSpeed = 330;
  private spawnClock = 0;
  private obstacleClock = 2;
  private score = 0;
  private combo = 1;
  private comboClock = 0;
  private kills = 0;
  private shake = 0;
  private flash = 0;
  private minibossSpawned = false;
  private bossSpawned = false;
  private bossDefeated = false;
  private debugBeat = false;
  private finishClock = 0;
  private titleChoice = 0;
  private highScores: Array<{name:string;score:number}> = [];
  private titleArt = new Image();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
    this.titleArt.src = '/assets/title-key-art.png';
    this.loadScores();
    const query = new URLSearchParams(location.search);
    const hero = query.get('hero') as HeroId | null;
    if (hero && HEROES.some(h => h.id === hero)) this.selected = HEROES.findIndex(h => h.id === hero);
    const scene = query.get('scene');
    if (scene === 'select') this.mode = 'select';
    else if (scene === 'game' || scene === 'boss') {
      this.beginRun();
      if (scene === 'boss') this.debugBoss();
      else this.elapsed = clamp(Number(query.get('time')) || 0, 0, LEVEL_BOSS_TIME);
    }
  }

  start() {
    emitMusic('title', .65);
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    const dt = Math.min(.034, (now - this.last) / 1000 || .016);
    this.last = now;
    this.time += dt;
    this.input.pollGamepad();
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.mode === 'title') this.updateTitle();
    else if (this.mode === 'select') this.updateSelect();
    else if (this.mode === 'playing') this.updatePlaying(dt);
    else if (this.mode === 'paused') this.updatePause();
    else this.updateEnd();
  }

  private updateTitle() {
    if (this.input.tap('ArrowUp','KeyW','ArrowDown','KeyS')) { this.titleChoice = 1 - this.titleChoice; emitAudio('menu_move'); }
    if (this.input.tap('Enter','Space','KeyZ')) {
      if (this.titleChoice === 0) { this.mode = 'select'; emitAudio('menu_accept'); emitMusic('select', .7); }
      else { this.highScores = []; localStorage.removeItem('redline-highscores'); emitAudio('menu_back'); }
    }
  }

  private updateSelect() {
    if (this.input.tap('ArrowLeft','KeyA')) { this.selected = (this.selected + 2) % 3; emitAudio('menu_move'); }
    if (this.input.tap('ArrowRight','KeyD')) { this.selected = (this.selected + 1) % 3; emitAudio('menu_move'); }
    if (this.input.tap('Escape','Backspace')) { this.mode = 'title'; emitMusic('title'); }
    if (this.input.tap('Enter','Space','KeyZ')) this.beginRun();
  }

  private beginRun() {
    const hero = HEROES[this.selected];
    this.player = { x: 168, y: 406, jump: 0, jumpV: 0, hp: hero.maxHp, armor: hero.maxArmor * .5, invuln: 0, cooldown: 0, weapon: hero.weapon, weaponRank: 1, rapid: 0, special: 45, specialTime: 0, lean: 0, wheel: 0, recoil: 0 };
    this.enemies = []; this.shots = []; this.pickups = []; this.particles = []; this.floaters = [];
    this.elapsed = 0; this.distance = 0; this.worldSpeed = hero.speed; this.score = 0; this.combo = 1; this.comboClock = 0; this.kills = 0;
    this.spawnClock = 1; this.obstacleClock = 4; this.minibossSpawned = false; this.bossSpawned = false; this.bossDefeated = false; this.debugBeat = false; this.finishClock = 0;
    this.mode = 'playing';
    emitAudio('engine_start'); emitMusic('stage', .86);
  }

  private updatePause() {
    if (this.input.tap('Escape','Enter','KeyP')) { this.mode = 'playing'; emitAudio('menu_accept'); emitMusic(this.bossSpawned ? 'boss' : 'stage'); }
    if (this.input.tap('KeyR')) this.beginRun();
  }

  private updateEnd() {
    if (this.input.tap('Enter','Space','KeyZ')) this.beginRun();
    if (this.input.tap('Escape')) { this.mode = 'title'; emitMusic('title'); }
  }

  private updatePlaying(dt: number) {
    if (this.input.tap('Escape','Enter','KeyP')) { this.mode = 'paused'; emitAudio('pause'); emitMusic('pause', .35); return; }
    const hero = HEROES[this.selected];
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt); p.cooldown -= dt; p.recoil = Math.max(0, p.recoil - dt); p.rapid = Math.max(0, p.rapid - dt); p.specialTime = Math.max(0, p.specialTime - dt);
    this.comboClock -= dt;
    if (this.comboClock <= 0 && this.combo > 1) { this.combo = Math.max(1, this.combo - dt * 2.6); }

    let mx = (this.input.down('ArrowRight','KeyD','PadRight') ? 1 : 0) - (this.input.down('ArrowLeft','KeyA','PadLeft') ? 1 : 0);
    let my = (this.input.down('ArrowDown','KeyS','PadDown') ? 1 : 0) - (this.input.down('ArrowUp','KeyW','PadUp') ? 1 : 0);
    const controlSpeed = hero.speed * (p.specialTime > 0 && hero.id === 'vinnie' ? 1.25 : 1);
    p.x = clamp(p.x + mx * controlSpeed * dt, 72, 410);
    p.y = clamp(p.y + my * controlSpeed * .64 * dt, 330, 454);
    p.lean = lerp(p.lean, mx, dt * 8);
    if (this.input.tap('KeyX','KeyK','ShiftLeft') && p.jump === 0) { p.jumpV = 390; emitAudio('jump'); }
    if (p.jumpV !== 0 || p.jump > 0) {
      p.jump += p.jumpV * dt; p.jumpV -= 850 * dt;
      if (p.jump <= 0) { p.jump = 0; p.jumpV = 0; this.dust(p.x - 20, p.y + 10, 9); emitAudio('land', .55); }
    }

    if (this.input.down('KeyZ','KeyJ','Space') && p.cooldown <= 0) this.firePlayer();
    if (this.input.tap('KeyC','KeyL','ControlLeft') && p.special >= 100) this.useSpecial();

    const bossAlive = this.enemies.some(e => e.kind === 'boss' || e.kind === 'miniboss');
    const worldSpeed = (bossAlive ? 105 : hero.speed + mx * 45) * (p.specialTime > 0 && hero.id === 'throttle' ? 1.28 : 1);
    this.worldSpeed = worldSpeed;
    p.wheel += worldSpeed * dt * .045;
    this.distance += worldSpeed * dt;
    if (!this.bossSpawned) this.elapsed += dt;
    this.spawnClock -= dt; this.obstacleClock -= dt;
    if (!this.debugBeat && !bossAlive && !this.bossSpawned && this.spawnClock <= 0) this.spawnWave();
    if (!this.debugBeat && !bossAlive && this.obstacleClock <= 0) this.spawnObstacle();
    if (!this.debugBeat && !this.minibossSpawned && this.elapsed >= 145) { this.minibossSpawned = true; this.spawnEnemy('miniboss', 1010, 393); emitMusic('miniboss'); }
    if (!this.debugBeat && !this.bossSpawned && this.elapsed >= LEVEL_BOSS_TIME) { this.bossSpawned = true; this.enemies = this.enemies.filter(e => e.x > 0); this.spawnEnemy('boss', 1110, 295); emitMusic('boss'); emitAudio('warning'); }

    this.updateEnemies(dt, worldSpeed);
    this.updateShots(dt);
    this.updatePickups(dt, worldSpeed);
    this.updateParticles(dt, worldSpeed);
    this.handleCollisions();
    this.flash = Math.max(0, this.flash - dt * 3.5); this.shake = Math.max(0, this.shake - dt * 20);

    if (!this.debugBeat && Math.random() < dt * 13) this.dust(p.x - 35, p.y + 18, 1);
    if (this.bossDefeated) {
      this.finishClock += dt;
      if (this.finishClock > 4.8) this.finishRun(true);
    }
  }

  private firePlayer() {
    const p = this.player, hero = HEROES[this.selected];
    const rate = hero.fireRate * (p.rapid > 0 ? .56 : 1) * (p.specialTime > 0 && hero.id === 'throttle' ? .5 : 1) / (1 + (p.weaponRank - 1) * .08);
    p.cooldown = rate;
    // A short visual timer decouples the two-frame muzzle/recoil pose from fire-rate balance.
    p.recoil = .072;
    const x = p.x + 50, y = p.y - p.jump - 31;
    const add = (vx:number, vy:number, damage:number, r:number, color:string, kind:Weapon, pierce=0, homing=false) => this.shots.push({x,y,vx,vy,r,life:2,damage,friendly:true,color,kind,pierce,homing,age:0,phase:rnd(0,Math.PI*2)});
    if (p.weapon === 'blaster') {
      add(690, 0, 11 + p.weaponRank * 3, 4, '#ffe45d', 'blaster', p.weaponRank >= 3 ? 1 : 0);
      if (p.weaponRank >= 2) { this.shots[this.shots.length-1].y -= 7; add(690, 0, 10 + p.weaponRank * 2, 3, '#ff8a35', 'blaster'); this.shots[this.shots.length-1].y += 7; }
    } else if (p.weapon === 'spread') {
      const count = 3 + (p.weaponRank >= 3 ? 2 : 0);
      for (let i=0;i<count;i++) add(575, (i-(count-1)/2)*58, 8+p.weaponRank*2, 3.5, '#6ff7ff', 'spread');
    } else if (p.weapon === 'laser') {
      add(900, 0, 9+p.weaponRank*3, 3, '#ff4aa8', 'laser', 2+p.weaponRank);
      if (p.weaponRank >= 3) { add(850,-22,8,2,'#fff','laser',1); add(850,22,8,2,'#fff','laser',1); }
    } else {
      add(430, 0, 22+p.weaponRank*7, 6, '#ffb13b', 'rockets', 0, true);
      if (p.weaponRank >= 3) { add(430,-35,18,5,'#ff6b30','rockets',0,true); }
    }
    for (let i=0;i<4;i++) this.particles.push({x:x+4,y:y,vx:rnd(80,220),vy:rnd(-50,50),life:.14,max:.14,size:rnd(2,5),color:'#fff5b5',kind:'spark',rot:0});
    emitAudio(p.weapon === 'rockets' ? 'rocket' : p.weapon === 'laser' ? 'laser' : 'shoot', .4, rnd(.94,1.06));
  }

  private useSpecial() {
    const p = this.player, hero = HEROES[this.selected];
    p.special = 0; this.flash = .35; this.shake = 9; emitAudio('special', 1); emitMusic('special', 1);
    if (hero.id === 'modo') {
      for (const e of this.enemies) { e.hp -= 65; e.flash = .25; }
      this.shots = this.shots.filter(s => s.friendly);
      this.ring(p.x, p.y-p.jump, '#65eaff', 14);
    } else {
      p.specialTime = hero.id === 'vinnie' ? 5.5 : 6.5;
      p.invuln = Math.max(p.invuln, hero.id === 'vinnie' ? 5.5 : 1.4);
      this.ring(p.x, p.y-p.jump, hero.accent, 9);
    }
  }

  private spawnWave() {
    const progress = clamp(this.elapsed / LEVEL_BOSS_TIME, 0, 1);
    const roll = Math.random();
    if (roll < .30) {
      const n = Math.random() < .5 + progress*.25 ? 3 : 2;
      for (let i=0;i<n;i++) this.spawnEnemy('rider', 1010+i*115, rnd(350,448));
    } else if (roll < .54) {
      const n = Math.random() < progress ? 4 : 3;
      for (let i=0;i<n;i++) this.spawnEnemy(i%2 ? 'drone':'skimmer', 1030+i*88, rnd(130,270));
    } else if (roll < .76) {
      this.spawnEnemy('tank', 1020, rnd(360,430));
      if (progress > .25) this.spawnEnemy('drone', 1160, rnd(140,250));
    } else {
      for (let i=0;i<2+Math.floor(progress*2);i++) this.spawnEnemy('drone', 1000+i*115, 145+i%2*65);
      this.spawnEnemy('rider', 1210, rnd(370,435));
    }
    this.spawnClock = rnd(1.7, 3.3) * (1-progress*.28);
  }

  private spawnObstacle() {
    this.spawnEnemy('mine', 1010, rnd(352,445));
    this.obstacleClock = rnd(4.2, 7.5);
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number) {
    const stats: Record<EnemyKind,[number,number,number,number,boolean,number]> = {
      rider:[68,42,35,140,false,450], tank:[94,58,115,36,false,950], drone:[48,30,30,85,true,400], skimmer:[70,32,52,105,true,550], mine:[30,22,20,0,false,175],
      miniboss:[190,100,900,24,false,7000], boss:[260,205,3500,0,true,30000], pod:[55,55,90,90,true,700]
    };
    const [w,h,hp,vx,aerial,score] = stats[kind];
    this.enemies.push({id:++this.enemyId,kind,x,y,w,h,hp,maxHp:hp,vx,vy:0,t:0,fire:rnd(.45,1.8),aerial,phase:rnd(0,Math.PI*2),flash:0,hitReact:0,score});
  }

  private updateEnemies(dt: number, worldSpeed: number) {
    const p = this.player;
    for (const e of this.enemies) {
      e.t += dt; e.flash = Math.max(0,e.flash-dt); e.hitReact = Math.max(0,e.hitReact-dt); e.fire -= dt;
      if (e.kind === 'boss') {
        e.x = lerp(e.x, 705 + Math.sin(e.t*.42)*25, dt*.7);
        e.y = 270 + Math.sin(e.t*.7)*38;
        if (e.fire <= 0) { this.bossPattern(e); e.fire = e.hp/e.maxHp < .45 ? .48 : .75; }
        if (Math.random() < dt*.7 && e.hp < e.maxHp*.68) this.spawnEnemy('pod', e.x+80, e.y+rnd(25,150));
      } else if (e.kind === 'miniboss') {
        e.x = Math.max(670 + Math.sin(e.t)*45, e.x - (worldSpeed*.55+e.vx)*dt);
        e.y = 390 + Math.sin(e.t*.9)*18;
        if (e.fire <= 0) { this.enemyShot(e, 5, .22, 235); e.fire = 1.15; }
      } else if (e.kind === 'pod') {
        e.x -= (e.vx+worldSpeed*.25)*dt; e.y += Math.sin(e.t*5+e.phase)*48*dt;
        if (e.fire <= 0) { this.enemyShot(e,1,0,290); e.fire = 1.5; }
      } else {
        if (!(this.debugBeat && e.kind === 'rider')) e.x -= (worldSpeed + e.vx) * dt;
        if (e.aerial) e.y += Math.sin(e.t*2.7+e.phase)*35*dt;
        else if (e.kind === 'rider' && !this.debugBeat) e.y += clamp(p.y-e.y,-1,1)*22*dt;
        if (!this.debugBeat && e.fire <= 0 && e.kind !== 'mine' && e.x < 900) {
          this.enemyShot(e, e.kind === 'tank' ? 2 : 1, e.kind === 'tank' ? .13 : 0, e.kind === 'tank' ? 235 : 290);
          e.fire = e.kind === 'skimmer' ? 1.25 : rnd(1.6,2.5);
        }
      }
      if (!this.debugBeat && Math.random() < dt * (e.kind==='tank'||e.kind==='miniboss' ? 8 : 2) && !e.aerial) this.dust(e.x-e.w*.45,e.y+e.h*.25,1);
    }
    this.enemies = this.enemies.filter(e => e.x > -300 && e.y < 600 && e.hp > 0);
  }

  private enemyShot(e: Enemy, count: number, spread: number, speed: number) {
    const sx = e.x-e.w*.42, sy=e.y-e.h*.25;
    const base = Math.atan2((this.player.y-this.player.jump-25)-sy, this.player.x-sx);
    for (let i=0;i<count;i++) {
      const a=base+(i-(count-1)/2)*spread;
      this.shots.push({x:sx,y:sy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:e.kind==='boss'?7:4.5,life:5,damage:e.kind==='boss'?16:e.kind==='tank'?13:9,friendly:false,color:e.kind==='boss'?'#b549ff':'#ff542e',kind:e.kind==='boss'?'orb':'enemy',pierce:0,age:0,phase:rnd(0,Math.PI*2)});
    }
    emitAudio('enemy_shoot', .25, rnd(.8,1.2));
  }

  private bossPattern(e: Enemy) {
    const rage = e.hp/e.maxHp < .45;
    const mode = Math.floor(e.t/3)%3;
    if (mode===0) this.enemyShot(e,rage?9:7,.16,rage?285:245);
    else if (mode===1) {
      const n=rage?14:10;
      for(let i=0;i<n;i++){const a=-Math.PI*.7+i/(n-1)*Math.PI*1.4;this.shots.push({x:e.x-85,y:e.y+65,vx:Math.cos(a)*205,vy:Math.sin(a)*205,r:6,life:5,damage:13,friendly:false,color:'#bd48ff',kind:'orb',pierce:0,age:0,phase:i*.73});}
    } else {
      for(let i=0;i<(rage?4:3);i++) setTimeout(()=>{ if(this.mode==='playing'&&e.hp>0)this.enemyShot(e,3,.11,310); },i*145);
    }
    emitAudio('boss_cannon', .65);
  }

  private updateShots(dt: number) {
    for (const s of this.shots) {
      s.age = (s.age ?? 0) + dt;
      if (s.homing && s.friendly) {
        let best: Enemy|undefined, bd=Infinity;
        for(const e of this.enemies){const d=Math.hypot(e.x-s.x,e.y-s.y);if(e.x>s.x&&d<bd){best=e;bd=d;}}
        if(best){const a=Math.atan2(best.y-best.h*.3-s.y,best.x-s.x);s.vx=lerp(s.vx,Math.cos(a)*470,dt*2.7);s.vy=lerp(s.vy,Math.sin(a)*470,dt*2.7);}
        if(Math.random()<dt*25)this.particles.push({x:s.x,y:s.y,vx:rnd(-80,-30),vy:rnd(-15,15),life:.32,max:.32,size:rnd(3,6),color:'#d7d7d7',kind:'smoke',rot:0});
      }
      s.x += s.vx*dt; s.y += s.vy*dt; s.life-=dt;
    }
    this.shots=this.shots.filter(s=>s.life>0&&s.x>-40&&s.x<W+70&&s.y>-50&&s.y<H+50);
  }

  private updatePickups(dt:number,worldSpeed:number){
    for(const q of this.pickups){q.x-=worldSpeed*.55*dt;q.t+=dt;q.y+=Math.sin(q.t*4)*9*dt;}
    this.pickups=this.pickups.filter(q=>q.x>-40);
  }

  private updateParticles(dt:number,worldSpeed:number){
    for(const q of this.particles){q.life-=dt;q.x+=(q.vx-worldSpeed*(q.kind==='dust'? .32:0))*dt;q.y+=q.vy*dt;q.vy+=(q.kind==='spark'||q.kind==='shard'||q.kind==='debris'?290:q.kind==='smoke'?-15:0)*dt;q.vx*=Math.pow(q.kind==='blast'?.02:.2,dt);q.rot+=dt*(q.kind==='blast'?1.4:5);}
    this.particles=this.particles.filter(q=>q.life>0);
    for(const f of this.floaters){f.life-=dt;f.y-=28*dt;}
    this.floaters=this.floaters.filter(f=>f.life>0);
  }

  private handleCollisions(){
    const p=this.player;
    const pr={x:p.x-29,y:p.y-p.jump-46,w:64,h:48};
    for(const s of this.shots){
      if(s.friendly){
        for(const e of this.enemies){
          const er={x:e.x-e.w/2,y:e.y-e.h/2,w:e.w,h:e.h};
          if(s.life>0&&hit({x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2},er)){
            e.hp-=s.damage;e.flash=e.kind==='boss'? .14:.09;if(e.kind==='rider')e.hitReact=this.debugBeat?1.75:.72;this.hitFx(s.x,s.y,s.color,s.kind==='laser'?2:3);this.comboClock=1.15;this.combo=clamp(this.combo+.055,1,9.9);this.score+=Math.ceil(3*this.combo);p.special=clamp(p.special+.42,0,100);
            if(e.kind==='boss'||e.kind==='miniboss')this.shake=Math.max(this.shake,s.kind==='rockets'?2.1:1.35);
            if(s.kind==='rockets'){this.blast(s.x,s.y,35,s.color,undefined,2.1);for(const other of this.enemies)if(Math.hypot(other.x-s.x,other.y-s.y)<74)other.hp-=s.damage*.45;}
            if(s.pierce>0)s.pierce--;else s.life=0;
            if(e.hp<=0)this.killEnemy(e);
            break;
          }
        }
      } else if(s.life>0&&p.invuln<=0&&hit({x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2},pr)){s.life=0;this.damagePlayer(s.damage,s.x,s.y);}
    }
    for(const e of this.enemies){
      if(e.hp<=0)continue;
      const jumpSafe=!e.aerial&&p.jump>44;
      if(!jumpSafe&&p.invuln<=0&&hit(pr,{x:e.x-e.w*.42,y:e.y-e.h*.45,w:e.w*.84,h:e.h*.84})){
        this.damagePlayer(e.kind==='boss'?28:e.kind==='mine'?24:16,e.x,e.y);e.hp-=e.kind==='boss'?10:35;if(e.hp<=0)this.killEnemy(e);
      }
    }
    for(const q of this.pickups){
      if(q.t>=0&&hit(pr,{x:q.x-15,y:q.y-15,w:30,h:30})){q.t=-999;this.collect(q);}
    }
    this.pickups=this.pickups.filter(q=>q.t>-100);
  }

  private damagePlayer(amount:number,x:number,y:number){
    const p=this.player;
    if(p.armor>0){const soaked=Math.min(p.armor,amount*.72);p.armor-=soaked;amount-=soaked;}
    p.hp-=amount;p.invuln=.95;this.shake=12;this.flash=.22;this.combo=1;this.comboClock=0;this.blast(x,y,25,'#ff6838');emitAudio('player_hit',.8);
    if(p.hp<=0){p.hp=0;this.blast(p.x,p.y-p.jump,70,'#ff4b2e',32);this.finishRun(false);}
  }

  private killEnemy(e:Enemy){
    if(e.hp<-10000)return;e.hp=-10001;this.kills++;const mult=Math.max(1,Math.floor(this.combo));const gain=e.score*mult;this.score+=gain;this.player.special=clamp(this.player.special+(e.kind==='boss'?100:e.kind==='miniboss'?40:5),0,100);
    this.floaters.push({x:e.x,y:e.y-e.h*.6,text:`+${gain.toLocaleString()}`,color:mult>=4?'#fff16a':'#fff',life:1});
    this.blast(e.x,e.y,e.kind==='boss'?145:e.kind==='miniboss'?90:e.kind==='tank'?44:25,e.kind==='boss'?'#c74cff':'#ff6338',e.kind==='boss'?80:e.kind==='miniboss'?45:undefined);
    emitAudio(e.kind==='boss'?'boss_explode':'explode',e.kind==='boss'?1:.55,rnd(.85,1.12));
    if(e.kind==='boss'){this.bossDefeated=true;this.shots=this.shots.filter(s=>s.friendly);emitMusic('victory');}
    else if(e.kind==='miniboss'){this.pickups.push({x:e.x,y:e.y-45,kind:'weapon',t:0},{x:e.x+42,y:e.y,kind:'health',t:0});emitMusic('stage',.95);}
    else if(Math.random()<(e.kind==='tank'?.52:.13))this.dropPickup(e.x,e.y);
  }

  private dropPickup(x:number,y:number){const kinds:PickupKind[]=['health','armor','weapon','rapid','score'];const r=Math.random();const kind=r<.18?'health':r<.36?'armor':r<.62?'weapon':r<.81?'rapid':'score';this.pickups.push({x,y:y-18,kind,t:0});}
  private collect(q:Pickup){const p=this.player;let label='';
    if(q.kind==='health'){p.hp=Math.min(HEROES[this.selected].maxHp,p.hp+35);label='ENERGY +35';}
    else if(q.kind==='armor'){p.armor=Math.min(HEROES[this.selected].maxArmor,p.armor+32);label='ARMOR UP';}
    else if(q.kind==='rapid'){p.rapid=12;label='RAPID FIRE';}
    else if(q.kind==='score'){this.score+=2500*Math.floor(this.combo);label='MARS JACKPOT';}
    else {const order:Weapon[]=['blaster','spread','laser','rockets'];const next=order[(order.indexOf(p.weapon)+1)%order.length];if(Math.random()<.56&&p.weaponRank<4){p.weaponRank++;label=`${p.weapon.toUpperCase()} LV.${p.weaponRank}`;}else{p.weapon=next;p.weaponRank=Math.max(1,p.weaponRank-1);label=next.toUpperCase();}}
    this.floaters.push({x:q.x,y:q.y-18,text:label,color:'#72ffdb',life:1.5});this.ring(q.x,q.y,'#72ffdb',5);emitAudio('pickup',.8);
  }

  private finishRun(win:boolean){
    if(this.mode!=='playing')return;
    this.mode=win?'win':'lose';this.saveScore();emitMusic(win?'victory':'defeat');emitAudio(win?'stage_clear':'game_over');
  }

  private saveScore(){const name=HEROES[this.selected].name;this.highScores.push({name,score:Math.floor(this.score)});this.highScores.sort((a,b)=>b.score-a.score);this.highScores=this.highScores.slice(0,5);try{localStorage.setItem('redline-highscores',JSON.stringify(this.highScores));}catch{/* private storage */}}
  private loadScores(){try{const raw=localStorage.getItem('redline-highscores');if(raw)this.highScores=JSON.parse(raw);}catch{this.highScores=[];}}

  debugStart(hero:HeroId='throttle'){this.selected=Math.max(0,HEROES.findIndex(h=>h.id===hero));this.beginRun();}
  debugMiniboss(){if(this.mode!=='playing')this.debugStart();this.debugBeat=false;this.elapsed=145;this.enemies=[];this.shots=[];this.particles=[];this.floaters=[];}
  debugBoss(){
    if(this.mode!=='playing')this.debugStart();
    this.debugBeat=false;
    this.elapsed=LEVEL_BOSS_TIME;this.enemies=[];this.minibossSpawned=true;this.bossSpawned=true;this.bossDefeated=false;
    this.player.weapon='rockets';this.player.weaponRank=4;this.player.special=100;this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.spawnEnemy('boss',930,295);emitMusic('boss');emitAudio('warning');
  }

  debugCombatBeat(){
    this.debugStart('throttle');this.debugBeat=true;this.elapsed=92;this.spawnClock=999;this.obstacleClock=999;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.floaters=[];
    this.player.x=168;this.player.y=406;this.player.weapon='blaster';this.player.weaponRank=1;
    this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;this.player.cooldown=0;this.player.recoil=0;
    // The raider occupies the upper road lane so the hero's horizontal blaster
    // crosses its real gameplay hitbox (no capture-only collision shortcut).
    this.spawnEnemy('rider',820,390);const rider=this.enemies[0];rider.hp=160;rider.maxHp=160;rider.fire=999;
  }

  snapshot() {
    const boss = this.enemies.find(e => e.kind === 'boss' || e.kind === 'miniboss');
    return {
      state: this.mode, hero: HEROES[this.selected].id, score: Math.floor(this.score),
      health: this.player?.hp ?? null, armor: this.player?.armor ?? null,
      enemies: this.enemies.length, boss: boss ? { kind: boss.kind, health: boss.hp, maxHealth: boss.maxHp } : null,
      elapsed: Number(this.elapsed.toFixed(2)), combo: Number(this.combo.toFixed(1)), weapon: this.player?.weapon ?? null,
      beat: this.debugBeat ? { riderReaction: Number((this.enemies[0]?.hitReact ?? 0).toFixed(2)), shots: this.shots.filter(s=>s.friendly).length } : null
    };
  }

  gotoScene(scene: string, time = 0) {
    if (scene === 'title') { this.mode = 'title'; emitMusic('title'); }
    else if (scene === 'select') { this.mode = 'select'; emitMusic('select'); }
    else if (scene === 'boss') this.debugBoss();
    else if (scene === 'miniboss') this.debugMiniboss();
    else if (scene === 'beat') this.debugCombatBeat();
    else { this.beginRun(); this.elapsed = clamp(time, 0, LEVEL_BOSS_TIME); }
    return this.snapshot();
  }

  private dust(x:number,y:number,count:number){for(let i=0;i<count;i++)this.particles.push({x:x+rnd(-8,8),y:y+rnd(-3,3),vx:rnd(-75,-20),vy:rnd(-55,-10),life:rnd(.25,.55),max:.55,size:rnd(3,9),color:Math.random()<.5?'#d08a55':'#8c5a4c',kind:'dust',rot:rnd(0,6)});}
  private hitFx(x:number,y:number,color:string,count:number){
    // A compact six-frame read: white-hot contact, three directional chips, then residue.
    this.particles.push({x,y,vx:0,vy:0,life:.105,max:.105,size:10,color:'#fffceb',kind:'impact',rot:rnd(0,Math.PI)});
    const shards=Math.max(2,Math.min(3,count));
    for(let i=0;i<shards;i++){
      const a=(-.9+i/(Math.max(1,shards-1))*1.8)+rnd(-.25,.25),v=rnd(115,215);
      this.particles.push({x:x+rnd(-2,2),y:y+rnd(-2,2),vx:-Math.abs(Math.cos(a)*v),vy:Math.sin(a)*v,life:rnd(.12,.18),max:.18,size:rnd(3,5),color:i===1?'#fff':color,kind:'shard',rot:a});
    }
    this.particles.push({x:x-3,y:y+1,vx:rnd(-34,-12),vy:rnd(-28,-12),life:.34,max:.34,size:4.5,color:'#393044',kind:'smoke',rot:0});
  }
  private ring(x:number,y:number,color:string,count:number){for(let i=0;i<count;i++){const a=i/count*Math.PI*2;this.particles.push({x,y,vx:Math.cos(a)*rnd(110,250),vy:Math.sin(a)*rnd(110,250),life:.52,max:.52,size:rnd(4,9),color,kind:'ring',rot:a});}}
  private blast(x:number,y:number,size:number,color:string,count=Math.round(size*.42),shakeCap?:number){
    const hitShake=shakeCap===undefined?size*.12:Math.min(size*.12,shakeCap);
    const screenFlash=shakeCap===undefined?Math.min(.34,size/360):Math.min(.045,size/900);
    this.shake=Math.max(this.shake,hitShake);this.flash=Math.max(this.flash,screenFlash);
    // The expanding core supplies a crisp anticipation/core/ring/remainder sequence.
    this.particles.push({x,y,vx:0,vy:0,life:.3,max:.3,size,color,kind:'blast',rot:rnd(0,Math.PI*2)});
    for(let i=0;i<count;i++){const a=rnd(0,Math.PI*2),v=rnd(size*.8,size*3.2),k=Math.random();this.particles.push({x:x+rnd(-size*.2,size*.2),y:y+rnd(-size*.15,size*.15),vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.25,.75),max:.75,size:rnd(size*.04,size*.16),color:k<.24?'#fff6be':k<.61?color:k<.82?'#ffb52e':'#492039',kind:k<.55?'fire':k<.76?'spark':'debris',rot:rnd(0,6)});}
    for(let i=0;i<Math.max(3,size/12);i++)this.particles.push({x:x+rnd(-size*.25,size*.25),y:y+rnd(-size*.2,size*.2),vx:rnd(-50,40),vy:rnd(-85,-20),life:rnd(.5,1.25),max:1.25,size:rnd(size*.08,size*.22),color:'#30243a',kind:'smoke',rot:0});
  }

  private draw(){
    const c=this.ctx;c.save();
    const sx=this.shake>0?rnd(-this.shake,this.shake):0,sy=this.shake>0?rnd(-this.shake*.55,this.shake*.55):0;c.translate(Math.round(sx),Math.round(sy));
    if(this.mode==='title')this.drawTitle();
    else if(this.mode==='select')this.drawSelect();
    else this.drawWorld();
    c.restore();
    if(this.mode!=='title'&&this.mode!=='select'){
      this.drawHud();
      if(this.bossSpawned&&!this.bossDefeated&&this.enemies.some(e=>e.kind==='boss'))this.drawWarningEdges();
      if(this.mode==='paused')this.drawPause();else if(this.mode==='win'||this.mode==='lose')this.drawEnding();
    }
    if(this.flash>0){c.fillStyle=`rgba(255,245,210,${this.flash})`;c.fillRect(0,0,W,H);}
  }

  private drawWorld(){
    const c=this.ctx;
    const intensity=clamp(.78+this.enemies.length*.025+(this.bossSpawned ? .28 : 0)+(this.combo-1)*.018,.78,1.45);
    const environment={scroll:this.distance,elapsed:this.elapsed,speed:this.worldSpeed,time:this.time,shake:this.shake,intensity};
    drawEnvironment(c,environment);
    for(const q of this.pickups)this.drawPickup(q);
    const ordered=[...this.enemies].sort((a,b)=>a.y-b.y);for(const e of ordered)this.drawEnemy(e);
    if(this.player)this.drawPlayer();
    for(const s of this.shots)this.drawShot(s);
    for(const q of this.particles)this.drawParticle(q);
    drawEnvironmentForeground(c,environment);
    for(const f of this.floaters){c.globalAlpha=clamp(f.life*2,0,1);this.text(f.text,f.x,f.y,17,f.color,'center',true);c.globalAlpha=1;}
  }

  private drawPlayer(){
    const c=this.ctx,p=this.player,h=HEROES[this.selected],x=p.x,y=p.y-p.jump;
    const rideFrame=((Math.floor(p.wheel)%6)+6)%6;
    const firing=p.cooldown>0&&p.recoil>.034;
    const recoil=clamp(p.recoil/.072,0,1);
    // Keep invulnerability readable without bleaching the hero into a featureless white cutout.
    const hitFlash=p.invuln>0&&Math.floor(p.invuln*22)%2===0?.32:0;
    c.save();c.globalAlpha=.27;c.fillStyle='#000';c.beginPath();c.ellipse(x-5,p.y+15,54,11,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    if(p.specialTime>0){c.strokeStyle=h.accent;c.lineWidth=2;c.globalAlpha=.4+.25*Math.sin(this.time*18);for(let i=0;i<3;i++){c.beginPath();c.ellipse(x-10-i*7,y,62+i*7,27+i*3,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}
    c.scale(2,2);
    drawPixelHero(c,h.id,x/2,y/2,{frame:rideFrame,angle:p.lean*.055-p.jumpV*.00008,power:p.specialTime>0?1:clamp(.76+this.worldSpeed/h.speed*.18,.76,.96),firing,airborne:p.jump>1,flash:hitFlash,recoil});
    c.restore();
    if(firing)this.drawMuzzle(x+55,y-35,p.weapon,recoil>.72?0:1);
  }

  private drawMuzzle(x:number,y:number,weapon:Weapon,phase:number){
    const c=this.ctx;c.save();c.translate(Math.round(x),Math.round(y));c.globalCompositeOperation='lighter';
    const long=phase===0?1:.72;
    if(weapon==='blaster'){
      c.fillStyle='#ff8a35';c.beginPath();c.moveTo(0,-7);c.lineTo(30*long,0);c.lineTo(0,7);c.lineTo(6,0);c.fill();
      c.fillStyle='#fffbd1';c.beginPath();c.moveTo(1,-3);c.lineTo(22*long,0);c.lineTo(1,3);c.fill();
    }else if(weapon==='spread'){
      for(const sy of [-1,0,1]){c.fillStyle=sy===0?'#eaffff':'#58eaff';c.beginPath();c.moveTo(0,sy*3);c.lineTo((24-Math.abs(sy)*5)*long,sy*11);c.lineTo(5,sy*4+(sy||1)*2);c.fill();}
      c.fillStyle='#fff';c.fillRect(0,-2,12*long,4);
    }else if(weapon==='laser'){
      c.fillStyle='#ff3ca6';c.fillRect(0,-5,27*long,10);c.fillStyle='#fff';c.fillRect(1,-2,35*long,4);c.fillStyle='#ff9fdb';c.fillRect(8,-7,4,14);
    }else{
      c.fillStyle='#ff6338';c.beginPath();c.arc(4,0,(phase===0?9:6),0,Math.PI*2);c.fill();c.fillStyle='#fff4bd';c.fillRect(2,-4,18*long,8);c.fillStyle='#ffb52e';c.fillRect(15*long,-2,12*long,4);
    }
    c.restore();
  }

  private wheel(x:number,y:number,r:number,spin:number,accent:string){const c=this.ctx;c.fillStyle='#05060a';c.beginPath();c.arc(x,y,r+4,0,Math.PI*2);c.fill();c.strokeStyle='#4f5361';c.lineWidth=4;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.strokeStyle=accent;c.lineWidth=2;for(let i=0;i<6;i++){const a=spin+i*Math.PI/3;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.stroke();}c.fillStyle='#d0d5dc';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}

  private drawEnemy(e:Enemy){
    const c=this.ctx;
    if(e.kind==='rider'||e.kind==='tank'||e.kind==='drone'||e.kind==='skimmer'||e.kind==='miniboss'||e.kind==='boss'){
      c.save();
      if(e.kind==='miniboss'||e.kind==='boss'){c.globalAlpha=.28;c.fillStyle=e.kind==='boss'?'#c339ff':'#000';c.beginPath();c.ellipse(e.x,e.y+(e.kind==='boss'?70:48),e.kind==='boss'?150:105,e.kind==='boss'?34:18,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}
      c.scale(2,2);
      const reaction=e.kind==='rider'?(e.hitReact>.48?1:e.hitReact>0?2:0):0;
      const options={frame:Math.floor(e.t*8),flipX:true,flash:clamp(e.flash*8,0,1),power:1-e.hp/e.maxHp,reaction};
      if(e.kind==='miniboss')drawPixelBoss(c,'roadReaper',e.x/2,e.y/2,{...options,scale:.84});
      else if(e.kind==='boss')drawPixelBoss(c,'plutarkianDreadnought',e.x/2,e.y/2,options);
      else {
        const kind=e.kind==='rider'?'raider':e.kind==='tank'?'turret':e.kind==='drone'?'drone':'bomber';
        drawPixelEnemy(c,kind,e.x/2,e.y/2,{...options,scale:e.kind==='tank'?1.16:1});
      }
      c.restore();
      if((e.kind==='boss'||e.kind==='miniboss')&&e.flash>0){
        const heat=clamp(e.flash/.14,0,1),radius=e.kind==='boss'?82:48;
        c.save();c.globalCompositeOperation='screen';const glow=c.createRadialGradient(e.x-e.w*.2,e.y-e.h*.12,2,e.x-e.w*.2,e.y-e.h*.12,radius);glow.addColorStop(0,`rgba(255,252,214,${heat*.5})`);glow.addColorStop(.28,`rgba(255,157,74,${heat*.28})`);glow.addColorStop(1,'rgba(255,72,34,0)');c.fillStyle=glow;c.fillRect(e.x-e.w*.55,e.y-e.h*.55,e.w,e.h);c.restore();
      }
      return;
    }
    c.save();c.translate(e.x,e.y);if(e.flash>0){c.shadowBlur=18;c.shadowColor='#fff';}const flash=e.flash>0?'#fff':null;
    if(e.kind==='mine'){
      c.rotate(e.t*2);c.fillStyle=flash||'#782f50';for(let i=0;i<8;i++){c.rotate(Math.PI/4);c.fillRect(9,-3,18,6);}c.beginPath();c.arc(0,0,14,0,Math.PI*2);c.fill();c.fillStyle='#ffdf57';c.beginPath();c.arc(0,0,5+Math.sin(e.t*9)*2,0,Math.PI*2);c.fill();
    }else{
      c.rotate(e.t);c.fillStyle=flash||'#773dac';c.fillRect(-19,-19,38,38);c.fillStyle='#cf77ff';c.fillRect(-12,-12,24,24);c.fillStyle='#100d1b';c.fillRect(-5,-5,10,10);c.strokeStyle='#f55bda';c.strokeRect(-23,-23,46,46);
    }
    c.restore();
  }

  private drawShot(s:Projectile){
    const c=this.ctx,age=s.age??0,pulse=.5+.5*Math.sin(age*28+(s.phase??0));c.save();c.translate(Math.round(s.x),Math.round(s.y));c.rotate(Math.atan2(s.vy,s.vx));c.shadowBlur=7+pulse*5;c.shadowColor=s.color;
    if(s.kind==='blaster'){
      c.fillStyle='#ff772b99';c.beginPath();c.moveTo(-24-pulse*5,0);c.lineTo(-7,-5);c.lineTo(-7,5);c.fill();c.fillStyle='#ffd943';c.beginPath();c.moveTo(13,0);c.lineTo(-4,-6);c.lineTo(-12,0);c.lineTo(-4,6);c.fill();c.fillStyle='#fffbd5';c.fillRect(-3,-2,13,4);
    }else if(s.kind==='spread'){
      c.fillStyle='#35ddec77';c.beginPath();c.moveTo(-18-pulse*4,0);c.lineTo(-3,-6);c.lineTo(-3,6);c.fill();c.fillStyle='#62f5ff';c.beginPath();c.arc(1,0,s.r+1+pulse,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillRect(-2,-2,7,4);c.fillStyle='#1c9fbd';c.fillRect(-7,-6,7,2);c.fillRect(-7,4,7,2);
    }else if(s.kind==='laser'){
      c.globalAlpha=.35;c.fillStyle='#ff299c';c.fillRect(-34-pulse*10,-5,48+pulse*10,10);c.globalAlpha=1;c.fillStyle='#ff65bd';c.fillRect(-24,-3,45,6);c.fillStyle='#fff';c.fillRect(-15,-1,38,2);c.fillStyle='#ffc6eb';c.fillRect(15,-5,7,10);
    }else if(s.kind==='rockets'){
      c.fillStyle='#ff5b2f66';c.beginPath();c.moveTo(-28-pulse*8,0);c.lineTo(-8,-7);c.lineTo(-8,7);c.fill();c.fillStyle='#ffd052';c.beginPath();c.moveTo(-21-pulse*4,0);c.lineTo(-8,-4);c.lineTo(-8,4);c.fill();c.fillStyle='#16131d';c.fillRect(-10,-6,20,12);c.fillStyle='#dedbe6';c.fillRect(-8,-4,18,8);c.fillStyle='#ff7040';c.beginPath();c.moveTo(12,0);c.lineTo(7,-5);c.lineTo(7,5);c.fill();c.fillStyle='#8f8a9e';c.fillRect(-7,-7,7,3);c.fillRect(-7,4,7,3);
    }else if(s.kind==='orb'){
      const halo=Math.floor(age*15+(s.phase??0))%3;c.globalCompositeOperation='lighter';c.globalAlpha=.18+halo*.07;c.fillStyle=s.color;c.beginPath();c.arc(0,0,s.r+7+halo*3,0,Math.PI*2);c.fill();c.globalAlpha=.48;c.beginPath();c.arc(0,0,s.r+3+((halo+1)%3),0,Math.PI*2);c.fill();c.globalAlpha=1;c.fillStyle='#6b187d';c.beginPath();c.arc(0,0,s.r+1,0,Math.PI*2);c.fill();c.fillStyle=s.color;c.beginPath();c.arc(0,0,s.r*.72,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillRect(-3,-3,4,4);
    }else{
      c.fillStyle='#421026';c.beginPath();c.moveTo(10,0);c.lineTo(-6,-7);c.lineTo(-15,0);c.lineTo(-6,7);c.fill();c.fillStyle=s.color;c.beginPath();c.moveTo(9,0);c.lineTo(-4,-4);c.lineTo(-11,0);c.lineTo(-4,4);c.fill();c.fillStyle='#fff0d1';c.fillRect(0,-2,6,4);c.fillStyle='#ff3c2d77';c.fillRect(-19-pulse*4,-2,9+pulse*4,4);
    }
    c.restore();
  }

  private drawPickup(q:Pickup){
    const c=this.ctx;
    const kind=q.kind==='health'?'health':q.kind==='armor'?'armor':q.kind==='rapid'?'overdrive':q.kind==='score'?'score':this.player.weapon==='rockets'?'rocket':this.player.weapon==='spread'?'spread':'plasma';
    c.save();c.scale(2,2);drawPixelPickup(c,kind,q.x/2,q.y/2,{frame:Math.floor(this.time*10),scale:.82});c.restore();
  }

  private drawParticle(q:Particle){
    const c=this.ctx,a=clamp(q.life/q.max,0,1),progress=1-a;c.save();c.globalAlpha=a;c.translate(Math.round(q.x),Math.round(q.y));c.rotate(q.rot);
    if(q.kind==='smoke'||q.kind==='dust'){
      c.fillStyle=q.color;const r=q.size*(1.35+progress*.65);c.fillRect(-r,-r*.55,r*1.25,r*1.1);c.globalAlpha=a*.55;c.fillRect(-r*.25,-r*.9,r*1.1,r);
    }else if(q.kind==='impact'){
      c.globalCompositeOperation='lighter';const r=q.size*(.75+progress*.65);c.fillStyle=q.color;c.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*.35:r,ang=i*Math.PI/4;c.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr);}c.closePath();c.fill();c.fillStyle='#ff9b45';c.fillRect(-r*.18,-r*1.25,r*.36,r*2.5);
    }else if(q.kind==='shard'){
      c.fillStyle=q.color;c.beginPath();c.moveTo(q.size*1.5,0);c.lineTo(-q.size,-q.size*.45);c.lineTo(-q.size*.45,q.size*.45);c.closePath();c.fill();c.fillStyle='#fff';c.fillRect(0,-1,q.size*.75,2);
    }else if(q.kind==='blast'){
      const r=q.size*(.18+progress*.86);c.globalCompositeOperation='lighter';c.globalAlpha=Math.min(1,a*1.7);c.fillStyle=progress<.22?'#fffde0':progress<.58?'#ffad35':q.color;c.beginPath();for(let i=0;i<16;i++){const rr=i%2?r:r*(.58+.08*Math.sin(q.rot+i));const ang=i*Math.PI/8;c.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr);}c.closePath();c.fill();c.globalAlpha=a*.9;c.strokeStyle=progress<.35?'#fff8c7':'#ff6638';c.lineWidth=Math.max(2,q.size*.07*(1-progress));c.beginPath();c.arc(0,0,r*1.08,0,Math.PI*2);c.stroke();if(progress>.42){c.globalAlpha=a*.65;c.strokeStyle=q.color;c.lineWidth=2;c.beginPath();c.arc(0,0,r*1.28,0,Math.PI*2);c.stroke();}
    }else if(q.kind==='spark'){
      c.strokeStyle=q.color;c.lineWidth=Math.max(1,q.size*.45);c.beginPath();c.moveTo(0,0);c.lineTo(-q.vx*.035,-q.vy*.035);c.stroke();
    }else if(q.kind==='ring'){
      c.strokeStyle=q.color;c.lineWidth=2;c.beginPath();c.arc(0,0,q.size*(1-a+1),0,Math.PI*2);c.stroke();
    }else{c.fillStyle=q.color;c.fillRect(-q.size/2,-q.size/2,q.size,q.size);}
    c.restore();
  }

  private drawHud(){
    const c=this.ctx,p=this.player,h=HEROES[this.selected];
    c.fillStyle='#080913df';c.fillRect(14,9,264,47);c.strokeStyle=h.accent;c.lineWidth=2;c.strokeRect(15,10,262,45);
    this.text(h.name,24,27,13,h.accent,'left',true);this.text(this.score.toString().padStart(8,'0'),268,28,15,'#fff','right',true);
    this.text(`HP ${Math.ceil(p.hp)}/${h.maxHp}`,24,45,9,'#ffafba', 'left', true);this.meter(91,36,78,9,p.hp/h.maxHp,'#ef425f','#521b2e');
    this.text(`AR ${Math.ceil(p.armor)}/${h.maxArmor}`,178,45,9,'#c1f5ff', 'left', true);this.meter(235,36,32,9,p.armor/h.maxArmor,'#57d6ff','#15334c');
    c.fillStyle='#080913df';c.fillRect(708,9,238,47);c.strokeStyle='#6e4c88';c.strokeRect(709,10,236,45);
    this.text(`${p.weapon.toUpperCase()} LV.${p.weaponRank}`,720,28,13,'#ffd55d','left',true);this.text(`x${this.combo.toFixed(1)}`,934,29,18,this.combo>=4?'#fff26c':'#ff6fab','right',true);
    this.text(`SP ${Math.floor(p.special)}%`,720,47,9,h.accent,'left',true);this.meter(770,37,164,9,p.special/100,h.accent,'#30223d');
    const progress=this.bossSpawned?1:this.elapsed/LEVEL_BOSS_TIME;c.fillStyle='#05050bd9';c.fillRect(299,12,388,10);c.fillStyle='#593457';c.fillRect(302,15,382,4);c.fillStyle='#ff784c';c.fillRect(302,15,382*clamp(progress,0,1),4);c.fillStyle='#fff';c.fillRect(302+382*(145/LEVEL_BOSS_TIME),10,2,14);this.text(this.bossSpawned?'FINAL ASSAULT':`${Math.max(0,LEVEL_BOSS_TIME-this.elapsed)|0}s TO TARGET`,493,40,11,'#ead9ee','center',true);
    const boss=this.enemies.find(e=>e.kind==='boss'||e.kind==='miniboss');if(boss){c.fillStyle='#090613e6';c.fillRect(212,486,536,40);this.text(boss.kind==='boss'?'LIMBURGER DREADNAUGHT':'ROAD-RIPPER MK.IV',480,501,14,boss.kind==='boss'?'#df76ff':'#ff7f5c','center',true);this.meter(229,507,502,10,boss.hp/boss.maxHp,boss.kind==='boss'?'#bd45e9':'#ff554b','#30152b');}
  }

  private meter(x:number,y:number,w:number,h:number,value:number,color:string,bg:string){const c=this.ctx;c.fillStyle=bg;c.fillRect(x,y,w,h);c.fillStyle=color;c.fillRect(x+2,y+2,(w-4)*clamp(value,0,1),h-4);c.fillStyle='#ffffff55';c.fillRect(x+2,y+2,(w-4)*clamp(value,0,1),2);}

  private drawWarningEdges(){const c=this.ctx,a=.16+.1*Math.sin(this.time*7);c.fillStyle=`rgba(255,35,88,${a})`;c.fillRect(0,0,8,H);c.fillRect(W-8,0,8,H);}

  private drawTitle(){
    const c=this.ctx;drawEnvironment(c,{scroll:this.time*115,elapsed:24,speed:345,time:this.time,shake:0,intensity:.9});
    if(this.titleArt.complete&&this.titleArt.naturalWidth>0){
      const scale=Math.max(W/this.titleArt.naturalWidth,H/this.titleArt.naturalHeight),dw=this.titleArt.naturalWidth*scale,dh=this.titleArt.naturalHeight*scale;
      c.globalAlpha=.78;c.drawImage(this.titleArt,(W-dw)/2,(H-dh)/2,dw,dh);c.globalAlpha=1;
    }
    const shade=c.createLinearGradient(0,0,W,0);shade.addColorStop(0,'rgba(3,2,10,.92)');shade.addColorStop(.55,'rgba(5,2,12,.32)');shade.addColorStop(1,'rgba(3,2,10,.83)');c.fillStyle=shade;c.fillRect(0,0,W,H);
    c.save();c.translate(57,64);c.transform(1,0,-.12,1,0,0);c.fillStyle='#14091f';c.strokeStyle='#ef3f69';c.lineWidth=4;c.fillRect(0,0,520,151);c.strokeRect(0,0,520,151);c.fillStyle='#ffcf47';c.fillRect(20,17,480,4);this.text('BIKER MICE',260,67,52,'#f4e4d2','center',true);this.text('FROM MARS',260,105,25,'#ff5b73','center',true);c.fillStyle='#5de4e0';c.beginPath();c.moveTo(34,121);c.lineTo(203,121);c.lineTo(220,112);c.lineTo(482,112);c.lineTo(455,128);c.lineTo(45,128);c.fill();c.restore();
    c.save();c.translate(92,231);c.rotate(-.025);c.shadowColor='#b922ff';c.shadowBlur=28;this.text('REDLINE',0,61,64,'#fff36b','left',true);this.text('RAMPAGE',3,120,67,'#ff496e','left',true);c.shadowBlur=0;c.restore();
    const pulse=.75+.25*Math.sin(this.time*5);for(let i=0;i<2;i++){const active=this.titleChoice===i;c.fillStyle=active?'#ff456b':'#151022dd';c.fillRect(104,387+i*45,274,34);c.strokeStyle=active?'#ffe360':'#4d365d';c.lineWidth=2;c.strokeRect(104,387+i*45,274,34);if(active){c.globalAlpha=pulse;c.fillStyle='#fff26c';c.beginPath();c.moveTo(87,404+i*45);c.lineTo(99,396+i*45);c.lineTo(99,412+i*45);c.fill();c.globalAlpha=1;}this.text(i===0?'RIDE INTO BATTLE':'CLEAR RECORDS',241,410+i*45,19,active?'#fff':'#9e90ac','center',true);}
    c.fillStyle='#090713dd';c.fillRect(646,326,264,152);c.strokeStyle='#74455f';c.strokeRect(646,326,264,152);this.text('HALL OF FIRE',778,351,18,'#ffcd4c','center',true);
    if(this.highScores.length){this.highScores.slice(0,4).forEach((s,i)=>{this.text(`${i+1}. ${s.name}`,664,380+i*24,13,'#d9cadf');this.text(s.score.toLocaleString(),892,380+i*24,13,'#fff','right');});}else this.text('THE ROAD AWAITS…',778,410,14,'#776c82','center');
    this.text('ENTER / Z  SELECT     ↑↓  MOVE',480,517,14,'#e3d9e8','center',true);this.text('A LOCAL FAN PROTOTYPE',899,22,10,'#887995','right');
  }

  private drawSelect(){
    const c=this.ctx;drawEnvironment(c,{scroll:this.time*58,elapsed:82,speed:185,time:this.time,shake:0,intensity:.55});c.fillStyle='#080512b8';c.fillRect(0,0,W,H);this.text('CHOOSE YOUR RIDER',480,54,34,'#fff16d','center',true);this.text('THREE RIDERS. ONE REDLINE.',480,82,13,'#c7a5d4','center');
    for(let i=0;i<HEROES.length;i++){
      const h=HEROES[i],active=i===this.selected,x=51+i*299,y=106,w=260,hh=337;c.save();
      c.fillStyle=active?'#21152fef':'#0b0915dd';c.fillRect(x,y,w,hh);c.strokeStyle=active?h.accent:'#3a2e48';c.lineWidth=active?4:2;c.strokeRect(x,y,w,hh);
      if(active){c.globalAlpha=.13;c.fillStyle=h.accent;for(let xx=x-60;xx<x+w;xx+=23){c.beginPath();c.moveTo(xx,y+220);c.lineTo(xx+100,y);c.lineTo(xx+112,y);c.lineTo(xx+12,y+220);c.fill();}c.globalAlpha=1;}
      c.save();c.beginPath();c.rect(x+5,y+5,w-10,203);c.clip();this.drawPortrait(h,x+w/2,y+154,active?1.18:1);c.restore();
      c.fillStyle='#080710d9';c.fillRect(x+10,y+207,w-20,118);this.text(h.name,x+w/2,y+237,26,active?h.accent:'#afa4b6','center',true);this.text(h.epithet,x+w/2,y+258,11,'#e5d6e7','center');
      const names=['POWER','SPEED','ARMOR'];names.forEach((name,n)=>{this.text(name,x+22,y+280+n*17,10,'#a597ae');for(let s=0;s<5;s++){c.fillStyle=s<h.stats[n]?(active?h.accent:'#786c82'):'#292231';c.fillRect(x+104+s*23,y+271+n*17,17,8);}});
      c.fillStyle=active?h.accent:'#342a3d';c.fillRect(x+10,y+328,w-20,2);this.text(h.weapon.toUpperCase(),x+20,y+352,12,'#ffd861');this.text(h.special,x+w-20,y+352,12,'#92f4e5','right');
      c.restore();
    }
    const a=.6+.4*Math.sin(this.time*6);c.globalAlpha=a;this.text('◀',28,280,28,'#fff16b','center',true);this.text('▶',932,280,28,'#fff16b','center',true);c.globalAlpha=1;
    c.fillStyle='#0a0716dd';c.fillRect(137,464,686,53);c.strokeStyle='#563b68';c.strokeRect(137,464,686,53);this.text('← → CHOOSE     ENTER / Z CONFIRM     ESC BACK',480,487,15,'#fff','center',true);this.text('IN RIDE:  WASD/ARROWS MOVE  •  Z FIRE  •  X JUMP  •  C SPECIAL  •  P PAUSE',480,507,11,'#bbadc4','center');
  }

  private drawPortrait(h:HeroSpec,x:number,y:number,scale:number){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);
    c.globalAlpha=.25;c.fillStyle=h.accent;c.beginPath();c.ellipse(0,15,94,78,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    c.fillStyle='#252033';c.beginPath();c.moveTo(-65,65);c.lineTo(-47,-7);c.lineTo(0,-35);c.lineTo(52,-2);c.lineTo(72,65);c.closePath();c.fill();c.fillStyle=h.accent;c.fillRect(-52,10,104,8);
    c.fillStyle=h.color;c.beginPath();c.ellipse(0,-40,42,49,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(-32,-70);c.lineTo(-46,-126);c.lineTo(-6,-80);c.fill();c.beginPath();c.moveTo(25,-73);c.lineTo(46,-124);c.lineTo(46,-63);c.fill();
    c.fillStyle='#4a2947';c.fillRect(-39,-57,79,15);c.fillStyle=h.accent;c.beginPath();c.moveTo(-36,-54);c.lineTo(37,-54);c.lineTo(29,-43);c.lineTo(-29,-43);c.fill();
    c.fillStyle='#14131c';c.beginPath();c.ellipse(-17,-34,8,5,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(18,-34,8,5,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillRect(-19,-36,5,2);c.fillRect(16,-36,5,2);
    c.fillStyle='#8d5a66';c.beginPath();c.moveTo(-5,-19);c.lineTo(7,-19);c.lineTo(1,-11);c.closePath();c.fill();c.strokeStyle='#362332';c.lineWidth=2;c.beginPath();c.arc(1,-5,17,.25,Math.PI-.25);c.stroke();
    if(h.id==='modo'){c.fillStyle='#96d9ef';c.fillRect(23,-52,20,19);c.fillStyle='#1b3348';c.fillRect(28,-47,10,9);}if(h.id==='vinnie'){c.strokeStyle='#ff5578';c.lineWidth=5;c.beginPath();c.arc(0,-46,47,Math.PI*1.12,Math.PI*1.88);c.stroke();}
    c.restore();
  }

  private drawPause(){const c=this.ctx;c.fillStyle='#07040cbb';c.fillRect(0,0,W,H);c.fillStyle='#160d25ee';c.fillRect(278,166,404,205);c.strokeStyle='#f7cf4e';c.lineWidth=3;c.strokeRect(278,166,404,205);this.text('PAUSED',480,218,41,'#fff071','center',true);this.text('THE RED PLANET CAN WAIT',480,248,13,'#bfacc8','center');this.text('ENTER / P',390,294,15,'#64eadb','right',true);this.text('RESUME',410,294,15,'#fff');this.text('R',390,324,15,'#ff667f','right',true);this.text('RESTART RUN',410,324,15,'#fff');this.text('GAMEPAD: START TO RESUME',480,354,11,'#877b91','center');}

  private drawEnding(){
    const c=this.ctx,win=this.mode==='win';c.fillStyle=win?'#09031cbb':'#100309c7';c.fillRect(0,0,W,H);
    if(win){for(let i=0;i<9;i++){const x=100+i*95,y=115+Math.sin(this.time*2+i)*25;c.fillStyle=i%2?'#ff4b86':'#65f1df';c.fillRect(x,y,5,18);}}
    c.fillStyle='#100a1eea';c.fillRect(236,109,488,323);c.strokeStyle=win?'#ffe15a':'#ff3f64';c.lineWidth=4;c.strokeRect(236,109,488,323);
    this.text(win?'MARS RIDES FREE!':'BIKE WRECKED',480,173,43,win?'#fff16b':'#ff5270','center',true);this.text(win?'LIMBURGER’S WAR MACHINE IS SCRAP.':'THE ROAD ISN’T DONE WITH YOU.',480,208,14,'#e2d2e7','center');
    this.text(HEROES[this.selected].name,344,263,16,HEROES[this.selected].accent);this.text('FINAL SCORE',344,296,12,'#a795ad');this.text(Math.floor(this.score).toLocaleString(),616,300,28,'#fff','right',true);this.text('ENEMIES TRASHED',344,330,12,'#a795ad');this.text(this.kills.toString(),616,330,18,'#ffbd52','right',true);this.text('MAX COMBO',344,358,12,'#a795ad');this.text(`x${this.combo.toFixed(1)}`,616,358,18,'#ff66a0','right',true);
    this.text('ENTER / Z  RIDE AGAIN',480,399,15,'#75f1dd','center',true);this.text('ESC  TITLE SCREEN',480,419,11,'#9b8ca5','center');
  }

  private text(value:string,x:number,y:number,size:number,color='#fff',align:CanvasTextAlign='left',bold=false){const c=this.ctx;c.save();c.font=`${bold?'900':'700'} ${size}px "Arial Narrow", Impact, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle='#06030c';c.globalAlpha=.75;c.fillText(value,x+2,y+2);c.globalAlpha=1;c.fillStyle=color;c.fillText(value,x,y);c.restore();}
}
