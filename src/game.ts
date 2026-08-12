import {
  drawBoss as drawPixelBoss,
  drawEnemy as drawPixelEnemy,
  drawHero as drawPixelHero,
  drawPickup as drawPixelPickup,
} from './art';
import { drawEnvironment, drawEnvironmentForeground } from './environment';
import { drawHeroPortrait, preloadSelectPortraits } from './selectPortraits';
import { drawSpriteFrame, getSpriteSheetStatus, preloadSpriteSheets } from './spriteAtlas';

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

const HERO_AUTHORED_SIZE: Record<HeroId,{width:number;height:number;anchorX:number;anchorY:number}> = {
  throttle:{width:208,height:156,anchorX:.48,anchorY:.74},
  modo:{width:220,height:164,anchorX:.5,anchorY:.75},
  vinnie:{width:202,height:152,anchorX:.48,anchorY:.73},
};
type HeroBodySheet = 'authored'|'sustained'|'release';
type MuzzleSourcePoint = readonly [number,number];
interface HeroMuzzleMap {
  readonly authored: readonly MuzzleSourcePoint[];
  readonly sustained: readonly MuzzleSourcePoint[];
  readonly release: readonly MuzzleSourcePoint[];
}

// Barrel/nose hardpoints are measured in the 256x192 source cells.  They are
// transformed through the same destination size and pivot as the body atlas,
// keeping gunfire attached to the machine through ride, jump, held-fire and
// release poses instead of drifting up to the rider's head line.
const HERO_MUZZLE_SOURCE = {
  throttle:{
    authored:[[235,105],[240,105],[218,67],[201,111],[196,111],[198,109],[210,107],[198,112]],
    sustained:[[244,107],[243,108],[243,107],[243,108]],
    release:[[246,109],[247,110],[246,109]],
  },
  modo:{
    authored:[[231,112],[239,111],[220,68],[230,110],[228,110],[232,110],[222,106],[231,108]],
    sustained:[[244,111],[244,112],[244,111],[244,112]],
    release:[[246,111],[246,112],[246,111]],
  },
  vinnie:{
    authored:[[221,104],[222,105],[220,63],[220,106],[223,108],[220,110],[219,105],[223,111]],
    sustained:[[219,106],[220,106],[219,107],[220,107]],
    release:[[221,107],[221,108],[221,108]],
  },
} as const satisfies Readonly<Record<HeroId,HeroMuzzleMap>>;
const FIRE_RELEASE_DURATION = .15;

interface Player {
  x: number; y: number; jump: number; jumpV: number;
  hp: number; armor: number; invuln: number; cooldown: number;
  weapon: Weapon; weaponRank: number; rapid: number; special: number;
  specialTime: number; lean: number; wheel: number; recoil: number;
  fireHeld: boolean; fireLoop: number; fireReleaseBlend: number; fireReleaseElapsed: number; shotsFired: number;
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
interface RiderImpactEvent { enemyId:number; age:number; localX:number; localY:number; }

const IMPACT_LABELS = ['pre','muzzle','travel-25','travel-75','contact','hitstop','recoil-1','recoil-2','debris-1','debris-2','damage-hold','recover'] as const;
const IMPACT_TIMELINE_MS = [0,40,200,520,830,910,1020,1150,1290,1450,1640,2190] as const;
const IMPACT_POSE = [
  {x:0,y:0,angle:0},{x:0,y:0,angle:0},{x:0,y:0,angle:0},{x:0,y:0,angle:0},
  // A left-side projectile pushes the target away from the shooter: right and
  // upward. Contact and hitstop stay in one compression family before every
  // major node advances monotonically into the two recoil poses.
  {x:0,y:0,angle:0},{x:2,y:-1,angle:2},{x:24,y:-12,angle:9},{x:40,y:-18,angle:14},
  // Debris samples deliberately hold the chassis at recoil peak.  Damage-hold
  // remains displaced/tilted; only recover places the wheels back on the road.
  {x:40,y:-18,angle:14},{x:40,y:-18,angle:14},{x:42,y:-16,angle:13},{x:24,y:0,angle:7},
] as const;
const IMPACT_SPRITE_FRAME = [0,1,2,3,4,4,5,7,8,9,10,11] as const;
const IMPACT_HIT_OFFSET = Object.freeze({x:-70,y:-15});
const CONTACT_SIZE = Object.freeze({width:96,height:72,coreOverlapW:20,coreOverlapH:18});
const RECOIL_VECTOR = Object.freeze({x:40/Math.hypot(40,18),y:-18/Math.hypot(40,18)});
const IMPACT_PANEL_PATH = Object.freeze([
  {x:-8,y:-4},{x:-17,y:-8},{x:-27,y:-13},{x:-38,y:-19},{x:-50,y:-25},
]);
const IMPACT_SPARK_A_PATH = Object.freeze([
  {x:-4,y:-10},{x:-11,y:-18},{x:-20,y:-26},{x:-31,y:-35},{x:-42,y:-45},
]);
const IMPACT_SPARK_B_PATH = Object.freeze([
  {x:-6,y:7},{x:-15,y:12},{x:-25,y:18},{x:-37,y:25},{x:-49,y:32},
]);
const IMPACT_BODY_SCALE = Object.freeze([
  {x:1,y:1},{x:1,y:1},{x:1,y:1},{x:1,y:1},{x:1,y:1},
  {x:.985,y:1.015},{x:.99,y:1.02},{x:1.02,y:.99},{x:1.02,y:.99},{x:1.02,y:.99},{x:1.01,y:1},{x:.99,y:1.01},
]);
const IMPACT_SMOKE = Object.freeze([
  {diameter:0,value:0},{diameter:0,value:0},{diameter:0,value:0},{diameter:0,value:0},{diameter:0,value:0},
  {diameter:12,value:54},{diameter:16,value:49},{diameter:20,value:44},{diameter:26,value:38},{diameter:32,value:33},{diameter:38,value:28},{diameter:44,value:24},
]);
const WOBBLE_POSES = Object.freeze([
  {x:8,y:2,angle:4,forkOffset:7,headCounterphase:-5,shadowOffset:7,shadowWidth:62},
  {x:-6,y:-2,angle:-3,forkOffset:-3,headCounterphase:4,shadowOffset:-5,shadowWidth:78},
  {x:4,y:1,angle:2,forkOffset:4,headCounterphase:-4,shadowOffset:3,shadowWidth:68},
]);

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
function px(v: number) { return Math.round(v / 2) * 2; }
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
  private riderImpacts: RiderImpactEvent[] = [];
  private floaters: Floater[] = [];
  private lastProjectileOrigin: {x:number;y:number;barrelX:number;barrelY:number;hero:HeroId;sheet:HeroBodySheet;frame:number} | null = null;
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
  private debugWobblePose: number | null = null;
  private debugImpactStage: number | null = null;
  private debugSustainedFire = false;
  private debugFireHeld = false;
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
    // Atlas loading is deliberately non-blocking. Until every individual PNG is
    // ready, its existing procedural counterpart remains the renderer of record.
    void preloadSpriteSheets();
    void preloadSelectPortraits();
    this.titleArt.src = '/assets/title-key-art.png';
    this.loadScores();
    const query = new URLSearchParams(location.search);
    const hero = query.get('hero') as HeroId | null;
    if (hero && HEROES.some(h => h.id === hero)) this.selected = HEROES.findIndex(h => h.id === hero);
    const scene = query.get('scene');
    if (scene === 'select') this.mode = 'select';
    else if (scene === 'game' || scene === 'boss' || scene === 'sustain') {
      this.beginRun();
      if (scene === 'boss') this.debugBoss();
      else if (scene === 'sustain') this.debugSustain(query.get('rapid') === '1');
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
    this.player = { x: 168, y: 406, jump: 0, jumpV: 0, hp: hero.maxHp, armor: hero.maxArmor * .5, invuln: 0, cooldown: 0, weapon: hero.weapon, weaponRank: 1, rapid: 0, special: 45, specialTime: 0, lean: 0, wheel: 0, recoil: 0, fireHeld: false, fireLoop: 0, fireReleaseBlend: 0, fireReleaseElapsed: -1, shotsFired: 0 };
    this.enemies = []; this.shots = []; this.pickups = []; this.particles = []; this.floaters = []; this.lastProjectileOrigin = null;
    this.elapsed = 0; this.distance = 0; this.worldSpeed = hero.speed; this.score = 0; this.combo = 1; this.comboClock = 0; this.kills = 0;
    this.spawnClock = 1; this.obstacleClock = 4; this.minibossSpawned = false; this.bossSpawned = false; this.bossDefeated = false; this.debugBeat = false; this.debugWobblePose = null; this.debugImpactStage = null; this.debugSustainedFire = false; this.debugFireHeld = false; this.riderImpacts=[]; this.finishClock = 0;
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
    // The twelve production impact frames are frozen authored instants.  They
    // still use the production world/entity/projectile renderer, but do not
    // drift while Playwright encodes a PNG.
    if (this.debugImpactStage !== null) return;
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

    // The body follows the player's intent, not the weapon cooldown.  This is
    // crucial for a shoot-'em-up: a held trigger must remain one coherent pose
    // even in the gaps between rapid projectiles.
    const wasFireHeld = p.fireHeld;
    const fireHeld = this.debugSustainedFire ? this.debugFireHeld : this.input.down('KeyZ','KeyJ','Space');
    p.fireHeld = fireHeld;
    if (fireHeld) {
      p.fireLoop += dt;
      p.fireReleaseBlend = 1;
      p.fireReleaseElapsed = -1;
    } else {
      if (wasFireHeld) p.fireReleaseElapsed = 0;
      else if (p.fireReleaseElapsed >= 0) p.fireReleaseElapsed += dt;
      if (p.fireReleaseElapsed >= FIRE_RELEASE_DURATION) p.fireReleaseElapsed = -1;
      p.fireReleaseBlend = p.fireReleaseElapsed >= 0 ? 1 - p.fireReleaseElapsed / FIRE_RELEASE_DURATION : 0;
      if (p.fireReleaseElapsed < 0) p.fireLoop = 0;
    }
    if (fireHeld && p.cooldown <= 0) this.firePlayer();
    if (this.input.tap('KeyC','KeyL','ControlLeft') && p.special >= 100) this.useSpecial();

    const bossAlive = this.enemies.some(e => e.kind === 'boss' || e.kind === 'miniboss');
    const worldSpeed = (bossAlive ? 105 : hero.speed + mx * 45) * (p.specialTime > 0 && hero.id === 'throttle' ? 1.28 : 1);
    this.worldSpeed = worldSpeed;
    p.wheel += worldSpeed * dt * .045;
    this.distance += worldSpeed * dt;
    if (!this.bossSpawned) this.elapsed += dt;
    this.spawnClock -= dt; this.obstacleClock -= dt;
    if (!this.debugBeat && !this.debugSustainedFire && !bossAlive && !this.bossSpawned && this.spawnClock <= 0) this.spawnWave();
    if (!this.debugBeat && !this.debugSustainedFire && !bossAlive && this.obstacleClock <= 0) this.spawnObstacle();
    if (!this.debugBeat && !this.debugSustainedFire && !this.minibossSpawned && this.elapsed >= 145) { this.minibossSpawned = true; this.spawnEnemy('miniboss', 1010, 393); emitMusic('miniboss'); }
    if (!this.debugBeat && !this.debugSustainedFire && !this.bossSpawned && this.elapsed >= LEVEL_BOSS_TIME) { this.bossSpawned = true; this.enemies = this.enemies.filter(e => e.x > 0); this.spawnEnemy('boss', 1110, 295); emitMusic('boss'); emitAudio('warning'); }

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

  private playerAuthoredFrame(){
    const p=this.player;
    let frame=0;
    if(p.jump>1){
      if(p.jump<9&&p.jumpV>0)frame=1;
      else if(p.jumpV>105)frame=4;
      else if(p.jumpV>-80)frame=5;
      else if(p.jumpV<-185)frame=6;
      else frame=7;
    }else{
      frame=[0,0,3,3,6,6,7,7][((Math.floor(p.wheel)%8)+8)%8];
    }
    if(this.debugImpactStage!==null)frame=[0,2,2,7,7,7,7,7,0,0,0,7][this.debugImpactStage];
    return frame;
  }

  private playerBodySheetFrame(){
    const p=this.player,grounded=p.jump<=1;
    if(this.debugImpactStage===null&&grounded&&p.fireHeld)return {sheet:'sustained' as const,frame:((Math.floor(p.fireLoop*9)%4)+4)%4};
    if(this.debugImpactStage===null&&grounded&&p.fireReleaseElapsed>=0&&p.fireReleaseElapsed<FIRE_RELEASE_DURATION){
      return {sheet:'release' as const,frame:Math.min(2,Math.floor(p.fireReleaseElapsed/(FIRE_RELEASE_DURATION/3)))};
    }
    return {sheet:'authored' as const,frame:this.playerAuthoredFrame()};
  }

  private playerMuzzleHardpoint(bodyX=this.player.x,bodyY=this.player.y-this.player.jump+38,pose=this.playerBodySheetFrame()){
    const hero=HEROES[this.selected].id,size=HERO_AUTHORED_SIZE[hero];
    const points=HERO_MUZZLE_SOURCE[hero][pose.sheet];
    const source=points[Math.min(points.length-1,Math.max(0,pose.frame))];
    const left=bodyX-size.width*size.anchorX,top=bodyY-size.height*size.anchorY;
    return {
      x:left+source[0]/256*size.width,
      y:top+source[1]/192*size.height,
      sourceX:source[0],sourceY:source[1],sheet:pose.sheet,frame:pose.frame,
    };
  }

  private firePlayer() {
    const p = this.player, hero = HEROES[this.selected];
    const rate = hero.fireRate * (p.rapid > 0 ? .56 : 1) * (p.specialTime > 0 && hero.id === 'throttle' ? .5 : 1) / (1 + (p.weaponRank - 1) * .08);
    p.cooldown = rate;
    p.shotsFired++;
    // A short visual timer drives only the muzzle pulse.  The body animation is
    // intentionally owned by the held-trigger state machine above.
    p.recoil = .072;
    const muzzle=this.playerMuzzleHardpoint(),x=muzzle.x,y=muzzle.y;
    this.lastProjectileOrigin={x,y,barrelX:muzzle.x,barrelY:muzzle.y,hero:hero.id,sheet:muzzle.sheet,frame:muzzle.frame};
    // The authored bike guns sit below the old placeholder origin.  Preserve
    // the established enemy/collision lane by aiming gently toward that line
    // over the next 500px; the projectile still visibly begins at the barrel.
    const collisionLaneY=p.y-p.jump-31;
    const add = (vx:number, vy:number, damage:number, r:number, color:string, kind:Weapon, pierce=0, homing=false) => this.shots.push({x,y,vx,vy:vy+(collisionLaneY-y)*Math.abs(vx)/500,r,life:2,damage,friendly:true,color,kind,pierce,homing,age:0,phase:rnd(0,Math.PI*2)});
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
    for(const event of this.riderImpacts)event.age+=dt;
    this.riderImpacts=this.riderImpacts.filter(event=>event.age<1.35&&this.enemies.some(enemy=>enemy.id===event.enemyId));
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
            e.hp-=s.damage;e.flash=e.kind==='boss'? .14:.09;
            if(e.kind==='rider'){
              e.hitReact=this.debugBeat?1.75:1.35;
              this.riderHitFx(e,s);
            }else this.hitFx(s.x,s.y,s.color,s.kind==='laser'?2:3);
            this.comboClock=1.15;this.combo=clamp(this.combo+.055,1,9.9);this.score+=Math.ceil(3*this.combo);p.special=clamp(p.special+.42,0,100);
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
  debugSustain(rapid=false){
    this.beginRun();this.debugSustainedFire=true;this.debugFireHeld=true;this.elapsed=92;
    this.spawnClock=999;this.obstacleClock=999;this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.floaters=[];
    this.player.rapid=rapid?999:0;this.player.fireHeld=true;this.player.fireReleaseBlend=1;this.player.fireReleaseElapsed=-1;
  }
  setDebugFireHeld(held:boolean){
    if(this.debugSustainedFire){
      this.debugFireHeld=held;
      if(held){this.player.fireHeld=true;this.player.fireReleaseBlend=1;this.player.fireReleaseElapsed=-1;}
      else if(this.player.fireHeld){this.player.fireHeld=false;this.player.fireReleaseBlend=1;this.player.fireReleaseElapsed=0;}
    }
    return this.snapshot();
  }
  debugMiniboss(){if(this.mode!=='playing')this.debugStart();this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.debugSustainedFire=false;this.debugFireHeld=false;this.elapsed=145;this.enemies=[];this.shots=[];this.particles=[];this.floaters=[];}
  debugBoss(){
    if(this.mode!=='playing')this.debugStart();
    this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.debugSustainedFire=false;this.debugFireHeld=false;
    this.elapsed=LEVEL_BOSS_TIME;this.enemies=[];this.minibossSpawned=true;this.bossSpawned=true;this.bossDefeated=false;
    this.player.weapon='rockets';this.player.weaponRank=4;this.player.special=100;this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.spawnEnemy('boss',930,295);emitMusic('boss');emitAudio('warning');
  }

  debugCombatBeat(){
    this.debugStart('throttle');this.debugBeat=true;this.elapsed=92;this.spawnClock=999;this.obstacleClock=999;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=168;this.player.y=406;this.player.weapon='blaster';this.player.weaponRank=1;
    this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;this.player.cooldown=0;this.player.recoil=0;
    // The raider occupies the upper road lane so the hero's horizontal blaster
    // crosses its real gameplay hitbox (no capture-only collision shortcut).
    this.spawnEnemy('rider',820,390);const rider=this.enemies[0];rider.hp=160;rider.maxHp=160;rider.fire=999;
  }

  debugImpactFrame(stage:number){
    const frame=clamp(Math.floor(stage),0,IMPACT_LABELS.length-1);
    this.debugStart('throttle');this.debugBeat=false;this.debugImpactStage=frame;
    this.elapsed=92;this.distance=18440;this.worldSpeed=330;this.spawnClock=999;this.obstacleClock=999;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=168;this.player.y=406;this.player.weapon='blaster';this.player.weaponRank=1;
    this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.player.cooldown=frame===1?.12:0;
    this.player.recoil=[0,.072,.058,.018,0,0,0,0,0,0,0,0][frame];
    this.spawnEnemy('rider',740,390);const rider=this.enemies[0];rider.hp=146;rider.maxHp=160;rider.fire=999;rider.flash=0;
    // One authored projectile exists only between muzzle and contact.  Award
    // state flips once at contact and remains stable through recovery.
    if(frame>=1&&frame<=3){
      const hit=this.getRiderHitPoint(rider);
      const shotX=[0,224,350,hit.x-14][frame];
      this.shots.push({x:shotX,y:375,vx:690,vy:0,r:4,life:2,damage:14,friendly:true,color:'#ffe45d',kind:'blaster',pierce:0,age:IMPACT_TIMELINE_MS[frame]/1000,phase:0});
    }
    this.score=frame>=4?4:0;this.combo=frame>=4?1.1:1;this.comboClock=frame>=4?1.15:0;
    return this.snapshot();
  }

  debugWobble(stage:'a'|'b'|'c'){
    this.debugCombatBeat();
    // Frozen regression poses share the exact recovery renderer used by gameplay.
    // Their alternating signs and shrinking magnitude make the damping contract
    // inspectable without screenshot encoding stretching the real 2.14s hit beat.
    this.debugWobblePose=stage==='a'?0:stage==='b'?1:2;
    const rider=this.enemies[0];rider.hitReact=.42;rider.flash=0;
  }

  debugAerialWave(){
    this.debugStart('throttle');this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.elapsed=248;this.spawnClock=999;this.obstacleClock=999;
    this.minibossSpawned=true;this.bossSpawned=false;this.bossDefeated=false;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=168;this.player.y=414;this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.spawnEnemy('drone',760,164);this.spawnEnemy('skimmer',875,252);this.spawnEnemy('drone',990,205);this.spawnEnemy('skimmer',1110,126);
    this.enemies.forEach((enemy,index)=>{enemy.fire=.2+index*.16;enemy.phase=index*.72;});
  }

  private impactShooterPose(stage:number){
    const shoulderRecoil=[0,8,6,2,0,0,0,0,0,0,0,0][stage]??0;
    const gunRecoil=[0,10,8,3,0,0,0,0,0,0,0,0][stage]??0;
    return {shoulderRecoil,gunRecoil,firingPose:stage===1||stage===2};
  }

  private impactTargetPose(stage:number){
    const base=IMPACT_POSE[stage]??IMPACT_POSE[0];
    const scale=IMPACT_BODY_SCALE[stage]??IMPACT_BODY_SCALE[0];
    const headCounterphase=[0,0,0,0,0,-2,-5,-8,-8,-7,-4,2][stage]??0;
    const forkOffset=[0,0,0,0,0,4,9,14,14,14,9,2][stage]??0;
    const wheelLift=[0,0,0,0,0,4,12,18,18,18,13,0][stage]??0;
    const shadowOffset=[0,0,0,0,0,5,17,27,27,27,24,8][stage]??0;
    const shadowWidth=[74,74,74,74,74,68,57,48,48,48,56,68][stage]??74;
    return {...base,scaleX:scale.x,scaleY:scale.y,spriteFrame:IMPACT_SPRITE_FRAME[stage]??0,bodyRotation:base.angle,headCounterphase,forkOffset,wheelLift,shadowOffset,shadowWidth};
  }

  private impactAnchors(stage:number,e:Enemy){
    const pose=this.impactTargetPose(stage),angle=pose.angle*Math.PI/180,pivot={x:e.x,y:e.y+16};
    const local={hardpoint:{x:-70,y:-31},frontWheel:{x:-66,y:18},head:{x:-20,y:-62},gun:{x:-50,y:-48}};
    const transform=(point:{x:number;y:number},atStage:number)=>{
      const at=this.impactTargetPose(atStage),a=at.angle*Math.PI/180;
      const scaledX=point.x*at.scaleX,scaledY=point.y*at.scaleY;
      return {x:px(pivot.x+at.x+scaledX*Math.cos(a)-scaledY*Math.sin(a)),y:px(pivot.y+at.y+scaledX*Math.sin(a)+scaledY*Math.cos(a))};
    };
    const baseStage=4;
    const anchor=(point:{x:number;y:number})=>{
      const current=transform(point,stage),origin=transform(point,baseStage);
      const previous=transform(point,Math.max(baseStage,stage-1));
      const projection=(current.x-origin.x)*RECOIL_VECTOR.x+(current.y-origin.y)*RECOIL_VECTOR.y;
      const previousProjection=(previous.x-origin.x)*RECOIL_VECTOR.x+(previous.y-origin.y)*RECOIL_VECTOR.y;
      return {...current,projection:Number(projection.toFixed(2)),adjacentDelta:Number((projection-previousProjection).toFixed(2)),reversePx:Number(Math.max(0,previousProjection-projection).toFixed(2))};
    };
    const hardpoint=anchor(local.hardpoint),frontWheel=anchor(local.frontWheel),head=anchor(local.head),gun=anchor(local.gun);
    return {recoilVector:RECOIL_VECTOR,bodyAngle:pose.angle,adjacentReversePx:Math.max(hardpoint.reversePx,frontWheel.reversePx,head.reversePx,gun.reversePx),hardpoint,frontWheel,head,gun};
  }

  private impactTrajectories(stage:number,hit:{x:number;y:number},scar=hit){
    if(stage<5||stage>9)return null;
    const index=stage-5;
    const sample=(id:string,path:ReadonlyArray<{x:number;y:number}>)=>{
      const at=path[index],previous=path[Math.max(0,index-1)];
      const distance=Math.hypot(at.x,at.y),previousDistance=Math.hypot(previous.x,previous.y);
      return {id,x:px(scar.x+at.x),y:px(scar.y+at.y),dx:at.x,dy:at.y,distanceFromScar:Number(distance.toFixed(2)),distanceStep:Number((distance-previousDistance).toFixed(2)),sampleDelta:Number(Math.hypot(at.x-previous.x,at.y-previous.y).toFixed(2))};
    };
    return {origin:{node:'frontHardpoint',x:scar.x,y:scar.y},earlyPanel:sample('blue-panel-0',IMPACT_PANEL_PATH),sparkA:sample('hot-spark-a',IMPACT_SPARK_A_PATH),sparkB:sample('hot-spark-b',IMPACT_SPARK_B_PATH)};
  }

  private impactMaterialMetrics(stage:number,hit:{x:number;y:number},scar=hit){
    const trajectories=this.impactTrajectories(stage,hit,scar);
    const debrisOne=[trajectories?.earlyPanel??{x:hit.x,y:hit.y},{x:hit.x-25,y:hit.y+8},{x:hit.x-15,y:hit.y+18}];
    const debrisTwo=[trajectories?.earlyPanel??{x:hit.x,y:hit.y},{x:hit.x-37,y:hit.y+15},{x:hit.x-27,y:hit.y+29}];
    const debrisStage=stage===8||stage===9,earlyStage=stage>=5&&stage<=7;
    const particleCount=debrisStage?12:earlyStage?3:stage>=10?1:0;
    const smoke=this.impactSmokeMetrics(stage);
    const smokeDiameters=[
      Math.max(4,px(smoke.diameter*.34)),
      ...(stage>=6?[Math.max(4,px(smoke.diameter*.42))]:[]),
      ...(stage>=7?[Math.max(4,px(smoke.diameter*.38))]:[]),
      ...(stage>=8?[Math.max(4,px(smoke.diameter*.46))]:[]),
      ...(stage>=10?[Math.max(4,px(smoke.diameter*.34))]:[]),
    ];
    return {
      panels:debrisStage?3:earlyStage?1:0,sparks:debrisStage?5:earlyStage?2:0,smokeDust:debrisStage?4:stage>=6?1:0,
      panelSizes:[{w:18,h:12},{w:20,h:12},{w:16,h:11}],sparkLengths:[24,22,20,18,16],smokeDiameters,smokeDiameter:smoke.diameter,smokeValue:smoke.value,
      largeOrigins:stage===8?debrisOne:stage===9?debrisTwo:trajectories?[trajectories.earlyPanel]:[],panelArcs:stage===9?[76,52,48]:[],panelRotations:stage===9?[63,58,46]:[],particleCount,trajectories,
    };
  }

  private impactSmokeMetrics(stage:number){
    const smoke=IMPACT_SMOKE[stage]??IMPACT_SMOKE[0];
    return {active:stage>=5,node:'frontHardpoint',baseDx:2,baseDy:-4,baseDistance:Number(Math.hypot(2,4).toFixed(2)),diameter:smoke.diameter,value:smoke.value,tone:stage<7?'warm soot seed':stage<10?'neutral soot':'charcoal smoke'};
  }

  private impactPhaseMetrics(e:Enemy){
    const contact=this.impactTargetPose(4),hitstop=this.impactTargetPose(5),peak=this.impactTargetPose(7),hold=this.impactTargetPose(10),recover=this.impactTargetPose(11);
    const hitstopAnchors=this.impactAnchors(5,e),recoilOneAnchors=this.impactAnchors(6,e),peakAnchors=this.impactAnchors(7,e);
    const hardpointDelta=Math.hypot(hitstopAnchors.hardpoint.x-this.impactAnchors(4,e).hardpoint.x,hitstopAnchors.hardpoint.y-this.impactAnchors(4,e).hardpoint.y);
    const holdRecoverProjection=(hold.x-recover.x)*RECOIL_VECTOR.x+(hold.y-recover.y)*RECOIL_VECTOR.y;
    return {
      contactToHitstop:{hardpointDeltaPx:Number(hardpointDelta.toFixed(2)),bodyDeltaDeg:hitstop.angle-contact.angle,compressed:hitstop.scaleX<contact.scaleX&&hitstop.scaleY>contact.scaleY},
      contactToPeak:{horizontalPx:peak.x-contact.x,verticalPx:Math.abs(peak.y-contact.y),angleDeg:peak.angle-contact.angle},
      recoilMonotonic:{maxReversePx:Number(Math.max(hitstopAnchors.adjacentReversePx,recoilOneAnchors.adjacentReversePx,peakAnchors.adjacentReversePx).toFixed(2)),stages:[hitstopAnchors,recoilOneAnchors,peakAnchors]},
      debrisPeakHold:{recoil2:IMPACT_POSE[7],debris1:IMPACT_POSE[8],debris2:IMPACT_POSE[9]},
      holdRecover:{projectionGapPx:Number(holdRecoverProjection.toFixed(2)),angleGapDeg:hold.angle-recover.angle,hold,recover,recoverWheelLift:recover.wheelLift},
      silhouettes:{contactFrame:contact.spriteFrame,hitstopFrame:hitstop.spriteFrame,recoilOneFrame:this.impactTargetPose(6).spriteFrame,recoilTwoFrame:peak.spriteFrame,hitstopScaleX:hitstop.scaleX,hitstopScaleY:hitstop.scaleY},
    };
  }

  private playerFireState(){
    const p=this.player,h=HEROES[this.selected],grounded=p.jump<=1;
    const loopFrame=((Math.floor(p.fireLoop*9)%4)+4)%4;
    const releaseActive=p.fireReleaseElapsed>=0&&p.fireReleaseElapsed<FIRE_RELEASE_DURATION;
    const releaseFrame=grounded&&releaseActive?Math.min(2,Math.floor(p.fireReleaseElapsed/(FIRE_RELEASE_DURATION/3))):-1;
    const bodyMode: 'ride'|'sustained'|'recover'|'airborne' = !grounded?'airborne':p.fireHeld?'sustained':releaseActive?'recover':'ride';
    // The authored cells already contain their own recoil acting.  Holding the
    // world-space pivot fixed prevents the wheels from skating across the road.
    const recoilOffset=0;
    const size=HERO_AUTHORED_SIZE[h.id],anchorX=p.x-recoilOffset,anchorY=p.y-p.jump+38;
    const muzzle=this.playerMuzzleHardpoint();
    const projectileOrigin=this.lastProjectileOrigin;
    const projectileOriginDeltaPx=projectileOrigin?Math.hypot(projectileOrigin.x-projectileOrigin.barrelX,projectileOrigin.y-projectileOrigin.barrelY):null;
    return {
      held:p.fireHeld,grounded,loopFrame,bodyMode,loopKind:bodyMode,shotsFired:p.shotsFired,recoilOffset,releaseFrame,
      anchorX:Number(anchorX.toFixed(2)),anchorY:Number(anchorY.toFixed(2)),anchorBaseX:Number(p.x.toFixed(2)),anchorBaseY:Number((p.y-p.jump+38).toFixed(2)),
      rapid:p.rapid>0,releaseBlend:Number(p.fireReleaseBlend.toFixed(3)),releaseElapsedMs:releaseActive?Number((p.fireReleaseElapsed*1000).toFixed(2)):-1,releaseDurationMs:FIRE_RELEASE_DURATION*1000,jumpPose:!grounded,roadBaseline:Number((p.y+38).toFixed(2)),
      bodyBBox:{x:Number((anchorX-size.width*size.anchorX).toFixed(2)),y:Number((anchorY-size.height*size.anchorY).toFixed(2)),w:size.width,h:size.height},
      muzzleX:Number(muzzle.x.toFixed(2)),muzzleY:Number(muzzle.y.toFixed(2)),
      visibleBarrelHardpoint:{x:Number(muzzle.x.toFixed(2)),y:Number(muzzle.y.toFixed(2)),sourceX:muzzle.sourceX,sourceY:muzzle.sourceY,sheet:muzzle.sheet,frame:muzzle.frame},
      projectileOrigin:projectileOrigin?{x:Number(projectileOrigin.x.toFixed(2)),y:Number(projectileOrigin.y.toFixed(2)),hero:projectileOrigin.hero,sheet:projectileOrigin.sheet,frame:projectileOrigin.frame}:null,
      lastProjectileOriginX:projectileOrigin?Number(projectileOrigin.x.toFixed(2)):null,lastProjectileOriginY:projectileOrigin?Number(projectileOrigin.y.toFixed(2)):null,
      projectileOriginDeltaPx:projectileOriginDeltaPx===null?null:Number(projectileOriginDeltaPx.toFixed(3)),
    };
  }

  snapshot() {
    const boss = this.enemies.find(e => e.kind === 'boss' || e.kind === 'miniboss');
    const debugRider=this.enemies.find(e=>e.kind==='rider');
    const wobble=this.debugWobblePose===null?null:WOBBLE_POSES[this.debugWobblePose];
    const impactStage=this.debugImpactStage;
    const hit=debugRider?this.getRiderHitPoint(debugRider):{x:0,y:0};
    const shot=this.shots.find(s=>s.friendly);
    const targetPose=impactStage===null?null:this.impactTargetPose(impactStage);
    const anchors=impactStage===null||!debugRider?null:this.impactAnchors(impactStage,debugRider);
    const scarAnchor=anchors?.hardpoint??{x:hit.x,y:hit.y};
    const material=impactStage===null?null:this.impactMaterialMetrics(impactStage,hit,scarAnchor);
    const pathSamples=impactStage===null?null:this.impactTrajectories(impactStage,hit,scarAnchor);
    const scarActive=impactStage!==null&&impactStage>=6;
    const smokeMetrics=impactStage===null?null:this.impactSmokeMetrics(impactStage);
    const scar=impactStage===null?null:{active:scarActive,node:'frontHardpoint',x:scarAnchor.x,y:scarAnchor.y,w:18,h:16,smokeBaseX:scarAnchor.x+2,smokeBaseY:scarAnchor.y-4,distance:Number(Math.hypot(2,4).toFixed(2)),smokeBaseDistance:Number(Math.hypot(2,4).toFixed(2)),smokeDiameter:smokeMetrics?.diameter??0,smokeValue:smokeMetrics?.value??0};
    const trajectory=impactStage===null?null:{earlyPanel:pathSamples?.earlyPanel??null,sparkA:pathSamples?.sparkA??null,sparkB:pathSamples?.sparkB??null,scar};
    const phaseAnchors=impactStage===null||!debugRider?null:{contact:this.impactAnchors(4,debugRider),hitstop:this.impactAnchors(5,debugRider),recoil1:this.impactAnchors(6,debugRider),recoil2:this.impactAnchors(7,debugRider),debris1:this.impactAnchors(8,debugRider),debris2:this.impactAnchors(9,debugRider),damageHold:this.impactAnchors(10,debugRider),recover:this.impactAnchors(11,debugRider)};
    const fireState=this.player?this.playerFireState():null;
    return {
      state: this.mode, hero: HEROES[this.selected].id, score: Math.floor(this.score),
      health: this.player?.hp ?? null, armor: this.player?.armor ?? null,
      enemies: this.enemies.length, boss: boss ? { kind: boss.kind, health: boss.hp, maxHealth: boss.maxHp } : null,
      elapsed: Number(this.elapsed.toFixed(2)), combo: Number(this.combo.toFixed(1)), weapon: this.player?.weapon ?? null,
      fireState,
      beat: this.debugBeat ? { riderReaction: Number((this.enemies[0]?.hitReact ?? 0).toFixed(2)), shots: this.shots.filter(s=>s.friendly).length, wobbleX:wobble?.x??(this.enemies[0]?this.riderReactionPose(this.enemies[0]).wobbleX:0),wobbleAngle:wobble?.angle??0,forkOffset:wobble?.forkOffset??0,counterphase:wobble?.headCounterphase??0,shadowOffset:wobble?.shadowOffset??0,shadowWidth:wobble?.shadowWidth??74 } : null,
      impact: this.debugImpactStage===null?null:{
        stage:this.debugImpactStage,label:IMPACT_LABELS[this.debugImpactStage],timelineMs:IMPACT_TIMELINE_MS[this.debugImpactStage],
        hitstopMs:80,shots:this.shots.filter(s=>s.friendly).length,firedProjectiles:this.debugImpactStage>=1?1:0,
        scoreAwards:this.debugImpactStage>=4?1:0,targetPose,anchors,phaseAnchors,trajectory,scar,phaseMetrics:debugRider?this.impactPhaseMetrics(debugRider):null,smoke:smokeMetrics,
        fixedHit:hit,
        projectile:{created:this.debugImpactStage>=1?1:0,consumed:this.debugImpactStage>=4?1:0,tipX:shot?shot.x+14:hit.x,tipY:shot?shot.y:hit.y,active:Boolean(shot)},
        contact:{coreCenterX:hit.x,coreCenterY:hit.y,leadingEdgeX:hit.x,leadingEdgeY:hit.y,overlapW:CONTACT_SIZE.coreOverlapW,overlapH:CONTACT_SIZE.coreOverlapH,bboxW:CONTACT_SIZE.width,bboxH:CONTACT_SIZE.height,intactSilhouette:this.debugImpactStage===4,layers:{rearHalo:this.debugImpactStage===4||this.debugImpactStage===5,hotRing:this.debugImpactStage===4||this.debugImpactStage===5,core:this.debugImpactStage===4||this.debugImpactStage===5,reflectedRim:this.debugImpactStage===4||this.debugImpactStage===5,foregroundSparks:this.debugImpactStage===4||this.debugImpactStage===5},damageOrigin:hit,emitterOrigin:hit},
        hitstop:{active:this.debugImpactStage===5,panelVisible:this.debugImpactStage===5,sparksVisible:this.debugImpactStage===5?2:0,sootVisible:this.debugImpactStage===5,posture:{hardpointDeltaPx:debugRider?this.impactPhaseMetrics(debugRider).contactToHitstop.hardpointDeltaPx:0,bodyDeltaDeg:this.impactTargetPose(5).angle-this.impactTargetPose(4).angle,compressed:true,noStraightening:true}},
        shooterPose:this.impactShooterPose(this.debugImpactStage),material,
        particleContract:this.debugImpactStage>=5?{total:material?.particleCount??0,panels:material?.panels??0,sparks:material?.sparks??0,smokeDust:material?.smokeDust??0,longArcPanels:this.debugImpactStage>=8?2:0}:null,
        damage:{holdMs:550,missingPanelW:18,missingPanelH:16,smokeBaseDistance:Number(Math.hypot(2,4).toFixed(2)),contourChangedPct:this.debugImpactStage>=6?7:0,particleCount:material?.particleCount??0,node:'frontHardpoint',recoverGrounded:this.impactTargetPose(11).wheelLift===0,holdRecoverProjectionPx:debugRider?this.impactPhaseMetrics(debugRider).holdRecover.projectionGapPx:0,holdRecoverAngleDeg:this.impactTargetPose(10).angle-this.impactTargetPose(11).angle},
        damageHoldMs:550,
      },
      atlas: getSpriteSheetStatus()
    };
  }

  gotoScene(scene: string, time = 0) {
    if (scene === 'title') { this.mode = 'title'; emitMusic('title'); }
    else if (scene === 'select') { this.mode = 'select'; emitMusic('select'); }
    else if (scene === 'boss') this.debugBoss();
    else if (scene === 'miniboss') this.debugMiniboss();
    else if (scene === 'beat') this.debugCombatBeat();
    else if (/^impact-(?:[0-9]|1[01])$/.test(scene)) this.debugImpactFrame(Number(scene.slice(7)));
    else if (scene === 'wobble-a'||scene === 'wobble-b'||scene === 'wobble-c') this.debugWobble(scene.at(-1) as 'a'|'b'|'c');
    else if (scene === 'aerial') this.debugAerialWave();
    else if (scene === 'sustain') this.debugSustain(time > 0);
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
  private getRiderHitPoint(e:Enemy,y?:number){
    // This local hardpoint is shared by projectile consumption, the rear halo,
    // foreground core, debris emitter and the persistent torn-panel overlay.
    return {x:px(e.x+IMPACT_HIT_OFFSET.x),y:px(y===undefined?e.y+IMPACT_HIT_OFFSET.y:clamp(y,e.y-20,e.y-10))};
  }
  private riderHitFx(e:Enemy,s:Projectile){
    const hit=this.getRiderHitPoint(e,s.y);
    this.riderImpacts=this.riderImpacts.filter(event=>event.enemyId!==e.id);
    this.riderImpacts.push({enemyId:e.id,age:0,localX:hit.x-e.x,localY:hit.y-e.y});
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
    const environment={scroll:this.distance,elapsed:this.elapsed,speed:this.worldSpeed,time:this.debugImpactStage===null?this.time:21,shake:this.shake,intensity};
    drawEnvironment(c,environment);
    for(const q of this.pickups)this.drawPickup(q);
    if(this.debugImpactStage!==null){const rider=this.enemies.find(e=>e.kind==='rider');if(rider)this.drawImpactRear(this.debugImpactStage,rider,this.getRiderHitPoint(rider));}
    for(const event of this.riderImpacts){const rider=this.enemies.find(e=>e.id===event.enemyId);if(rider)this.drawImpactRear(this.impactStageFromAge(event.age),rider,{x:rider.x+event.localX,y:rider.y+event.localY});}
    const ordered=[...this.enemies].sort((a,b)=>a.y-b.y);for(const e of ordered)this.drawEnemy(e);
    if(this.player)this.drawPlayer();
    for(const s of this.shots)this.drawShot(s);
    for(const q of this.particles)this.drawParticle(q);
    if(this.debugImpactStage!==null)this.drawImpactChoreography(this.debugImpactStage);
    for(const event of this.riderImpacts){const rider=this.enemies.find(e=>e.id===event.enemyId);if(rider)this.drawImpactForeground(this.impactStageFromAge(event.age),rider,{x:rider.x+event.localX,y:rider.y+event.localY});}
    drawEnvironmentForeground(c,environment);
    for(const f of this.floaters){c.globalAlpha=clamp(f.life*2,0,1);this.text(f.text,f.x,f.y,17,f.color,'center',true);c.globalAlpha=1;}
  }

  private drawPlayer(){
    const c=this.ctx,p=this.player,h=HEROES[this.selected],x=p.x,y=p.y-p.jump;
    const rideFrame=((Math.floor(p.wheel)%6)+6)%6;
    const firing=p.cooldown>0&&p.recoil>.034;
    const recoil=clamp(p.recoil/.072,0,1);
    const fireState=this.playerFireState();
    // Keep invulnerability readable without bleaching the hero into a featureless white cutout.
    const hitFlash=p.invuln>0&&Math.floor(p.invuln*22)%2===0?.32:0;
    c.save();c.globalAlpha=.27;c.fillStyle='#000';c.beginPath();c.ellipse(x-5,p.y+15,54,11,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    if(p.specialTime>0){c.strokeStyle=h.accent;c.lineWidth=2;c.globalAlpha=.4+.25*Math.sin(this.time*18);for(let i=0;i<3;i++){c.beginPath();c.ellipse(x-10-i*7,y,62+i*7,27+i*3,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}
    // The regular hero sheets still own ride and airborne acting.  Grounded
    // trigger holds use a dedicated four-frame row per hero, so projectile
    // cadence can never bounce the body back to a ride frame.
    const pose=this.playerBodySheetFrame();
    const authoredFrame=pose.sheet==='authored'?pose.frame:2;
    const size=HERO_AUTHORED_SIZE[h.id];
    const playerKick=this.debugImpactStage===null?0:this.impactShooterPose(this.debugImpactStage).shoulderRecoil;
    const sustained=pose.sheet==='sustained';
    const recovering=pose.sheet==='release';
    const bodyX=x-playerKick-fireState.recoilOffset;
    const bodyY=y+38+(playerKick>0?2:0);
    let usedAtlas=sustained&&drawSpriteFrame(c,'sustainedFire',this.selected*4+pose.frame,bodyX,bodyY,{...size,alpha:hitFlash>0?.62:1});
    if(!usedAtlas&&recovering)usedAtlas=drawSpriteFrame(c,'fireRelease',this.selected*3+pose.frame,bodyX,bodyY,{...size,alpha:hitFlash>0?.62:1});
    if(!usedAtlas)usedAtlas=drawSpriteFrame(c,h.id,authoredFrame,bodyX,bodyY,{
      ...size,alpha:hitFlash>0?.62:1,
    });
    if(!usedAtlas){
      c.scale(2,2);
      drawPixelHero(c,h.id,bodyX/2,y/2,{frame:rideFrame,angle:p.lean*.055-p.jumpV*.00008,power:p.specialTime>0?1:clamp(.76+this.worldSpeed/h.speed*.18,.76,.96),firing:sustained||recovering||firing,airborne:p.jump>1,flash:hitFlash,recoil:sustained?1:recovering?p.fireReleaseBlend:recoil});
    }
    c.restore();
    if(this.debugImpactStage===1||this.debugImpactStage===null&&firing){const muzzle=this.playerMuzzleHardpoint(bodyX,bodyY,pose);this.drawMuzzle(muzzle.x,muzzle.y,p.weapon,recoil>.72?0:1);}
  }

  private impactStageFromAge(age:number){return age<.08?4:age<.16?5:age<.29?6:age<.42?7:age<.55?8:age<.68?9:age<1.18?10:11;}

  private drawImpactRear(stage:number,_enemy:Enemy,hit:{x:number;y:number}){
    if(stage!==4&&stage!==5)return;
    const width=stage===5?98:112,height=stage===5?72:84;
    if(drawSpriteFrame(this.ctx,'impactMaterial',0,hit.x,hit.y,{width,height,anchorX:.5,anchorY:.5,alpha:stage===5?.8:1}))return;
    const c=this.ctx;c.save();c.translate(hit.x,hit.y);c.globalCompositeOperation='lighter';c.globalAlpha=stage===5?.72:.9;c.fillStyle='#176f91';c.fillRect(-48,-8,96,16);c.fillRect(-8,-36,16,72);c.fillStyle='#ff7138';c.fillRect(-36,-5,72,10);c.fillRect(-5,-28,10,56);c.restore();
  }

  private drawImpactChoreography(stage:number){
    const enemy=this.enemies.find(e=>e.kind==='rider');if(enemy)this.drawImpactForeground(stage,enemy,this.getRiderHitPoint(enemy));
  }

  private drawImpactForeground(stage:number,enemy:Enemy,hit:{x:number;y:number}){
    const c=this.ctx;
    if(stage===4||stage===5){
      const used=drawSpriteFrame(c,'impactMaterial',1,hit.x,hit.y,{width:stage===5?98:112,height:stage===5?72:84,anchorX:.5,anchorY:.5,alpha:stage===5?.8:1});
      if(!used){
        c.save();c.translate(hit.x,hit.y);c.globalCompositeOperation='lighter';
        const burst=(points:number[],color:string)=>{c.fillStyle=color;c.beginPath();c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.closePath();c.fill();};
        burst([-48,-6,-30,-16,-34,-28,-12,-20,0,-36,12,-20,36,-26,30,-10,48,-6,36,4,42,18,18,14,12,32,0,20,-14,30,-20,14,-44,18,-34,2],'#ff7138');
        burst([-36,-4,-22,-12,-24,-20,-8,-14,0,-26,10,-14,24,-18,20,-8,36,-4,26,4,30,12,12,10,8,20,0,14,-10,20,-14,8,-30,12,-26,2],'#58eaff');
        burst([-22,-4,-10,-8,-6,-16,2,-10,12,-12,8,-6,22,-2,14,4,18,8,6,8,0,16,-8,8,-18,10,-12,2],'#fffde3');
        c.fillStyle='#fff';c.fillRect(-10,-5,28,10);c.fillRect(-3,-12,10,24);c.restore();
      }
      if(stage===4)return;
    }
    if(stage<5)return;
    const scar=this.impactAnchors(stage,enemy).hardpoint;
    const trajectories=this.impactTrajectories(stage,hit,scar);
    if(trajectories){
      const panel=trajectories.earlyPanel;
      c.save();c.translate(panel.x,panel.y);c.rotate((stage-5)*-.16);
      if(!drawSpriteFrame(c,'impactMaterial',4,0,0,{width:58,height:42,anchorX:.5,anchorY:.5}))this.drawPanelFallback(0);
      c.restore();
      this.drawTrackedImpactSpark(trajectories.sparkA.x,trajectories.sparkA.y,.58,0);
      this.drawTrackedImpactSpark(trajectories.sparkB.x,trajectories.sparkB.y,-.5,1);
    }
    if(stage===8||stage===9){
      const lead=trajectories!.earlyPanel;
      const positions=stage===8?[[lead.x+8,lead.y+14,.44],[lead.x+18,lead.y+2,-.28]]:[[lead.x+10,lead.y+16,.72],[lead.x+20,lead.y+4,-.5]];
      positions.forEach(([x,y,rotation],index)=>{c.save();c.translate(px(x),px(y));c.rotate(rotation);const used=drawSpriteFrame(c,'impactMaterial',2+index,0,0,{width:54+index*4,height:40+index*3,anchorX:.5,anchorY:.5});if(!used)this.drawPanelFallback(index+1);c.restore();});
      this.drawTrackedImpactSpark(lead.x+6,lead.y-16,.82,2);
      this.drawTrackedImpactSpark(lead.x+17,lead.y+13,-.72,3);
      this.drawTrackedImpactSpark(lead.x-5,lead.y+20,-.18,4);
    }
    if(stage>=6){
      const alpha=stage===11?.86:1;
      c.save();c.beginPath();c.rect(scar.x-38,scar.y-13,76,43);c.clip();
      const used=drawSpriteFrame(c,'impactMaterial',7,scar.x,scar.y,{width:82,height:62,anchorX:.5,anchorY:.54,alpha});c.restore();
      if(!used){
        c.save();c.translate(scar.x,scar.y);c.globalAlpha=alpha;c.fillStyle='#111827';c.beginPath();c.moveTo(-14,-10);c.lineTo(10,-9);c.lineTo(14,8);c.lineTo(-10,11);c.closePath();c.fill();c.fillStyle='#2d73a7';c.fillRect(-9,-7,18,14);c.fillStyle='#8adfff';c.fillRect(-7,-6,14,3);c.fillStyle='#171b22';c.fillRect(-4,-13,17,8);c.restore();
      }
    }
    this.drawAttachedImpactSmoke(stage,scar.x,scar.y);
  }

  private drawTrackedImpactSpark(x:number,y:number,rotation:number,index:number){
    const c=this.ctx,length=24-index*2;c.save();c.translate(px(x),px(y));c.rotate(rotation);c.globalCompositeOperation='lighter';
    c.fillStyle='#ff562e';c.beginPath();c.moveTo(5,-4);c.lineTo(-length,0);c.lineTo(5,4);c.closePath();c.fill();
    c.fillStyle=index%2?'#ffd84a':'#fffde3';c.beginPath();c.moveTo(6,-2);c.lineTo(-length*.76,0);c.lineTo(6,2);c.closePath();c.fill();c.fillStyle='#fff';c.fillRect(1,-1,7,2);c.restore();
  }

  private drawAttachedImpactSmoke(stage:number,x:number,y:number){
    if(stage<5)return;
    const c=this.ctx,metrics=this.impactSmokeMetrics(stage),d=metrics.diameter;
    const colors=['#59483d','#50423d','#463b3b','#3c3538','#333035','#2b2b30','#24262b'];
    const color=colors[Math.min(colors.length-1,stage-5)];
    c.save();c.translate(px(x+2),px(y-4));c.globalAlpha=.98;
    const puff=(dx:number,dy:number,size:number,highlight=false)=>{
      const s=Math.max(4,px(size));c.fillStyle='#171a20';c.fillRect(px(dx-s*.5-2),px(dy-s*.5),s+4,s);
      c.fillStyle=color;c.fillRect(px(dx-s*.5),px(dy-s*.5-2),s,Math.max(4,s-2));
      if(highlight){c.fillStyle=stage<7?'#8b6952':'#5b4d49';c.fillRect(px(dx-s*.28),px(dy-s*.38),Math.max(3,px(s*.34)),Math.max(3,px(s*.2)));}
    };
    puff(0,0,d*.34,true);
    if(stage>=6)puff(-d*.2,-d*.25,d*.42,true);
    if(stage>=7)puff(d*.18,-d*.42,d*.38,false);
    if(stage>=8)puff(-d*.08,-d*.67,d*.46,false);
    if(stage>=10)puff(d*.2,-d*.85,d*.34,false);
    c.restore();
  }

  private drawPanelFallback(index:number){const c=this.ctx,w=10+index,h=7+index;c.fillStyle='#111827';c.beginPath();c.moveTo(-w-3,-h);c.quadraticCurveTo(0,-h-5,w+3,-h+1);c.lineTo(w,h);c.quadraticCurveTo(0,h+5,-w,h-1);c.closePath();c.fill();c.fillStyle=index===1?'#3b91c8':'#245c9b';c.beginPath();c.moveTo(-w,-h+2);c.quadraticCurveTo(0,-h-2,w,-h+2);c.lineTo(w-2,h-2);c.quadraticCurveTo(0,h+2,-w+2,h-2);c.closePath();c.fill();c.strokeStyle='#7bdcff';c.lineWidth=2;c.beginPath();c.moveTo(-w+2,-h+3);c.quadraticCurveTo(0,-h,w-2,-h+3);c.stroke();}
  private drawSparkClusterFallback(x:number,y:number){const c=this.ctx;c.save();c.translate(x,y);[-1.08,-.64,-.2,.34,.78].forEach((angle,index)=>{c.save();c.rotate(angle);const length=22-index*2;c.fillStyle='#ff7138';c.beginPath();c.moveTo(0,-3);c.lineTo(-length,0);c.lineTo(0,3);c.closePath();c.fill();c.fillStyle=index%2?'#ffd84a':'#fffde3';c.beginPath();c.moveTo(2,-2);c.lineTo(-length*.72,0);c.lineTo(2,2);c.closePath();c.fill();c.restore();});c.restore();}
  private drawSmokeClusterFallback(x:number,y:number){const c=this.ctx;c.save();c.translate(x,y);[[-10,-4,9],[5,-10,8],[12,4,7],[-2,8,6]].forEach(([dx,dy,r])=>{c.fillStyle='#342c42';c.fillRect(dx-r,dy-r,r*2,r*2);c.fillStyle='#73515a';c.fillRect(dx-r+3,dy-r+2,r*2-4,r*2-4);c.fillStyle='#b4866e';c.fillRect(dx-r+5,dy-r+4,r-1,r-2);});c.restore();}

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

  private riderReactionPose(e:Enemy){
    let authoredReaction=0,reactionAge=0,recoveryStart=0,squash=0,wobbleX=0,wobbleY=0,rotation=0,forkOffset=0,headCounterphase=0,shadowOffset=0,shadowWidth=74;
    if(this.debugWobblePose!==null){
      const pose=WOBBLE_POSES[this.debugWobblePose];authoredReaction=4;wobbleX=pose.x;wobbleY=pose.y;rotation=pose.angle;forkOffset=pose.forkOffset;headCounterphase=pose.headCounterphase;shadowOffset=pose.shadowOffset;shadowWidth=pose.shadowWidth;
    }else if(e.hitReact>0){
      reactionAge=(this.debugBeat?1.75:.72)-e.hitReact;
      const contactEnd=this.debugBeat?.12:.07;
      const squashEnd=this.debugBeat?.32:.16;
      const recoilEnd=this.debugBeat?.55:.3;
      recoveryStart=this.debugBeat?1.05:.42;
      if(reactionAge<contactEnd)authoredReaction=1;
      else if(reactionAge<squashEnd){authoredReaction=1;squash=Math.sin((reactionAge-contactEnd)/(squashEnd-contactEnd)*Math.PI);}
      else if(reactionAge<recoilEnd)authoredReaction=2;
      else if(reactionAge<recoveryStart)authoredReaction=3;
      else authoredReaction=4;
      if(authoredReaction===4){
        const wobbleAge=reactionAge-recoveryStart,wobbleDuration=this.debugBeat?.48:.3;
        const amplitude=9*clamp(1-wobbleAge/wobbleDuration,0,1);
        wobbleX=Math.round(Math.sin(wobbleAge*55)*amplitude);
        wobbleY=Math.round(Math.sin(wobbleAge*33)*amplitude*.28);
        rotation=clamp(wobbleX*.5,-3,4);forkOffset=Math.round(wobbleY*2.4);headCounterphase=-Math.sign(wobbleX)*Math.max(4,Math.round(Math.abs(wobbleX)*.55));shadowOffset=Math.round(wobbleX*.75);shadowWidth=74-Math.round(Math.abs(rotation)*3);
      }
    }
    return {authoredReaction,squash,wobbleX,wobbleY,rotation,forkOffset,headCounterphase,shadowOffset,shadowWidth};
  }

  private riderImpactFrame(e:Enemy){
    if(this.debugImpactStage!==null)return this.debugImpactStage<4?null:this.debugImpactStage;
    if(this.debugWobblePose!==null)return 11;
    if(e.hitReact<=0)return null;
    const duration=this.debugBeat?1.75:1.35,age=duration-e.hitReact;
    if(age<.08)return 4;
    if(age<.16)return 5; // 80 ms / >2 render frames of held contact composition
    if(age<.29)return 6;
    if(age<.42)return 7;
    if(age<.55)return 8;
    if(age<.68)return 9;
    if(age<(this.debugBeat?1.58:1.18))return 10;
    return 11;
  }

  private drawEnemy(e:Enemy){
    const c=this.ctx;
    if(e.kind==='rider'||e.kind==='tank'||e.kind==='drone'||e.kind==='skimmer'||e.kind==='miniboss'||e.kind==='boss'){
      c.save();
      const riderDynamics=e.kind==='rider'?this.riderReactionPose(e):null;
      if(e.kind==='rider'&&riderDynamics){
        const impactFrame=this.riderImpactFrame(e),impactPose=impactFrame===null?null:this.impactTargetPose(impactFrame);
        const shadowX=e.x+(impactPose?.shadowOffset??riderDynamics.shadowOffset),shadowWidth=impactPose?.shadowWidth??riderDynamics.shadowWidth;
        c.save();c.globalAlpha=.3;c.fillStyle='#080811';c.beginPath();c.ellipse(px(shadowX),px(e.y+22),px(shadowWidth*.5),9,0,0,Math.PI*2);c.fill();c.restore();
      }
      if(e.kind==='miniboss'||e.kind==='boss'){c.globalAlpha=.28;c.fillStyle=e.kind==='boss'?'#c339ff':'#000';c.beginPath();c.ellipse(e.x,e.y+(e.kind==='boss'?70:48),e.kind==='boss'?150:105,e.kind==='boss'?34:18,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}
      c.scale(2,2);
      const reaction=e.kind==='rider'?(e.hitReact>.48?1:e.hitReact>0?2:0):0;
      const options={frame:Math.floor(e.t*8),flipX:true,flash:clamp(e.flash*8,0,1),power:1-e.hp/e.maxHp,reaction};
      if(e.kind==='miniboss'){
        const power=clamp(1-e.hp/e.maxHp,0,1);
        const firing=e.fire>0&&e.fire<.18;
        const roadRipperFrame=e.flash>0?2:firing?1:power>.84?5:power>.62?4:power>.32?3:0;
        c.scale(.5,.5);
        const usedRoadRipper=drawSpriteFrame(c,'roadRipper',roadRipperFrame,e.x,e.y+18,{
          width:256,height:166,anchorX:.5,anchorY:.72,
        });
        c.scale(2,2);
        if(!usedRoadRipper)drawPixelBoss(c,'roadReaper',e.x/2,e.y/2,{...options,scale:.84});
      }
      else if(e.kind==='boss'){
        c.scale(.5,.5);
        const power=clamp(1-e.hp/e.maxHp,0,1);
        const bossBodyFrame=e.flash>.105?2:e.flash>0?3:power>.68?5:power>.3?4:e.fire>0&&e.fire<.14?1:0;
        const usedBossBody=drawSpriteFrame(c,'bossBody',bossBodyFrame,e.x,e.y+12,{
          width:360,height:270,anchorX:.5,anchorY:.54,
        });
        if(!usedBossBody){
          c.scale(2,2);
          drawPixelBoss(c,'plutarkianDreadnought',e.x/2,e.y/2,options);
          c.scale(.5,.5);
          const bossCoreFrame=e.flash>.105?3:e.flash>.052?4:e.flash>0?5:power>.58?2:power>.24?1:0;
          drawSpriteFrame(c,'bossCore',bossCoreFrame,e.x-e.w*.2,e.y-e.h*.12,{
            width:116,height:88,anchorX:.5,anchorY:.5,
          });
        }
      }
      else {
        let usedAtlas=false;
        if(e.kind==='rider'){
          const {authoredReaction,squash,wobbleX,wobbleY,rotation,forkOffset,headCounterphase}=riderDynamics!;
          c.scale(.5,.5);
          const impactFrame=this.riderImpactFrame(e);
          if(impactFrame!==null){
            const authoredPose=this.debugWobblePose!==null?{x:wobbleX,y:wobbleY,angle:rotation}:this.impactTargetPose(Math.min(11,impactFrame));
            c.save();c.translate(e.x+authoredPose.x,e.y+16+authoredPose.y);c.rotate(authoredPose.angle*Math.PI/180);
            if(this.debugWobblePose===null){const phasePose=this.impactTargetPose(Math.min(11,impactFrame));c.scale(phasePose.scaleX,phasePose.scaleY);}
            usedAtlas=drawSpriteFrame(c,'riderImpact',this.impactTargetPose(impactFrame).spriteFrame,0,0,{
              width:184,height:138,anchorX:.5,anchorY:.74,alpha:e.flash>0?.8:1,
            });
            if(usedAtlas&&this.debugWobblePose!==null){
              // Re-render two clipped mechanical zones in counterphase. This keeps
              // the body mass rotating while the fork and rider/gun visibly lag.
              c.save();c.beginPath();c.rect(-92,-50,54,86);c.clip();drawSpriteFrame(c,'riderImpact',impactFrame,0,forkOffset,{width:184,height:138,anchorX:.5,anchorY:.74});c.restore();
              c.save();c.beginPath();c.rect(-48,-104,112,58);c.clip();drawSpriteFrame(c,'riderImpact',impactFrame,headCounterphase,0,{width:184,height:138,anchorX:.5,anchorY:.74});c.restore();
            }
            c.restore();
          }
          if(!usedAtlas)usedAtlas=drawSpriteFrame(c,'rider',authoredReaction,e.x+wobbleX,e.y+14+wobbleY,{
            width:156*(1+squash*.08),height:114*(1-squash*.09),anchorX:.5,anchorY:.72,flipX:true,alpha:e.flash>0?.72:1,
          });
          c.scale(2,2);
        }else if(e.kind==='drone'||e.kind==='skimmer'){
          const baseFrame=e.kind==='drone'?0:4;
          const power=clamp(1-e.hp/e.maxHp,0,1);
          const firing=e.fire>0&&e.fire<.18;
          const aerialFrame=baseFrame+(e.flash>0?2:firing?1:power>.55?3:0);
          c.scale(.5,.5);
          usedAtlas=drawSpriteFrame(c,'aerials',aerialFrame,e.x,e.y,{
            width:e.kind==='drone'?118:154,
            height:e.kind==='drone'?82:90,
            anchorX:.5,anchorY:.5,
          });
          c.scale(2,2);
        }
        if(!usedAtlas){
          const kind=e.kind==='rider'?'raider':e.kind==='tank'?'turret':e.kind==='drone'?'drone':'bomber';
          drawPixelEnemy(c,kind,e.x/2,e.y/2,{...options,scale:e.kind==='tank'?1.16:1});
        }
      }
      c.restore();
      if((e.kind==='boss'||e.kind==='miniboss')&&e.flash>0){
        const heat=clamp(e.flash/.14,0,1),radius=e.kind==='boss'?82:48,coreX=px(e.x-e.w*.2),coreY=px(e.y-e.h*.12);
        c.save();c.translate(coreX,coreY);c.globalCompositeOperation='screen';c.globalAlpha=.24+heat*.42;
        c.strokeStyle='#ff5a32';c.lineWidth=4;c.strokeRect(-px(radius*.62),-px(radius*.38),px(radius*1.24),px(radius*.76));
        c.strokeStyle='#ffae4a';c.lineWidth=4;c.strokeRect(-px(radius*.38),-px(radius*.24),px(radius*.76),px(radius*.48));
        c.globalAlpha=.72+heat*.28;c.fillStyle='#fffcd6';c.fillRect(-6,-6,12,12);c.restore();
      }
      return;
    }
    c.save();c.translate(px(e.x),px(e.y));const flash=e.flash>0?'#fff':null;
    if(e.kind==='mine'){
      c.rotate(e.t*2);c.fillStyle=flash||'#782f50';for(let i=0;i<8;i++){c.rotate(Math.PI/4);c.fillRect(9,-3,18,6);}c.beginPath();c.arc(0,0,14,0,Math.PI*2);c.fill();c.fillStyle='#ffdf57';c.beginPath();c.arc(0,0,5+Math.sin(e.t*9)*2,0,Math.PI*2);c.fill();
    }else{
      c.rotate(e.t);c.fillStyle=flash||'#773dac';c.fillRect(-20,-20,40,40);c.fillStyle='#cf77ff';c.fillRect(-12,-12,24,24);c.fillStyle='#100d1b';c.fillRect(-6,-6,12,12);c.strokeStyle=e.flash>0?'#fff':'#f55bda';c.lineWidth=2;c.strokeRect(-24,-24,48,48);
    }
    c.restore();
  }

  private drawShot(s:Projectile){
    const c=this.ctx,age=s.age??0,pulse=(Math.floor(age*18+(s.phase??0))&1)*2;c.save();c.translate(px(s.x),px(s.y));c.rotate(Math.atan2(s.vy,s.vx));
    if(s.kind==='blaster'){
      c.fillStyle='#b93624';c.fillRect(-24-pulse,-6,22+pulse,12);c.fillStyle='#ffd33e';c.fillRect(-8,-6,22,12);c.fillStyle='#fffbd5';c.fillRect(-2,-2,16,4);
    }else if(s.kind==='spread'){
      c.fillStyle='#176f91';c.fillRect(-18-pulse,-8,24+pulse,16);c.fillStyle='#5cecff';c.fillRect(-8,-6,20,12);c.fillStyle='#fff';c.fillRect(0,-2,12,4);
    }else if(s.kind==='laser'){
      c.fillStyle='#8b185e';c.fillRect(-36-pulse*2,-6,64+pulse*2,12);c.fillStyle='#ff55b5';c.fillRect(-28,-4,60,8);c.fillStyle='#fff4fc';c.fillRect(-18,-2,52,4);
    }else if(s.kind==='rockets'){
      c.fillStyle='#a62c25';c.fillRect(-28-pulse*2,-6,20+pulse*2,12);c.fillStyle='#272331';c.fillRect(-10,-8,24,16);c.fillStyle='#e3e0e8';c.fillRect(-6,-4,22,8);
    }else if(s.kind==='orb'){
      const step=(Math.floor(age*12+(s.phase??0))&1)*2,outer=px(s.r+8+step),inner=px(s.r+3);
      c.globalCompositeOperation='lighter';c.strokeStyle='#57135f';c.lineWidth=2;c.strokeRect(-outer,-outer,outer*2,outer*2);c.strokeStyle=s.color;c.lineWidth=2;c.strokeRect(-inner,-inner,inner*2,inner*2);c.fillStyle='#fff4ff';c.fillRect(-4,-4,8,8);
    }else{
      c.fillStyle='#421026';c.fillRect(-18-pulse,-8,28+pulse,16);c.fillStyle=s.color;c.fillRect(-10,-6,22,12);c.fillStyle='#fff0d1';c.fillRect(0,-2,12,4);
    }
    c.restore();
  }

  private drawPickup(q:Pickup){
    const c=this.ctx;
    const kind=q.kind==='health'?'health':q.kind==='armor'?'armor':q.kind==='rapid'?'overdrive':q.kind==='score'?'score':this.player.weapon==='rockets'?'rocket':this.player.weapon==='spread'?'spread':'plasma';
    c.save();c.scale(2,2);drawPixelPickup(c,kind,q.x/2,q.y/2,{frame:Math.floor(this.time*10),scale:.82});c.restore();
  }

  private drawParticle(q:Particle){
    const c=this.ctx,a=clamp(q.life/q.max,0,1),progress=1-a;c.save();c.globalAlpha=a;c.translate(px(q.x),px(q.y));
    if(q.kind==='shard'||q.kind==='debris')c.rotate(Math.round(q.rot/(Math.PI*.25))*Math.PI*.25);
    if(q.kind==='smoke'||q.kind==='dust'){
      const r=px(Math.max(2,q.size*(1.35+progress*.65)));c.fillStyle=q.color;c.fillRect(-r,-px(r*.5),px(r*1.25),r);c.globalAlpha=a*.58;c.fillRect(-px(r*.25),-r,px(r*1.1),r);
    }else if(q.kind==='impact'){
      const r=px(q.size*(.75+progress*.65));c.globalCompositeOperation='lighter';c.fillStyle='#ff7538';c.fillRect(-r,-4,r*2,8);c.fillRect(-4,-r,8,r*2);const mid=px(Math.max(4,r*.58));c.fillStyle=q.color;c.fillRect(-mid,-4,mid*2,8);c.fillRect(-4,-mid,8,mid*2);c.fillStyle='#fff';c.fillRect(-4,-4,8,8);
    }else if(q.kind==='shard'){
      const size=px(Math.max(4,q.size));c.fillStyle=q.color;c.fillRect(-size,-px(size*.5),size*2,size);c.fillStyle='#fff';c.fillRect(0,-2,size,2);
    }else if(q.kind==='blast'){
      const r=px(Math.max(4,q.size*(.18+progress*.86))),core=px(Math.max(4,r*.5));c.globalCompositeOperation='lighter';c.globalAlpha=Math.min(1,a*1.7);c.fillStyle=progress<.22?'#fffde0':progress<.58?'#ffad35':q.color;c.fillRect(-core,-core,core*2,core*2);c.globalAlpha=a*.9;c.strokeStyle=progress<.35?'#fff8c7':'#ff6638';c.lineWidth=4;c.strokeRect(-r,-r,r*2,r*2);if(progress>.42){const outer=px(r*1.28);c.globalAlpha=a*.65;c.strokeStyle=q.color;c.lineWidth=2;c.strokeRect(-outer,-outer,outer*2,outer*2);}
    }else if(q.kind==='spark'){
      const length=px(clamp(Math.hypot(q.vx,q.vy)*.035,4,18));c.rotate(Math.atan2(q.vy,q.vx));c.fillStyle=q.color;c.fillRect(-length,-2,length,4);
    }else if(q.kind==='ring'){
      const r=px(Math.max(4,q.size*(1-a+1)));c.strokeStyle=q.color;c.lineWidth=2;c.strokeRect(-r,-r,r*2,r*2);
    }else{const size=px(Math.max(2,q.size));c.fillStyle=q.color;c.fillRect(-size/2,-size/2,size,size);}
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
    const c=this.ctx,pulse=.5+.5*Math.sin(this.time*5.5);
    drawEnvironment(c,{scroll:this.time*58,elapsed:82,speed:185,time:this.time,shake:0,intensity:.55});
    const veil=c.createLinearGradient(0,0,0,H);veil.addColorStop(0,'rgba(6,3,15,.82)');veil.addColorStop(.52,'rgba(8,4,18,.67)');veil.addColorStop(1,'rgba(4,2,11,.94)');c.fillStyle=veil;c.fillRect(0,0,W,H);
    c.fillStyle='#090612e8';c.fillRect(0,0,W,91);c.fillStyle='#ef3e67';c.fillRect(0,88,W,3);c.fillStyle='#fff16d';c.fillRect(312,88,336,3);
    c.save();c.translate(480,0);c.transform(1,0,-.08,1,0,0);c.fillStyle='#160b22';c.fillRect(-292,13,584,58);c.strokeStyle='#70405c';c.lineWidth=2;c.strokeRect(-292,13,584,58);c.restore();
    this.text('CHOOSE YOUR RIDER',480,48,31,'#fff16d','center',true);this.text('THREE RIDERS // ONE REDLINE',480,70,12,'#d7b8df','center',true);
    for(let i=0;i<HEROES.length;i++){
      const h=HEROES[i],active=i===this.selected,cx=180+i*300,w=active?280:248,hh=active?354:330,x=cx-w/2,y=active?99:112,portraitH=active?195:171;c.save();
      c.shadowColor=active?h.accent:'#030109';c.shadowBlur=active?22:10;c.fillStyle=active?'#21152ff5':'#0a0814e8';c.fillRect(x,y,w,hh);c.shadowBlur=0;
      c.strokeStyle=active?h.accent:'#3b3048';c.lineWidth=active?4:2;c.strokeRect(x,y,w,hh);c.fillStyle=active?h.accent:'#46364f';c.fillRect(x+4,y+4,w-8,active?4:2);
      const portraitTop=y+7,portraitBottom=portraitTop+portraitH;
      const portraitGradient=c.createLinearGradient(0,portraitTop,0,portraitBottom);portraitGradient.addColorStop(0,active?'#352048':'#1a1325');portraitGradient.addColorStop(1,'#090712');c.fillStyle=portraitGradient;c.fillRect(x+6,portraitTop,w-12,portraitH);
      if(active){c.globalAlpha=.11+.05*pulse;c.fillStyle=h.accent;for(let xx=x-80;xx<x+w;xx+=28){c.beginPath();c.moveTo(xx,portraitBottom);c.lineTo(xx+92,portraitTop);c.lineTo(xx+103,portraitTop);c.lineTo(xx+11,portraitBottom);c.fill();}c.globalAlpha=1;}
      c.save();c.beginPath();c.rect(x+6,portraitTop,w-12,portraitH);c.clip();
      const portraitDrawn=drawHeroPortrait(c,h.id,cx,portraitBottom+7,active?278:240,active?209:180,{alpha:active?1:.7,selected:active,pulse,edgeColor:h.accent});
      if(!portraitDrawn)this.drawPortrait(h,cx,portraitTop+(active?139:127),active?1.2:.98);
      if(!active){c.fillStyle='rgba(7,5,13,.18)';c.fillRect(x+6,portraitTop,w-12,portraitH);}c.restore();
      c.fillStyle=active?'#0b0715f2':'#08060fdc';c.fillRect(x+7,portraitBottom,w-14,hh-portraitH-8);c.fillStyle=active?h.accent:'#3a2e44';c.fillRect(x+7,portraitBottom,w-14,3);
      if(active){c.fillStyle=h.accent;c.fillRect(x+8,y+8,72,18);this.text('SELECTED',x+44,y+22,9,'#090611','center',true);}
      const nameY=portraitBottom+30;this.text(h.name,cx,nameY,active?27:23,active?h.accent:'#b0a6b7','center',true);this.text(h.epithet,cx,nameY+17,10,active?'#f1e3f3':'#9f94a6','center');
      const names=['POWER','SPEED','ARMOR'],statsY=nameY+31;names.forEach((name,n)=>{const yy=statsY+n*14;this.text(name,x+18,yy+8,9,active?'#baadbf':'#817686');for(let s=0;s<5;s++){c.fillStyle=s<h.stats[n]?(active?h.accent:'#665b70'):'#27212f';c.fillRect(x+w-126+s*20,yy,14,8);if(active&&s<h.stats[n]){c.fillStyle='#ffffff66';c.fillRect(x+w-124+s*20,yy+1,10,2);}}});
      const arsenalY=y+hh-31;c.fillStyle=active?'#160d22':'#0d0914';c.fillRect(x+8,arsenalY-14,w-16,38);c.fillStyle=active?h.accent:'#3c3047';c.fillRect(x+8,arsenalY-14,3,38);this.text(h.weapon.toUpperCase(),x+18,arsenalY,11,'#ffd861','left',true);this.text(h.special,x+w-17,arsenalY+18,10,active?'#92f4e5':'#766f7c','right',true);
      c.fillStyle=active?h.accent:'#4a3a53';c.fillRect(x,portraitBottom-1,16,3);c.fillRect(x+w-16,portraitBottom-1,16,3);
      c.restore();
    }
    c.globalAlpha=.58+.42*pulse;this.text('<',24,286,30,'#fff16b','center',true);this.text('>',936,286,30,'#fff16b','center',true);c.globalAlpha=1;
    c.fillStyle='#080510ed';c.fillRect(68,465,824,59);c.strokeStyle='#5e426e';c.lineWidth=2;c.strokeRect(68,465,824,59);c.fillStyle='#ef3e67';c.fillRect(70,467,4,55);c.fillStyle='#5de4e0';c.fillRect(886,467,4,55);
    this.text('A / D  OR  LEFT / RIGHT   CHOOSE     ENTER / Z   CONFIRM     ESC   BACK',480,488,13,'#fff','center',true);this.text('IN RIDE:  MOVE WASD / ARROWS   |   Z FIRE   |   X JUMP   |   C SPECIAL   |   P PAUSE',480,511,10,'#bfb1c8','center');
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
