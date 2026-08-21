import {
  drawBoss as drawPixelBoss,
  drawEnemy as drawPixelEnemy,
  drawHero as drawPixelHero,
  drawPickup as drawPixelPickup,
} from './art';
import { drawEnvironment, drawEnvironmentForeground } from './environment';
import { drawHeroPortrait, preloadSelectPortraits } from './selectPortraits';
import { drawSpriteFrame, getSpriteSheetStatus, preloadSpriteSheets } from './spriteAtlas';
import { BeatEmUpStage, type BrawlerControls, type BrawlerHeroId } from './beatEmUp';
import { gameEvents } from './core/GameEvents';
import { HighScoreStore, type HighScore } from './core/HighScoreStore';
import { InputController } from './core/InputController';
import { campaign, FURNACE_DISTRICT, VENUS_HIGHWAY } from './levels/campaign';
import type { BrawlerLevelDefinition } from './levels/types';
import {
  FIRE_RELEASE_DURATION,
  HERO_AUTHORED_SIZE,
  HEROES,
  INTRO_PANELS,
} from './rider/catalog';
import { RiderPoseResolver } from './rider/RiderPoseResolver';
import type {
  GameMode,
  HeroBodySheet,
  HeroId,
  HeroSpec,
  RiderEnemy as Enemy,
  RiderEnemyKind as EnemyKind,
  RiderFloater as Floater,
  RiderImpactEvent,
  RiderParticle as Particle,
  RiderPickup as Pickup,
  RiderPickupKind as PickupKind,
  RiderPlayer as Player,
  RiderProjectile as Projectile,
  Weapon,
} from './rider/types';

const W = 960;
const H = 540;
const LEVEL_BOSS_TIME = VENUS_HIGHWAY.bossAtSeconds;
const PLAYER_Y_MIN = 300;
const PLAYER_Y_MAX = 454;

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

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rnd(min: number, max: number) { return min + Math.random() * (max - min); }
function px(v: number) { return Math.round(v / 2) * 2; }
function hit(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function emitAudio(name: string, volume = 1, pitch = 1) {
  gameEvents.sound(name, volume, pitch);
}
function emitMusic(cue: string, intensity = 1) {
  gameEvents.music(cue, intensity);
}

export class VenusGame {
  private ctx: CanvasRenderingContext2D;
  private readonly input: InputController;
  private readonly highScoreStore = new HighScoreStore();
  private readonly riderPose = new RiderPoseResolver();
  private mode: GameMode = 'title';
  private last = 0;
  private time = 0;
  private selected = 0;
  private selectedHeroes: [number,number] = [0,1];
  private coopEnabled = false;
  private selectReady: [boolean,boolean] = [false,false];
  private player!: Player;
  private players: Player[] = [];
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
  private brawler: BeatEmUpStage | null = null;
  private pausedFrom: 'playing' | 'brawler' = 'playing';
  private currentLevelId = VENUS_HIGHWAY.id;
  private completedStage = 1;
  private debugStageOneOnly = false;
  private brawlerScoreCommitted = false;
  private debugBeat = false;
  private debugWobblePose: number | null = null;
  private debugImpactStage: number | null = null;
  private debugSustainedFire = false;
  private debugFireHeld = false;
  private finishClock = 0;
  private titleChoice = 0;
  private highScores: HighScore[] = [];
  private lastFriendlyFireProbe: {ownerId:number;targetId:number;crossedTarget:boolean;before:Array<{id:number;hp:number;armor:number}>;after:Array<{id:number;hp:number;armor:number}>} | null = null;
  private titleArt = new Image();
  private introArt: HTMLImageElement[] = [];
  private introPanel = 0;
  private introClock = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.input = new InputController(canvas);
    // Atlas loading is deliberately non-blocking. Until every individual PNG is
    // ready, its existing procedural counterpart remains the renderer of record.
    void preloadSpriteSheets();
    void preloadSelectPortraits();
    this.titleArt.src = '/assets/venus-title-key-art.png';
    this.introArt = INTRO_PANELS.map(panel => {
      const image = new Image();
      image.decoding = 'async';
      image.src = panel.src;
      return image;
    });
    this.highScores = this.highScoreStore.load();
    const query = new URLSearchParams(location.search);
    const hero = query.get('hero') as HeroId | null;
    if (hero && HEROES.some(h => h.id === hero)) this.selected = this.selectedHeroes[0] = HEROES.findIndex(h => h.id === hero);
    const scene = query.get('scene');
    if (scene === 'select') this.mode = 'select';
    else if(scene==='coop-select'){this.coopEnabled=true;this.mode='select';}
    else if(scene==='intro'){
      this.beginIntro();
      this.introPanel=clamp(Math.floor(Number(query.get('panel'))||0),0,INTRO_PANELS.length-1);
    }
    else if(scene==='coop'||scene==='coop-ride'||scene==='coop-boss'){
      this.coopEnabled=true;this.beginRun();if(scene==='coop-boss')this.debugCoopBoss();
    }
    else if (scene === 'brawler' || scene === 'brawler-boss' || scene === 'brawler-coop' || scene === 'brawler-coop-boss') {
      this.coopEnabled = scene.includes('coop');
      this.beginBrawler(scene.endsWith('boss'));
    }
    else if (scene === 'stage-transition') this.debugStageTransition();
    else if (scene === 'game' || scene === 'boss' || scene === 'sustain') {
      this.beginRun();
      if (scene === 'boss') this.debugBoss();
      else if (scene === 'sustain') this.debugSustain(query.get('rapid') === '1');
      else this.elapsed = clamp(Number(query.get('time')) || 0, 0, LEVEL_BOSS_TIME);
    }
  }

  start() {
    emitMusic(this.mode === 'title' ? 'title' : this.mode === 'select' ? 'select' : this.mode === 'intro' ? 'intro' : this.mode === 'brawler' ? 'brawler' : 'stage', this.mode === 'title' ? .65 : this.mode === 'intro' ? .36 : .86);
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number) => {
    const dt = Math.min(.034, (now - this.last) / 1000 || .016);
    this.last = now;
    this.time += dt;
    this.input.pollGamepads();
    this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.mode === 'title') this.updateTitle();
    else if (this.mode === 'select') this.updateSelect();
    else if (this.mode === 'intro') this.updateIntro(dt);
    else if (this.mode === 'playing') this.updatePlaying(dt);
    else if (this.mode === 'brawler') this.updateBrawler(dt);
    else if (this.mode === 'paused') this.updatePause();
    else this.updateEnd();
  }

  private updateTitle() {
    if (this.input.tap('ArrowUp','KeyW','ArrowDown','KeyS','P1PadUp','P1PadDown')) { this.titleChoice = 1 - this.titleChoice; emitAudio('menu_move'); }
    if (this.input.tap('Enter','Space','KeyZ','P1PadFire','P1PadStart')) {
      if (this.titleChoice === 0) { this.mode = 'select'; emitAudio('menu_accept'); emitMusic('select', .7); }
      else { this.highScores = []; localStorage.removeItem('venus-stampede-highscores'); emitAudio('menu_back'); }
    }
  }

  private updateSelect() {
    if(this.input.tap('Tab')){this.coopEnabled=!this.coopEnabled;this.selectReady=[false,false];emitAudio('menu_accept');}
    if (this.input.tap('KeyA','P1PadLeft')) { this.selected = this.selectedHeroes[0] = (this.selectedHeroes[0] + 2) % 3; this.selectReady[0]=false; emitAudio('menu_move'); }
    if (this.input.tap('KeyD','P1PadRight')) { this.selected = this.selectedHeroes[0] = (this.selectedHeroes[0] + 1) % 3; this.selectReady[0]=false; emitAudio('menu_move'); }
    if(!this.coopEnabled){
      if(this.input.tap('ArrowLeft')){this.selected=this.selectedHeroes[0]=(this.selectedHeroes[0]+2)%3;emitAudio('menu_move');}
      if(this.input.tap('ArrowRight')){this.selected=this.selectedHeroes[0]=(this.selectedHeroes[0]+1)%3;emitAudio('menu_move');}
    }else{
      if(this.input.tap('ArrowLeft','P2PadLeft')){this.selectedHeroes[1]=(this.selectedHeroes[1]+2)%3;this.selectReady[1]=false;emitAudio('menu_move');}
      if(this.input.tap('ArrowRight','P2PadRight')){this.selectedHeroes[1]=(this.selectedHeroes[1]+1)%3;this.selectReady[1]=false;emitAudio('menu_move');}
    }
    if (this.input.tap('Escape','Backspace')) { this.mode = 'title'; emitMusic('title'); }
    if(!this.coopEnabled&&this.input.tap('Enter','Space','KeyZ','P1PadFire','P1PadStart'))this.beginIntro();
    else if(this.coopEnabled){
      if(this.input.tap('KeyZ','P1PadFire','P1PadStart')){this.selectReady[0]=true;emitAudio('menu_accept');}
      if(this.input.tap('Numpad1','NumpadDivide','Slash','P2PadFire','P2PadStart')){this.selectReady[1]=true;emitAudio('menu_accept');}
      if(this.selectReady[0]&&this.selectReady[1])this.beginIntro();
    }
  }

  private beginIntro() {
    this.selected = this.selectedHeroes[0];
    this.introPanel = 0;
    this.introClock = 0;
    this.mode = 'intro';
    emitAudio('menu_accept');
    emitMusic('intro', .36);
  }

  private advanceIntro() {
    if (this.introPanel >= INTRO_PANELS.length - 1) {
      this.beginRun();
      return;
    }
    this.introPanel += 1;
    this.introClock = 0;
    if (this.introPanel === 1) emitAudio('explode', .82);
    else emitAudio('menu_move', .5);
  }

  private updateIntro(dt: number) {
    if (this.input.tap('Escape','Backspace','P1PadStart','P2PadStart')) {
      this.beginRun();
      return;
    }
    if (this.input.tap('Enter','Space','KeyZ','Numpad1','NumpadDivide','Slash','P1PadFire','P2PadFire')) {
      this.advanceIntro();
      return;
    }
    const image = this.introArt[this.introPanel];
    if (image?.complete && image.naturalWidth > 0) this.introClock += dt;
    if (this.introClock >= INTRO_PANELS[this.introPanel].duration) this.advanceIntro();
  }

  private makePlayer(id:1|2,heroIndex:number):Player{
    const hero=HEROES[heroIndex];
    const solo=!this.coopEnabled;
    return {id,heroIndex,alive:true,downed:false,x:solo?168:id===1?156:252,y:solo?406:id===1?390:438,jump:0,jumpV:0,hp:hero.maxHp,armor:hero.maxArmor*.5,invuln:0,cooldown:0,weapon:hero.weapon,weaponRank:1,rapid:0,special:45,specialTime:0,lean:0,wheel:0,recoil:0,fireHeld:false,fireLoop:0,fireReleaseBlend:0,fireReleaseElapsed:-1,shotsFired:0,lastMuzzle:null,lastExhaust:null,exhaustClock:0};
  }

  private beginRun() {
    this.selected=this.selectedHeroes[0];
    const hero = HEROES[this.selected];
    this.players=[this.makePlayer(1,this.selectedHeroes[0])];
    if(this.coopEnabled)this.players.push(this.makePlayer(2,this.selectedHeroes[1]));
    this.player=this.players[0];
    this.enemies = []; this.shots = []; this.pickups = []; this.particles = []; this.floaters = []; this.lastProjectileOrigin = null;
    this.elapsed = 0; this.distance = 0; this.worldSpeed = hero.speed; this.score = 0; this.combo = 1; this.comboClock = 0; this.kills = 0;this.lastFriendlyFireProbe=null;
    this.spawnClock = 1; this.obstacleClock = 4; this.minibossSpawned = false; this.bossSpawned = false; this.bossDefeated = false; this.debugBeat = false; this.debugWobblePose = null; this.debugImpactStage = null; this.debugSustainedFire = false; this.debugFireHeld = false; this.riderImpacts=[]; this.finishClock = 0;
    this.brawler = null; this.currentLevelId = campaign.first().id; this.completedStage = 1; this.debugStageOneOnly = false; this.brawlerScoreCommitted = false; this.pausedFrom = 'playing';
    this.mode = 'playing';
    emitAudio('engine_start'); emitMusic('stage', .86);
  }

  private updatePause() {
    if (this.input.tap('Escape','Enter','KeyP','P1PadStart','P2PadStart')) { this.mode = this.pausedFrom; emitAudio('menu_accept'); emitMusic(this.pausedFrom === 'brawler' ? (this.brawler?.snapshot().boss ? 'boss' : 'brawler') : this.bossSpawned ? 'boss' : 'stage'); }
    if (this.input.tap('KeyR')) this.pausedFrom === 'brawler' ? this.beginBrawler(false) : this.beginRun();
  }

  private updateEnd() {
    if (this.input.tap('Enter','Space','KeyZ','P1PadFire','P1PadStart')) this.beginRun();
    if (this.input.tap('Escape')) { this.mode = 'title'; emitMusic('title'); }
  }

  private updatePlaying(dt: number) {
    if (this.input.tap('Escape','Enter','KeyP','P1PadStart','P2PadStart')) { this.pausedFrom = 'playing'; this.mode = 'paused'; emitAudio('pause'); emitMusic('pause', .35); return; }
    // The twelve production impact frames are frozen authored instants.  They
    // still use the production world/entity/projectile renderer, but do not
    // drift while Playwright encodes a PNG.
    if (this.debugImpactStage !== null) return;
    const hero = HEROES[this.player.heroIndex];
    const p = this.player;
    this.comboClock -= dt;
    if (this.comboClock <= 0 && this.combo > 1) { this.combo = Math.max(1, this.combo - dt * 2.6); }
    for(const rider of this.players)if(rider.alive)this.updatePlayerControls(rider,dt);

    const bossAlive = this.enemies.some(e => e.kind === 'boss' || e.kind === 'miniboss');
    const lead=this.players.find(r=>r.alive)??p,leadHero=HEROES[lead.heroIndex];
    const mx=(lead.debugInput?.right||this.input.down(lead.id===1?'KeyD':'ArrowRight',`P${lead.id}PadRight`)?1:0)-(lead.debugInput?.left||this.input.down(lead.id===1?'KeyA':'ArrowLeft',`P${lead.id}PadLeft`)?1:0);
    const worldSpeed = (bossAlive ? 105 : leadHero.speed + mx * 45) * (lead.specialTime > 0 && leadHero.id === 'cassia' ? 1.28 : 1);
    this.worldSpeed = worldSpeed;
    for(const rider of this.players)if(rider.alive)rider.wheel += worldSpeed * dt * .045;
    this.distance += worldSpeed * dt;
    if (!this.bossSpawned) this.elapsed += dt;
    this.spawnClock -= dt; this.obstacleClock -= dt;
    if (!this.debugBeat && !this.debugSustainedFire && !bossAlive && !this.bossSpawned && this.spawnClock <= 0) this.spawnWave();
    if (!this.debugBeat && !this.debugSustainedFire && !bossAlive && this.obstacleClock <= 0) this.spawnObstacle();
    if (!this.debugBeat && !this.debugSustainedFire && !this.minibossSpawned && this.elapsed >= VENUS_HIGHWAY.minibossAtSeconds) { this.minibossSpawned = true; this.spawnEnemy('miniboss', 1010, 393); emitMusic('miniboss'); }
    if (!this.debugBeat && !this.debugSustainedFire && !this.bossSpawned && this.elapsed >= LEVEL_BOSS_TIME) { this.bossSpawned = true; this.enemies = this.enemies.filter(e => e.x > 0); this.spawnEnemy('boss', 1110, 295); emitMusic('boss'); emitAudio('warning'); }

    this.updateEnemies(dt, worldSpeed);
    this.updateShots(dt);
    this.updatePickups(dt, worldSpeed);
    this.updateParticles(dt, worldSpeed);
    this.handleCollisions();
    this.flash = Math.max(0, this.flash - dt * 3.5); this.shake = Math.max(0, this.shake - dt * 20);

    for(const rider of this.players)if(rider.alive&&!this.debugBeat){rider.exhaustClock-=dt;if(rider.exhaustClock<=0){this.emitBikeExhaust(rider);rider.exhaustClock=rider.specialTime>0?.055:.095;}}
    if (this.bossDefeated) {
      this.finishClock += dt;
      if (this.finishClock > 4.8) {
        if (this.debugStageOneOnly) this.finishRun(true);
        else this.beginBrawler(false);
      }
    }
  }

  private beginBrawler(debugBoss = false, requestedLevel?: BrawlerLevelDefinition) {
    const heroes = (this.coopEnabled ? this.selectedHeroes : [this.selectedHeroes[0]])
      .map(index => HEROES[index].id as BrawlerHeroId);
    const active = campaign.get(this.currentLevelId);
    const candidate = requestedLevel ?? (active.runtime === 'brawler' ? active : campaign.nextAfter(active.id));
    const level = candidate?.runtime === 'brawler' ? candidate : FURNACE_DISTRICT;
    this.brawler = new BeatEmUpStage(this.ctx, { level, heroes, debugBoss });
    this.mode = 'brawler';
    this.pausedFrom = 'brawler';
    this.currentLevelId = level.id;
    this.completedStage = level.order;
    this.brawlerScoreCommitted = false;
    this.finishClock = 0;
  }

  private brawlerControls(id: 1 | 2): BrawlerControls {
    const solo = !this.coopEnabled;
    const p = `P${id}Pad`;
    const leftKeys = id === 1 ? ['KeyA', `${p}Left`, ...(solo ? ['ArrowLeft'] : [])] : ['ArrowLeft', `${p}Left`];
    const rightKeys = id === 1 ? ['KeyD', `${p}Right`, ...(solo ? ['ArrowRight'] : [])] : ['ArrowRight', `${p}Right`];
    const upKeys = id === 1 ? ['KeyW', `${p}Up`, ...(solo ? ['ArrowUp'] : [])] : ['ArrowUp', `${p}Up`];
    const downKeys = id === 1 ? ['KeyS', `${p}Down`, ...(solo ? ['ArrowDown'] : [])] : ['ArrowDown', `${p}Down`];
    const attackKeys = id === 1 ? ['KeyZ', `${p}Fire`] : ['Numpad1', 'NumpadDivide', 'Slash', `${p}Fire`];
    const jumpKeys = id === 1 ? ['KeyX', 'KeyK', 'ShiftLeft', `${p}Jump`] : ['Numpad2', `${p}Jump`];
    const specialKeys = id === 1 ? ['KeyC', `${p}Special`] : ['Numpad3', `${p}Special`];
    return {
      left: this.input.down(...leftKeys), right: this.input.down(...rightKeys),
      up: this.input.down(...upKeys), down: this.input.down(...downKeys),
      attack: this.input.down(...attackKeys), attackPressed: this.input.tap(...attackKeys),
      jumpPressed: this.input.tap(...jumpKeys), specialPressed: this.input.tap(...specialKeys),
    };
  }

  private updateBrawler(dt: number) {
    if (!this.brawler) { this.beginBrawler(false); return; }
    if (this.input.tap('Escape','Enter','KeyP','P1PadStart','P2PadStart')) {
      this.pausedFrom = 'brawler'; this.mode = 'paused'; emitAudio('pause'); emitMusic('pause', .35); return;
    }
    const controls = this.coopEnabled ? [this.brawlerControls(1), this.brawlerControls(2)] : [this.brawlerControls(1)];
    this.brawler.update(dt, controls);
    const state = this.brawler.snapshot();
    if (state.finishReady) {
      const next = state.status === 'victory' ? campaign.nextAfter(this.currentLevelId) : null;
      if (next?.runtime === 'brawler') this.beginBrawler(false, next);
      else this.finishRun(state.status === 'victory');
    }
  }

  private updatePlayerControls(p:Player,dt:number){
    const hero=HEROES[p.heroIndex],debug=p.debugInput;
    p.invuln=Math.max(0,p.invuln-dt);p.cooldown-=dt;p.recoil=Math.max(0,p.recoil-dt);p.rapid=Math.max(0,p.rapid-dt);p.specialTime=Math.max(0,p.specialTime-dt);
    const solo=this.players.length===1;
    const right=debug?.right??this.input.down(p.id===1?'KeyD':'ArrowRight',`P${p.id}PadRight`,...(solo?['ArrowRight']:[]));
    const left=debug?.left??this.input.down(p.id===1?'KeyA':'ArrowLeft',`P${p.id}PadLeft`,...(solo?['ArrowLeft']:[]));
    const down=debug?.down??this.input.down(p.id===1?'KeyS':'ArrowDown',`P${p.id}PadDown`,...(solo?['ArrowDown']:[]));
    const up=debug?.up??this.input.down(p.id===1?'KeyW':'ArrowUp',`P${p.id}PadUp`,...(solo?['ArrowUp']:[]));
    const mx=(right?1:0)-(left?1:0),my=(down?1:0)-(up?1:0),controlSpeed=hero.speed*(p.specialTime>0&&hero.id==='nova'?1.25:1);
    p.x=clamp(p.x+mx*controlSpeed*dt,72,410);p.y=clamp(p.y+my*controlSpeed*.64*dt,PLAYER_Y_MIN,PLAYER_Y_MAX);p.lean=lerp(p.lean,mx,dt*8);
    const jump=debug?.jump??this.input.tap(p.id===1?'KeyX':'Numpad2',`P${p.id}PadJump`,...(solo?['KeyK','ShiftLeft']:[]));
    if(jump&&p.jump===0){p.jumpV=390;emitAudio('jump');if(debug)debug.jump=false;}
    if(p.jumpV!==0||p.jump>0){p.jump+=p.jumpV*dt;p.jumpV-=850*dt;if(p.jump<=0){p.jump=0;p.jumpV=0;this.dust(p.x-20,p.y+10,9);emitAudio('land',.55);}}
    const wasFireHeld=p.fireHeld;
    const fireHeld=this.debugSustainedFire&&p.id===1?this.debugFireHeld:(debug?.fire??this.input.down(p.id===1?'KeyZ':'Numpad1',`P${p.id}PadFire`,...(p.id===2?['NumpadDivide','Slash']:solo?['KeyJ','Space']:[])));
    p.fireHeld=fireHeld;
    if(fireHeld){p.fireLoop+=dt;p.fireReleaseBlend=1;p.fireReleaseElapsed=-1;}else{if(wasFireHeld)p.fireReleaseElapsed=0;else if(p.fireReleaseElapsed>=0)p.fireReleaseElapsed+=dt;if(p.fireReleaseElapsed>=FIRE_RELEASE_DURATION)p.fireReleaseElapsed=-1;p.fireReleaseBlend=p.fireReleaseElapsed>=0?1-p.fireReleaseElapsed/FIRE_RELEASE_DURATION:0;if(p.fireReleaseElapsed<0)p.fireLoop=0;}
    if(fireHeld&&p.cooldown<=0)this.firePlayer(p);
    const special=debug?.special??this.input.tap(p.id===1?'KeyC':'Numpad3',`P${p.id}PadSpecial`,...(solo?['KeyL','ControlLeft']:[]));
    if(special&&p.special>=100)this.useSpecial(p);if(debug)debug.special=false;
  }

  private emitBikeExhaust(p:Player){
    const outlet=this.riderPose.exhaust(p,this.debugImpactStage),hero=HEROES[p.heroIndex].id;
    const heavy=hero==='bruna',boost=p.specialTime>0;
    p.lastExhaust={x:outlet.x,y:outlet.y,sheet:outlet.sheet,frame:outlet.frame};
    this.particles.push({x:outlet.x-1,y:outlet.y+rnd(heavy?-5:-2,heavy?5:2),vx:rnd(boost?-155:-115,boost?-95:-58),vy:rnd(-13,9),life:rnd(.22,.38),max:.38,size:rnd(heavy?4:3,heavy?7:5.5),color:boost?(hero==='nova'?'#ff68b3':'#67e8ff'):(Math.random()<.58?'#4d4658':'#82717a'),kind:'smoke',rot:0});
    if(boost||Math.random()<.18)this.particles.push({x:outlet.x,y:outlet.y,vx:rnd(-125,-78),vy:rnd(-5,5),life:.12,max:.12,size:rnd(2,4),color:hero==='cassia'?'#ffb43d':hero==='bruna'?'#69e8ff':'#ff5fa7',kind:'fire',rot:0});
  }

  private firePlayer(p=this.player) {
    const hero = HEROES[p.heroIndex];
    const rate = hero.fireRate * (p.rapid > 0 ? .56 : 1) * (p.specialTime > 0 && hero.id === 'cassia' ? .5 : 1) / (1 + (p.weaponRank - 1) * .08);
    p.cooldown = rate;
    p.shotsFired++;
    // A short visual timer drives only the muzzle pulse.  The body animation is
    // intentionally owned by the held-trigger state machine above.
    p.recoil = .072;
    const muzzle=this.riderPose.muzzle(p,this.debugImpactStage),x=muzzle.x,y=muzzle.y;
    p.lastMuzzle={x,y,sheet:muzzle.sheet,frame:muzzle.frame};
    if(p.id===1)this.lastProjectileOrigin={x,y,barrelX:muzzle.x,barrelY:muzzle.y,hero:hero.id,sheet:muzzle.sheet,frame:muzzle.frame};
    // The authored bike guns sit below the old placeholder origin.  Preserve
    // the established enemy/collision lane by aiming gently toward that line
    // over the next 500px; the projectile still visibly begins at the barrel.
    const collisionLaneY=p.y-p.jump-31;
    const add = (vx:number, vy:number, damage:number, r:number, color:string, kind:Weapon, pierce=0, homing=false) => this.shots.push({x,y,vx,vy:vy+(collisionLaneY-y)*Math.abs(vx)/500,r,life:2,damage,friendly:true,color,kind,pierce,homing,age:0,phase:rnd(0,Math.PI*2),ownerId:p.id});
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

  private useSpecial(p=this.player) {
    const hero = HEROES[p.heroIndex];
    p.special = 0; this.flash = .35; this.shake = 9; emitAudio('special', 1); emitMusic('special', 1);
    if (hero.id === 'bruna') {
      for (const e of this.enemies) { e.hp -= 65; e.flash = .25; }
      this.shots = this.shots.filter(s => s.friendly);
      this.ring(p.x, p.y-p.jump, '#65eaff', 14);
    } else {
      p.specialTime = hero.id === 'nova' ? 5.5 : 6.5;
      p.invuln = Math.max(p.invuln, hero.id === 'nova' ? 5.5 : 1.4);
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
    const p = this.players.find(r=>r.alive)??this.player;
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
    const living=this.players.filter(p=>p.alive);const target=living.length?living.reduce((best,p)=>Math.hypot(p.x-sx,p.y-p.jump-sy)<Math.hypot(best.x-sx,best.y-best.jump-sy)?p:best):this.player;
    const base = Math.atan2((target.y-target.jump-25)-sy, target.x-sx);
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
            const owner=this.players.find(p=>p.id===s.ownerId)??this.player;
            this.comboClock=1.15;this.combo=clamp(this.combo+.055,1,9.9);this.score+=Math.ceil(3*this.combo);owner.special=clamp(owner.special+.42,0,100);
            if(e.kind==='boss'||e.kind==='miniboss')this.shake=Math.max(this.shake,s.kind==='rockets'?2.1:1.35);
            if(s.kind==='rockets'){this.blast(s.x,s.y,35,s.color,undefined,2.1);for(const other of this.enemies)if(Math.hypot(other.x-s.x,other.y-s.y)<74)other.hp-=s.damage*.45;}
            if(s.pierce>0)s.pierce--;else s.life=0;
            if(e.hp<=0)this.killEnemy(e);
            break;
          }
        }
      } else if(s.life>0){
        for(const p of this.players){if(!p.alive||p.invuln>0)continue;const pr={x:p.x-29,y:p.y-p.jump-46,w:64,h:48};if(hit({x:s.x-s.r,y:s.y-s.r,w:s.r*2,h:s.r*2},pr)){s.life=0;this.damagePlayer(p,s.damage,s.x,s.y);break;}}
      }
    }
    for(const e of this.enemies){
      if(e.hp<=0)continue;
      for(const p of this.players){if(!p.alive)continue;const pr={x:p.x-29,y:p.y-p.jump-46,w:64,h:48};const jumpSafe=!e.aerial&&p.jump>44;
        if(!jumpSafe&&p.invuln<=0&&hit(pr,{x:e.x-e.w*.42,y:e.y-e.h*.45,w:e.w*.84,h:e.h*.84})){this.damagePlayer(p,e.kind==='boss'?28:e.kind==='mine'?24:16,e.x,e.y);e.hp-=e.kind==='boss'?10:35;if(e.hp<=0)this.killEnemy(e);break;}
      }
    }
    for(const q of this.pickups){
      for(const p of this.players){if(!p.alive)continue;const pr={x:p.x-29,y:p.y-p.jump-46,w:64,h:48};if(q.t>=0&&hit(pr,{x:q.x-15,y:q.y-15,w:30,h:30})){q.t=-999;this.collect(q,p);break;}}
    }
    this.pickups=this.pickups.filter(q=>q.t>-100);
  }

  private damagePlayer(p:Player,amount:number,x:number,y:number){
    if(p.armor>0){const soaked=Math.min(p.armor,amount*.72);p.armor-=soaked;amount-=soaked;}
    p.hp-=amount;p.invuln=.95;this.shake=12;this.flash=.22;this.combo=1;this.comboClock=0;this.blast(x,y,25,'#ff6838');emitAudio('player_hit',.8);
    if(p.hp<=0){p.hp=0;p.alive=false;p.downed=true;p.fireHeld=false;this.blast(p.x,p.y-p.jump,70,'#ff4b2e',32);if(!this.players.some(r=>r.alive))this.finishRun(false);}
  }

  private killEnemy(e:Enemy){
    if(e.hp<-10000)return;e.hp=-10001;this.kills++;const mult=Math.max(1,Math.floor(this.combo));const gain=e.score*mult;this.score+=gain;for(const p of this.players)if(p.alive)p.special=clamp(p.special+(e.kind==='boss'?100:e.kind==='miniboss'?40:5),0,100);
    this.floaters.push({x:e.x,y:e.y-e.h*.6,text:`+${gain.toLocaleString()}`,color:mult>=4?'#fff16a':'#fff',life:1});
    this.blast(e.x,e.y,e.kind==='boss'?145:e.kind==='miniboss'?90:e.kind==='tank'?44:25,e.kind==='boss'?'#c74cff':'#ff6338',e.kind==='boss'?80:e.kind==='miniboss'?45:undefined);
    emitAudio(e.kind==='boss'?'boss_explode':'explode',e.kind==='boss'?1:.55,rnd(.85,1.12));
    if(e.kind==='boss'){this.bossDefeated=true;this.shots=this.shots.filter(s=>s.friendly);emitMusic('victory');}
    else if(e.kind==='miniboss'){this.pickups.push({x:e.x,y:e.y-45,kind:'weapon',t:0},{x:e.x+42,y:e.y,kind:'health',t:0});emitMusic('stage',.95);}
    else if(Math.random()<(e.kind==='tank'?.52:.13))this.dropPickup(e.x,e.y);
  }

  private dropPickup(x:number,y:number){const kinds:PickupKind[]=['health','armor','weapon','rapid','score'];const r=Math.random();const kind=r<.18?'health':r<.36?'armor':r<.62?'weapon':r<.81?'rapid':'score';this.pickups.push({x,y:y-18,kind,t:0});}
  private collect(q:Pickup,p=this.player){const hero=HEROES[p.heroIndex];let label='';
    if(q.kind==='health'){p.hp=Math.min(hero.maxHp,p.hp+35);label='ENERGY +35';}
    else if(q.kind==='armor'){p.armor=Math.min(hero.maxArmor,p.armor+32);label='ARMOR UP';}
    else if(q.kind==='rapid'){p.rapid=12;label='RAPID FIRE';}
    else if(q.kind==='score'){this.score+=2500*Math.floor(this.combo);label='VENUS JACKPOT';}
    else {const order:Weapon[]=['blaster','spread','laser','rockets'];const next=order[(order.indexOf(p.weapon)+1)%order.length];if(Math.random()<.56&&p.weaponRank<4){p.weaponRank++;label=`${p.weapon.toUpperCase()} LV.${p.weaponRank}`;}else{p.weapon=next;p.weaponRank=Math.max(1,p.weaponRank-1);label=next.toUpperCase();}}
    this.floaters.push({x:q.x,y:q.y-18,text:label,color:'#72ffdb',life:1.5});this.ring(q.x,q.y,'#72ffdb',5);emitAudio('pickup',.8);
  }

  private finishRun(win:boolean){
    if(this.mode!=='playing'&&this.mode!=='brawler')return;
    if(this.mode==='brawler'&&this.brawler&&!this.brawlerScoreCommitted){this.score+=this.brawler.getScore();this.kills+=this.brawler.getDefeatedCount();this.combo=Math.max(this.combo,this.brawler.getMaxCombo());this.brawlerScoreCommitted=true;}
    this.mode=win?'win':'lose';this.saveScore();emitMusic(win?'victory':'defeat');emitAudio(win?'stage_clear':'game_over');
  }

  private saveScore(){
    const name=this.coopEnabled?`${HEROES[this.selectedHeroes[0]].name}+${HEROES[this.selectedHeroes[1]].name}`:HEROES[this.selected].name;
    this.highScores=this.highScoreStore.add(this.highScores,{name,score:Math.floor(this.score)});
  }

  debugStart(hero:HeroId='cassia'){this.selected=this.selectedHeroes[0]=Math.max(0,HEROES.findIndex(h=>h.id===hero));this.beginRun();}
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
    this.debugStageOneOnly=true;
    this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.debugSustainedFire=false;this.debugFireHeld=false;
    this.elapsed=LEVEL_BOSS_TIME;this.enemies=[];this.minibossSpawned=true;this.bossSpawned=true;this.bossDefeated=false;
    for(const p of this.players){p.weapon='rockets';p.weaponRank=4;p.special=100;p.hp=HEROES[p.heroIndex].maxHp;p.armor=HEROES[p.heroIndex].maxArmor;p.alive=true;p.downed=false;}
    this.spawnEnemy('boss',930,295);emitMusic('boss');emitAudio('warning');
  }

  setCoop(enabled:boolean){this.coopEnabled=enabled;this.selectReady=[false,false];if(this.mode==='playing')this.beginRun();return this.snapshot();}
  setDebugPlayerInput(id:1|2,state:Player['debugInput']){const p=this.players.find(p=>p.id===id);if(p)p.debugInput={...(p.debugInput??{}),...state};return this.snapshot();}
  debugFriendlyFireProbe(){
    if(!this.coopEnabled||this.players.length<2){this.coopEnabled=true;this.beginRun();}
    const owner=this.players[0],target=this.players[1],before=this.players.map(p=>({id:p.id,hp:p.hp,armor:p.armor}));
    this.enemies=[];this.shots=[];this.shots.push({ownerId:owner.id,x:target.x,y:target.y-target.jump-22,vx:690,vy:0,r:7,life:1,damage:999,friendly:true,color:'#fff',kind:'blaster',pierce:0,age:0,phase:0});
    this.handleCollisions();const after=this.players.map(p=>({id:p.id,hp:p.hp,armor:p.armor}));
    this.lastFriendlyFireProbe={ownerId:owner.id,targetId:target.id,crossedTarget:true,before,after};return this.lastFriendlyFireProbe;
  }
  debugDamagePlayer(id:1|2,amount:number){const p=this.players.find(p=>p.id===id);if(p&&p.alive){p.invuln=0;this.damagePlayer(p,amount,p.x,p.y-p.jump);}return {targetId:id,productionCollision:true,state:this.snapshot()};}
  debugCoopBoss(){this.coopEnabled=true;if(this.players.length<2)this.beginRun();this.debugBoss();const boss=this.enemies.find(e=>e.kind==='boss');if(boss){boss.hp=boss.maxHp=720;boss.x=750;}for(const p of this.players){p.x=140+(p.id-1)*100;p.y=390+(p.id-1)*42;p.debugInput={fire:true};}return this.snapshot();}
  debugStageTransition(){this.beginRun();this.debugBoss();this.debugStageOneOnly=false;const boss=this.enemies.find(e=>e.kind==='boss');if(boss){boss.hp=1;boss.x=610;}this.player.debugInput={fire:true};return this.snapshot();}

  debugCombatBeat(){
    this.debugStart('cassia');this.debugBeat=true;this.elapsed=92;this.spawnClock=999;this.obstacleClock=999;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=168;this.player.y=406;this.player.weapon='blaster';this.player.weaponRank=1;
    this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;this.player.cooldown=0;this.player.recoil=0;
    // The raider occupies the upper road lane so the hero's horizontal blaster
    // crosses its real gameplay hitbox (no capture-only collision shortcut).
    this.spawnEnemy('rider',820,390);const rider=this.enemies[0];rider.hp=160;rider.maxHp=160;rider.fire=999;
  }

  debugImpactFrame(stage:number){
    const frame=clamp(Math.floor(stage),0,IMPACT_LABELS.length-1);
    this.debugStart('cassia');this.debugBeat=false;this.debugImpactStage=frame;
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
    this.debugStart('cassia');this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.elapsed=248;this.spawnClock=999;this.obstacleClock=999;
    this.minibossSpawned=true;this.bossSpawned=false;this.bossDefeated=false;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=168;this.player.y=414;this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.spawnEnemy('drone',760,164);this.spawnEnemy('skimmer',875,252);this.spawnEnemy('drone',990,205);this.spawnEnemy('skimmer',1110,126);
    this.enemies.forEach((enemy,index)=>{enemy.fire=.2+index*.16;enemy.phase=index*.72;});
  }

  debugEnemyRoster(){
    this.debugStart('cassia');this.debugBeat=false;this.debugWobblePose=null;this.debugImpactStage=null;this.elapsed=188;this.spawnClock=999;this.obstacleClock=999;
    this.minibossSpawned=true;this.bossSpawned=false;this.bossDefeated=false;
    this.enemies=[];this.shots=[];this.pickups=[];this.particles=[];this.riderImpacts=[];this.floaters=[];
    this.player.x=142;this.player.y=414;this.player.hp=HEROES[this.selected].maxHp;this.player.armor=HEROES[this.selected].maxArmor;
    this.spawnEnemy('tank',650,398);this.spawnEnemy('mine',790,418);this.spawnEnemy('pod',850,226);
    this.enemies.forEach((enemy,index)=>{enemy.fire=.12+index*.08;enemy.phase=index*.9;});
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

  private playerFireState(p=this.player){
    const h=HEROES[p.heroIndex],grounded=p.jump<=1;
    const loopFrame=((Math.floor(p.fireLoop*9)%4)+4)%4;
    const releaseActive=p.fireReleaseElapsed>=0&&p.fireReleaseElapsed<FIRE_RELEASE_DURATION;
    const releaseFrame=grounded&&releaseActive?Math.min(2,Math.floor(p.fireReleaseElapsed/(FIRE_RELEASE_DURATION/3))):-1;
    const bodyMode: 'ride'|'sustained'|'recover'|'airborne' = !grounded?'airborne':p.fireHeld?'sustained':releaseActive?'recover':'ride';
    // The authored cells already contain their own recoil acting.  Holding the
    // world-space pivot fixed prevents the wheels from skating across the road.
    const recoilOffset=0;
    const size=HERO_AUTHORED_SIZE[h.id],anchorX=p.x-recoilOffset,anchorY=p.y-p.jump+38;
    const muzzle=this.riderPose.muzzle(p,this.debugImpactStage);
    const exhaust=this.riderPose.exhaust(p,this.debugImpactStage);
    const exhaustOriginDeltaPx=p.lastExhaust?Math.hypot(p.lastExhaust.x-exhaust.x,p.lastExhaust.y-exhaust.y):null;
    const projectileOrigin=p.id===1?this.lastProjectileOrigin:p.lastMuzzle?{...p.lastMuzzle,barrelX:p.lastMuzzle.x,barrelY:p.lastMuzzle.y,hero:h.id}:null;
    const projectileOriginDeltaPx=projectileOrigin?Math.hypot(projectileOrigin.x-projectileOrigin.barrelX,projectileOrigin.y-projectileOrigin.barrelY):null;
    return {
      held:p.fireHeld,grounded,loopFrame,bodyMode,loopKind:bodyMode,shotsFired:p.shotsFired,recoilOffset,releaseFrame,
      anchorX:Number(anchorX.toFixed(2)),anchorY:Number(anchorY.toFixed(2)),anchorBaseX:Number(p.x.toFixed(2)),anchorBaseY:Number((p.y-p.jump+38).toFixed(2)),
      rapid:p.rapid>0,releaseBlend:Number(p.fireReleaseBlend.toFixed(3)),releaseElapsedMs:releaseActive?Number((p.fireReleaseElapsed*1000).toFixed(2)):-1,releaseDurationMs:FIRE_RELEASE_DURATION*1000,jumpPose:!grounded,roadBaseline:Number((p.y+38).toFixed(2)),
      bodyBBox:{x:Number((anchorX-size.width*size.anchorX).toFixed(2)),y:Number((anchorY-size.height*size.anchorY).toFixed(2)),w:size.width,h:size.height},
      muzzleX:Number(muzzle.x.toFixed(2)),muzzleY:Number(muzzle.y.toFixed(2)),
      visibleBarrelHardpoint:{x:Number(muzzle.x.toFixed(2)),y:Number(muzzle.y.toFixed(2)),sourceX:muzzle.sourceX,sourceY:muzzle.sourceY,sheet:muzzle.sheet,frame:muzzle.frame},
      exhaustX:Number(exhaust.x.toFixed(2)),exhaustY:Number(exhaust.y.toFixed(2)),
      visibleExhaustHardpoint:{x:Number(exhaust.x.toFixed(2)),y:Number(exhaust.y.toFixed(2)),sourceX:exhaust.sourceX,sourceY:exhaust.sourceY,sheet:exhaust.sheet,frame:exhaust.frame},
      exhaustOrigin:p.lastExhaust?{x:Number(p.lastExhaust.x.toFixed(2)),y:Number(p.lastExhaust.y.toFixed(2)),sheet:p.lastExhaust.sheet,frame:p.lastExhaust.frame}:null,
      exhaustOriginDeltaPx:exhaustOriginDeltaPx===null?null:Number(exhaustOriginDeltaPx.toFixed(3)),
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
    const fireState=this.player?this.playerFireState(this.player):null;
    return {
      state: this.mode, stage: this.mode==='brawler'||this.completedStage===2?2:1, hero: HEROES[this.selected].id, score: Math.floor(this.score),
      intro:this.mode==='intro'?{panel:this.introPanel,total:INTRO_PANELS.length,time:Number(this.introClock.toFixed(2)),skippable:true,assetReady:Boolean(this.introArt[this.introPanel]?.complete&&this.introArt[this.introPanel].naturalWidth)}:null,
      coop:this.coopEnabled,coopEnabled:this.coopEnabled,selectedHeroes:this.selectedHeroes.map(index=>HEROES[index].id),selectReady:[...this.selectReady],
      coopControls:{players:this.coopEnabled?2:1,keyboard:{p1:'WASD / Z X C',p2:'ARROWS / NUM1 NUM2 NUM3'},gamepadSlots:this.coopEnabled?2:1},
      players:this.players.map(p=>({id:p.id,hero:HEROES[p.heroIndex].id,x:Number(p.x.toFixed(2)),y:Number((p.y-p.jump).toFixed(2)),groundY:Number(p.y.toFixed(2)),hp:Number(p.hp.toFixed(2)),armor:Number(p.armor.toFixed(2)),alive:p.alive,downed:p.downed,fireHeld:p.fireHeld,shotsFired:p.shotsFired,weapon:p.weapon,weaponRank:p.weaponRank,lastMuzzle:p.lastMuzzle?{x:Number(p.lastMuzzle.x.toFixed(2)),y:Number(p.lastMuzzle.y.toFixed(2)),sheet:p.lastMuzzle.sheet,frame:p.lastMuzzle.frame}:null})),
      rideBounds:{minY:PLAYER_Y_MIN,maxY:PLAYER_Y_MAX,roadTop:292,roadBottom:506},
      friendlyProjectiles:this.shots.filter(s=>s.friendly).map(s=>({ownerId:s.ownerId??1,x:Number(s.x.toFixed(2)),y:Number(s.y.toFixed(2)),kind:s.kind})),
      enemyProjectiles:this.shots.filter(s=>!s.friendly).map(s=>({x:Number(s.x.toFixed(2)),y:Number(s.y.toFixed(2)),kind:s.kind})),
      noFriendlyFire:{playerVsPlayerDisabled:true,lastProbe:this.lastFriendlyFireProbe},
      health: this.player?.hp ?? null, armor: this.player?.armor ?? null,
      enemies: this.enemies.length, boss: boss ? { kind: boss.kind, health: boss.hp, maxHealth: boss.maxHp } : null,
      enemyKinds: this.enemies.map(enemy=>enemy.kind),
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
      brawler:this.brawler?.snapshot()??null,
      atlas: getSpriteSheetStatus()
    };
  }

  gotoScene(scene: string, time = 0) {
    if (scene === 'title') { this.mode = 'title'; emitMusic('title'); }
    else if (scene === 'select') { this.mode = 'select'; emitMusic('select'); }
    else if (scene === 'intro') { this.beginIntro(); this.introPanel=clamp(Math.floor(time),0,INTRO_PANELS.length-1); }
    else if (scene === 'brawler') this.beginBrawler(false);
    else if (scene === 'brawler-boss') this.beginBrawler(true);
    else if (scene === 'brawler-coop') { this.coopEnabled=true; this.beginBrawler(false); }
    else if (scene === 'brawler-coop-boss') { this.coopEnabled=true; this.beginBrawler(true); }
    else if (scene === 'boss') this.debugBoss();
    else if (scene === 'miniboss') this.debugMiniboss();
    else if (scene === 'beat') this.debugCombatBeat();
    else if (/^impact-(?:[0-9]|1[01])$/.test(scene)) this.debugImpactFrame(Number(scene.slice(7)));
    else if (scene === 'wobble-a'||scene === 'wobble-b'||scene === 'wobble-c') this.debugWobble(scene.at(-1) as 'a'|'b'|'c');
    else if (scene === 'aerial') this.debugAerialWave();
    else if (scene === 'enemy-roster') this.debugEnemyRoster();
    else if(scene==='coop-select'){this.coopEnabled=true;this.selectReady=[false,false];this.mode='select';emitMusic('select');}
    else if(scene==='coop'||scene==='coop-ride'){this.coopEnabled=true;this.beginRun();}
    else if(scene==='coop-boss')this.debugCoopBoss();
    else if(scene==='stage-transition')this.debugStageTransition();
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
    const c=this.ctx;
    const brawlerScene=Boolean(this.brawler)&&(this.mode==='brawler'||(this.mode==='paused'&&this.pausedFrom==='brawler')||((this.mode==='win'||this.mode==='lose')&&this.completedStage===2));
    c.save();
    const sx=this.shake>0?rnd(-this.shake,this.shake):0,sy=this.shake>0?rnd(-this.shake*.55,this.shake*.55):0;c.translate(Math.round(sx),Math.round(sy));
    if(this.mode==='title')this.drawTitle();
    else if(this.mode==='select')this.drawSelect();
    else if(this.mode==='intro')this.drawIntro();
    else if(brawlerScene)this.brawler?.draw(!(this.mode==='win'||this.mode==='lose'));
    else this.drawWorld();
    c.restore();
    if(this.mode!=='title'&&this.mode!=='select'&&this.mode!=='intro'){
      if(!brawlerScene){this.drawHud();if(this.bossSpawned&&!this.bossDefeated&&this.enemies.some(e=>e.kind==='boss'))this.drawWarningEdges();}
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
    for(const p of [...this.players].filter(p=>p.alive).sort((a,b)=>a.y-b.y))this.drawPlayer(p);
    // Keep a fallen co-op rider present in the shared playfield. The old
    // explosion-only state read like a pickup and obscured why P2 vanished.
    for(const p of this.players.filter(p=>p.downed).sort((a,b)=>a.y-b.y))this.drawDownedPlayer(p);
    for(const s of this.shots)this.drawShot(s);
    for(const q of this.particles)this.drawParticle(q);
    if(this.debugImpactStage!==null)this.drawImpactChoreography(this.debugImpactStage);
    for(const event of this.riderImpacts){const rider=this.enemies.find(e=>e.id===event.enemyId);if(rider)this.drawImpactForeground(this.impactStageFromAge(event.age),rider,{x:rider.x+event.localX,y:rider.y+event.localY});}
    drawEnvironmentForeground(c,environment);
    for(const f of this.floaters){c.globalAlpha=clamp(f.life*2,0,1);this.text(f.text,f.x,f.y,17,f.color,'center',true);c.globalAlpha=1;}
  }

  private drawPlayer(p=this.player){
    const c=this.ctx,h=HEROES[p.heroIndex],x=p.x,y=p.y-p.jump;
    const rideFrame=((Math.floor(p.wheel)%6)+6)%6;
    const firing=p.cooldown>0&&p.recoil>.034;
    const recoil=clamp(p.recoil/.072,0,1);
    const fireState=this.playerFireState(p);
    // Keep invulnerability readable without bleaching the hero into a featureless white cutout.
    const hitFlash=p.invuln>0&&Math.floor(p.invuln*22)%2===0?.32:0;
    c.save();c.globalAlpha=.27;c.fillStyle='#000';c.beginPath();c.ellipse(x-5,p.y+15,54,11,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    if(p.specialTime>0){c.strokeStyle=h.accent;c.lineWidth=2;c.globalAlpha=.4+.25*Math.sin(this.time*18);for(let i=0;i<3;i++){c.beginPath();c.ellipse(x-10-i*7,y,62+i*7,27+i*3,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;}
    // The regular hero sheets still own ride and airborne acting.  Grounded
    // trigger holds use a dedicated four-frame row per hero, so projectile
    // cadence can never bounce the body back to a ride frame.
    const pose=this.riderPose.bodyPose(p,this.debugImpactStage);
    const authoredFrame=pose.sheet==='authored'?pose.frame:2;
    const size=HERO_AUTHORED_SIZE[h.id];
    const playerKick=this.debugImpactStage===null?0:this.impactShooterPose(this.debugImpactStage).shoulderRecoil;
    const sustained=pose.sheet==='sustained';
    const recovering=pose.sheet==='release';
    const bodyX=x-playerKick-fireState.recoilOffset;
    const bodyY=y+38+(playerKick>0?2:0);
    let usedAtlas=sustained&&drawSpriteFrame(c,'sustainedFire',p.heroIndex*4+pose.frame,bodyX,bodyY,{...size,alpha:hitFlash>0?.62:1});
    if(!usedAtlas&&recovering)usedAtlas=drawSpriteFrame(c,'fireRelease',p.heroIndex*3+pose.frame,bodyX,bodyY,{...size,alpha:hitFlash>0?.62:1});
    if(!usedAtlas)usedAtlas=drawSpriteFrame(c,h.id,authoredFrame,bodyX,bodyY,{
      ...size,alpha:hitFlash>0?.62:1,
    });
    if(!usedAtlas){
      c.scale(2,2);
      drawPixelHero(c,h.id,bodyX/2,y/2,{frame:rideFrame,angle:p.lean*.055-p.jumpV*.00008,power:p.specialTime>0?1:clamp(.76+this.worldSpeed/h.speed*.18,.76,.96),firing:sustained||recovering||firing,airborne:p.jump>1,flash:hitFlash,recoil:sustained?1:recovering?p.fireReleaseBlend:recoil});
    }
    c.restore();
    if(this.debugImpactStage===1&&p.id===1||this.debugImpactStage===null&&firing){const muzzle=this.riderPose.muzzle(p,this.debugImpactStage,bodyX,bodyY,pose);this.drawMuzzle(muzzle.x,muzzle.y,p.weapon,recoil>.72?0:1);}
  }

  private drawDownedPlayer(p:Player){
    const c=this.ctx,h=HEROES[p.heroIndex],size=HERO_AUTHORED_SIZE[h.id],x=px(p.x),y=px(p.y);
    c.save();
    c.globalAlpha=.38;c.fillStyle='#020106';c.beginPath();c.ellipse(x-5,y+16,58,12,0,0,Math.PI*2);c.fill();
    c.translate(x,y+7);c.rotate(p.id===1?.075:-.075);
    const used=drawSpriteFrame(c,h.id,7,0,38,{...size,alpha:.46});
    if(!used){c.scale(2,2);drawPixelHero(c,h.id,0,0,{frame:5,angle:p.id===1?.08:-.08,power:.18,firing:false,airborne:false,flash:0,recoil:0});}
    c.restore();

    // A compact world-space rescue beacon survives foreground clutter and
    // distinguishes the wreck from pickups, mines and impact particles.
    const beaconY=px(y-91),pulse=.62+.24*Math.sin(this.time*8+p.id);
    c.save();c.globalAlpha=.84;c.fillStyle='#090610';c.fillRect(x-48,beaconY-18,96,27);
    c.strokeStyle=p.id===1?'#ffe65c':'#5de4e0';c.lineWidth=2;c.strokeRect(x-48,beaconY-18,96,27);
    c.globalAlpha=pulse;c.fillStyle='#ff4868';c.fillRect(x-43,beaconY-13,7,17);c.fillRect(x+36,beaconY-13,7,17);c.globalAlpha=1;
    this.text(`P${p.id} DOWN`,x,beaconY+1,12,'#ff8095','center',true);
    c.strokeStyle='#ff486899';c.lineWidth=2;c.beginPath();c.moveTo(x,beaconY+10);c.lineTo(x,y-35);c.stroke();
    for(let i=0;i<3;i++){const drift=Math.sin(this.time*2.2+i*1.7)*4,sy=y-31-i*13;c.globalAlpha=.31-i*.06;c.fillStyle=i===0?'#4b3035':'#292834';c.fillRect(px(x-10+drift-i*2),px(sy),18+i*5,8+i*2);}c.restore();
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
    // The small boss pod and road mine share the authored enemy-roster sheet.
    // Keep the legacy Canvas silhouettes as a safe loading/error fallback.
    if(e.kind==='mine'||e.kind==='pod'){
      const rosterFrame=e.kind==='mine'
        ?4+(Math.floor(e.t*10)%4)
        :(e.flash>0?10:e.fire>0&&e.fire<.18?9:1-e.hp/e.maxHp>.55?10:(Math.floor(e.t*5)%2?11:8));
      const usedRoster=drawSpriteFrame(c,'enemyRoster',rosterFrame,e.x,e.y,{
        width:e.kind==='mine'?76:108,
        height:e.kind==='mine'?76:108,
        anchorX:.5,
        anchorY:.5,
      });
      if(usedRoster)return;
    }
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
          drawPixelBoss(c,'sulfurDreadnought',e.x/2,e.y/2,options);
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
        }else if(e.kind==='tank'){
          const power=clamp(1-e.hp/e.maxHp,0,1);
          const firing=e.fire>0&&e.fire<.18;
          const tankFrame=e.flash>0?2:firing?1:power>.55?3:0;
          c.scale(.5,.5);
          usedAtlas=drawSpriteFrame(c,'enemyRoster',tankFrame,e.x,e.y+16,{
            width:166,
            height:116,
            anchorX:.5,
            anchorY:.72,
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
    if(this.coopEnabled){
      const drawRiderHud=(r:Player,x:number)=>{const rh=HEROES[r.heroIndex],w=286;c.fillStyle='#080913e8';c.fillRect(x,9,w,57);c.strokeStyle=r.id===1?'#ffe65c':'#5de4e0';c.lineWidth=2;c.strokeRect(x+1,10,w-2,55);this.text(`P${r.id} ${rh.name}${r.downed?'  DOWN':''}`,x+10,29,13,r.downed?'#777':rh.accent,'left',true);this.text(`${r.weapon.toUpperCase()} ${r.weaponRank}`,x+w-10,29,10,'#ffd55d','right',true);this.text(`HP ${Math.ceil(r.hp)}`,x+10,47,9,'#ffafba','left',true);this.meter(x+58,38,76,9,r.hp/rh.maxHp,'#ef425f','#521b2e');this.text(`AR ${Math.ceil(r.armor)}`,x+143,47,9,'#c1f5ff','left',true);this.meter(x+191,38,48,9,r.armor/rh.maxArmor,'#57d6ff','#15334c');this.text(`SP ${Math.floor(r.special)}`,x+w-10,48,9,rh.accent,'right',true);};
      drawRiderHud(this.players[0],14);if(this.players[1])drawRiderHud(this.players[1],660);
      c.fillStyle='#05050be6';c.fillRect(321,12,318,48);c.strokeStyle='#6e4c88';c.strokeRect(322,13,316,46);this.text(this.score.toString().padStart(8,'0'),480,34,16,'#fff','center',true);this.text(`TEAM x${this.combo.toFixed(1)}  //  ${this.bossSpawned?'FINAL ASSAULT':`${Math.max(0,LEVEL_BOSS_TIME-this.elapsed)|0}s`}`,480,53,10,'#ff7fb1','center',true);
      const boss=this.enemies.find(e=>e.kind==='boss'||e.kind==='miniboss');if(boss){c.fillStyle='#090613e6';c.fillRect(212,486,536,40);this.text(boss.kind==='boss'?'SULFUR DREADNOUGHT':'MAGMA MAULER MK.IV',480,501,14,boss.kind==='boss'?'#df76ff':'#ff7f5c','center',true);this.meter(229,507,502,10,boss.hp/boss.maxHp,boss.kind==='boss'?'#bd45e9':'#ff554b','#30152b');}
      return;
    }
    c.fillStyle='#080913df';c.fillRect(14,9,264,47);c.strokeStyle=h.accent;c.lineWidth=2;c.strokeRect(15,10,262,45);
    this.text(h.name,24,27,13,h.accent,'left',true);this.text(this.score.toString().padStart(8,'0'),268,28,15,'#fff','right',true);
    this.text(`HP ${Math.ceil(p.hp)}/${h.maxHp}`,24,45,9,'#ffafba', 'left', true);this.meter(91,36,78,9,p.hp/h.maxHp,'#ef425f','#521b2e');
    this.text(`AR ${Math.ceil(p.armor)}/${h.maxArmor}`,178,45,9,'#c1f5ff', 'left', true);this.meter(235,36,32,9,p.armor/h.maxArmor,'#57d6ff','#15334c');
    c.fillStyle='#080913df';c.fillRect(708,9,238,47);c.strokeStyle='#6e4c88';c.strokeRect(709,10,236,45);
    this.text(`${p.weapon.toUpperCase()} LV.${p.weaponRank}`,720,28,13,'#ffd55d','left',true);this.text(`x${this.combo.toFixed(1)}`,934,29,18,this.combo>=4?'#fff26c':'#ff6fab','right',true);
    this.text(`SP ${Math.floor(p.special)}%`,720,47,9,h.accent,'left',true);this.meter(770,37,164,9,p.special/100,h.accent,'#30223d');
    const progress=this.bossSpawned?1:this.elapsed/LEVEL_BOSS_TIME;c.fillStyle='#05050bd9';c.fillRect(299,12,388,10);c.fillStyle='#593457';c.fillRect(302,15,382,4);c.fillStyle='#ff784c';c.fillRect(302,15,382*clamp(progress,0,1),4);c.fillStyle='#fff';c.fillRect(302+382*(145/LEVEL_BOSS_TIME),10,2,14);this.text(this.bossSpawned?'FINAL ASSAULT':`${Math.max(0,LEVEL_BOSS_TIME-this.elapsed)|0}s TO TARGET`,493,40,11,'#ead9ee','center',true);
    const boss=this.enemies.find(e=>e.kind==='boss'||e.kind==='miniboss');if(boss){c.fillStyle='#090613e6';c.fillRect(212,486,536,40);this.text(boss.kind==='boss'?'SULFUR DREADNOUGHT':'MAGMA MAULER MK.IV',480,501,14,boss.kind==='boss'?'#df76ff':'#ff7f5c','center',true);this.meter(229,507,502,10,boss.hp/boss.maxHp,boss.kind==='boss'?'#bd45e9':'#ff554b','#30152b');}
  }

  private meter(x:number,y:number,w:number,h:number,value:number,color:string,bg:string){const c=this.ctx;c.fillStyle=bg;c.fillRect(x,y,w,h);c.fillStyle=color;c.fillRect(x+2,y+2,(w-4)*clamp(value,0,1),h-4);c.fillStyle='#ffffff55';c.fillRect(x+2,y+2,(w-4)*clamp(value,0,1),2);}

  private drawWarningEdges(){const c=this.ctx,a=.16+.1*Math.sin(this.time*7);c.fillStyle=`rgba(255,35,88,${a})`;c.fillRect(0,0,8,H);c.fillRect(W-8,0,8,H);}

  private drawIntro(){
    const c=this.ctx,panel=INTRO_PANELS[this.introPanel],image=this.introArt[this.introPanel];
    const phase=clamp(this.introClock/panel.duration,0,1),ease=phase*phase*(3-2*phase);
    const fade=clamp(Math.min(this.introClock/.36,(panel.duration-this.introClock)/.34),0,1);
    c.fillStyle='#03020a';c.fillRect(0,0,W,H);c.save();c.globalAlpha=fade;
    const blastShake=this.introPanel===1&&this.introClock<.55?(1-this.introClock/.55)*7:0;
    if(blastShake)c.translate(Math.sin(this.introClock*91)*blastShake,Math.cos(this.introClock*73)*blastShake*.45);
    if(image?.complete&&image.naturalWidth>0){
      c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      const zoom=1.018+.035*ease,scale=Math.max(W/image.naturalWidth,H/image.naturalHeight)*zoom;
      const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
      c.drawImage(image,(W-dw)/2+(ease-.5)*panel.pan,(H-dh)/2,dw,dh);
    }else{
      const loading=c.createLinearGradient(0,0,W,H);loading.addColorStop(0,'#63283b');loading.addColorStop(.5,'#e18b54');loading.addColorStop(1,'#163b52');c.fillStyle=loading;c.fillRect(0,0,W,H);
      this.text('LOADING COMIC PANEL...',480,266,21,'#fff4c2','center',true);
    }
    const topShade=c.createLinearGradient(0,0,0,118);topShade.addColorStop(0,'rgba(3,2,10,.84)');topShade.addColorStop(1,'rgba(3,2,10,0)');c.fillStyle=topShade;c.fillRect(0,0,W,118);
    const bottomShade=c.createLinearGradient(0,292,0,H);bottomShade.addColorStop(0,'rgba(3,2,10,0)');bottomShade.addColorStop(.43,'rgba(3,2,10,.68)');bottomShade.addColorStop(1,'rgba(3,2,10,.98)');c.fillStyle=bottomShade;c.fillRect(0,292,W,H-292);
    c.fillStyle='#0b0715e8';c.beginPath();c.moveTo(0,389);c.lineTo(585,373);c.lineTo(625,540);c.lineTo(0,540);c.closePath();c.fill();
    c.fillStyle='#ffcf47';c.fillRect(0,389,255,4);c.fillStyle='#ef4268';c.fillRect(255,389,172,4);c.fillStyle='#5de4e0';c.fillRect(427,389,118,4);
    c.fillStyle='#120a1ee8';c.fillRect(24,18,366,29);c.fillStyle='#ffcf47';c.fillRect(24,18,5,29);this.text(panel.kicker,42,39,12,'#fff3c2','left',true);
    this.text(`0${this.introPanel+1} / 04`,930,39,13,'#fff','right',true);
    this.text(panel.title,35,438,33,this.introPanel===1?'#ffcf47':'#fff2b4','left',true);
    this.text(panel.caption,36,466,14,'#f0dfe9','left');
    for(let i=0;i<INTRO_PANELS.length;i++){c.fillStyle=i<=this.introPanel?(i===this.introPanel?'#ffcf47':'#ef4268'):'#4b3858';c.fillRect(36+i*62,491,51,4);}
    const pulse=.62+.38*Math.sin(this.time*5);c.globalAlpha*=pulse;this.text('ENTER / Z  NEXT     ESC / START  SKIP',928,517,11,'#bffcf2','right',true);c.globalAlpha=fade;
    c.strokeStyle='#fff4cf';c.lineWidth=5;c.strokeRect(6,6,W-12,H-12);c.strokeStyle='#160b22';c.lineWidth=4;c.strokeRect(11,11,W-22,H-22);
    if(this.introPanel===1&&this.introClock<.18){c.globalAlpha=(.18-this.introClock)/.18*.48;c.fillStyle='#fff5c4';c.fillRect(0,0,W,H);}
    c.restore();
  }

  private drawTitle(){
    const c=this.ctx;drawEnvironment(c,{scroll:this.time*115,elapsed:24,speed:345,time:this.time,shake:0,intensity:.9});
    if(this.titleArt.complete&&this.titleArt.naturalWidth>0){
      const scale=Math.max(W/this.titleArt.naturalWidth,H/this.titleArt.naturalHeight),dw=this.titleArt.naturalWidth*scale,dh=this.titleArt.naturalHeight*scale;
      c.globalAlpha=.78;c.drawImage(this.titleArt,(W-dw)/2,(H-dh)/2,dw,dh);c.globalAlpha=1;
    }
    const shade=c.createLinearGradient(0,0,W,0);shade.addColorStop(0,'rgba(3,2,10,.92)');shade.addColorStop(.55,'rgba(5,2,12,.32)');shade.addColorStop(1,'rgba(3,2,10,.83)');c.fillStyle=shade;c.fillRect(0,0,W,H);
    c.save();c.translate(57,64);c.transform(1,0,-.12,1,0,0);c.fillStyle='#14091f';c.strokeStyle='#ef3f69';c.lineWidth=4;c.fillRect(0,0,520,151);c.strokeRect(0,0,520,151);c.fillStyle='#ffcf47';c.fillRect(20,17,480,4);this.text('BIKER COWS',260,67,48,'#f4e4d2','center',true);this.text('FROM VENUS',260,105,25,'#ff5b73','center',true);c.fillStyle='#5de4e0';c.beginPath();c.moveTo(34,121);c.lineTo(203,121);c.lineTo(220,112);c.lineTo(482,112);c.lineTo(455,128);c.lineTo(45,128);c.fill();c.restore();
    c.save();c.translate(92,231);c.rotate(-.025);c.shadowColor='#b922ff';c.shadowBlur=28;this.text('NEON',0,61,64,'#fff36b','left',true);this.text('STAMPEDE',3,120,58,'#ff496e','left',true);c.shadowBlur=0;c.restore();
    const pulse=.75+.25*Math.sin(this.time*5);for(let i=0;i<2;i++){const active=this.titleChoice===i;c.fillStyle=active?'#ff456b':'#151022dd';c.fillRect(104,387+i*45,274,34);c.strokeStyle=active?'#ffe360':'#4d365d';c.lineWidth=2;c.strokeRect(104,387+i*45,274,34);if(active){c.globalAlpha=pulse;c.fillStyle='#fff26c';c.beginPath();c.moveTo(87,404+i*45);c.lineTo(99,396+i*45);c.lineTo(99,412+i*45);c.fill();c.globalAlpha=1;}this.text(i===0?'RIDE INTO BATTLE':'CLEAR RECORDS',241,410+i*45,19,active?'#fff':'#9e90ac','center',true);}
    c.fillStyle='#090713dd';c.fillRect(646,326,264,152);c.strokeStyle='#74455f';c.strokeRect(646,326,264,152);this.text('HALL OF FIRE',778,351,18,'#ffcd4c','center',true);
    if(this.highScores.length){this.highScores.slice(0,4).forEach((s,i)=>{this.text(`${i+1}. ${s.name}`,664,380+i*24,13,'#d9cadf');this.text(s.score.toLocaleString(),892,380+i*24,13,'#fff','right');});}else this.text('THE SKYWAY AWAITS…',778,410,14,'#776c82','center');
    this.text('ENTER / Z  SELECT     ↑↓  MOVE',480,517,14,'#e3d9e8','center',true);this.text('ORIGINAL ARCADE PROTOTYPE',899,22,10,'#887995','right');
  }

  private drawSelect(){
    const c=this.ctx,pulse=.5+.5*Math.sin(this.time*5.5);
    drawEnvironment(c,{scroll:this.time*58,elapsed:82,speed:185,time:this.time,shake:0,intensity:.55});
    const veil=c.createLinearGradient(0,0,0,H);veil.addColorStop(0,'rgba(6,3,15,.82)');veil.addColorStop(.52,'rgba(8,4,18,.67)');veil.addColorStop(1,'rgba(4,2,11,.94)');c.fillStyle=veil;c.fillRect(0,0,W,H);
    c.fillStyle='#090612e8';c.fillRect(0,0,W,91);c.fillStyle='#ef3e67';c.fillRect(0,88,W,3);c.fillStyle='#fff16d';c.fillRect(312,88,336,3);
    c.save();c.translate(480,0);c.transform(1,0,-.08,1,0,0);c.fillStyle='#160b22';c.fillRect(-292,13,584,58);c.strokeStyle='#70405c';c.lineWidth=2;c.strokeRect(-292,13,584,58);c.restore();
    this.text('CHOOSE YOUR RIDER',480,48,31,'#fff16d','center',true);this.text('THREE RIDERS // ONE ORBIT',480,70,12,'#d7b8df','center',true);
    for(let i=0;i<HEROES.length;i++){
      const h=HEROES[i],p1=i===this.selectedHeroes[0],p2=this.coopEnabled&&i===this.selectedHeroes[1],active=p1||p2,cx=180+i*300,w=active?280:248,hh=active?354:330,x=cx-w/2,y=active?99:112;
      // Reserve a compact status rail above the active portrait so SELECTED
      // can never overlap a face, even with Nova's high horns and swept hair.
      const portraitTop=y+(active?26:7),portraitH=active?176:171;c.save();
      c.shadowColor=active?h.accent:'#030109';c.shadowBlur=active?22:10;c.fillStyle=active?'#21152ff5':'#0a0814e8';c.fillRect(x,y,w,hh);c.shadowBlur=0;
      c.strokeStyle=active?h.accent:'#3b3048';c.lineWidth=active?4:2;c.strokeRect(x,y,w,hh);c.fillStyle=active?h.accent:'#46364f';c.fillRect(x+4,y+4,w-8,active?4:2);
      const portraitBottom=portraitTop+portraitH;
      const portraitGradient=c.createLinearGradient(0,portraitTop,0,portraitBottom);portraitGradient.addColorStop(0,active?'#352048':'#1a1325');portraitGradient.addColorStop(1,'#090712');c.fillStyle=portraitGradient;c.fillRect(x+6,portraitTop,w-12,portraitH);
      if(active){c.globalAlpha=.11+.05*pulse;c.fillStyle=h.accent;for(let xx=x-80;xx<x+w;xx+=28){c.beginPath();c.moveTo(xx,portraitBottom);c.lineTo(xx+92,portraitTop);c.lineTo(xx+103,portraitTop);c.lineTo(xx+11,portraitBottom);c.fill();}c.globalAlpha=1;}
      c.save();c.beginPath();c.rect(x+6,portraitTop,w-12,portraitH);c.clip();
      const inactivePortraitAlpha=h.id==='nova'?.66:.82;
      const portraitDrawn=drawHeroPortrait(c,h.id,cx,portraitBottom+10,active?258:252,active?190:189,{alpha:active?1:inactivePortraitAlpha,selected:active,pulse,edgeColor:h.accent});
      if(!portraitDrawn)this.drawPortrait(h,cx,portraitTop+(active?139:127),active?1.2:.98);
      if(!active){c.fillStyle='rgba(7,5,13,.08)';c.fillRect(x+6,portraitTop,w-12,portraitH);}c.restore();
      c.fillStyle=active?'#0b0715f2':'#08060fdc';c.fillRect(x+7,portraitBottom,w-14,hh-portraitH-8);c.fillStyle=active?h.accent:'#3a2e44';c.fillRect(x+7,portraitBottom,w-14,3);
      if(active){c.fillStyle='#0b0715';c.fillRect(x+8,y+8,w-16,17);if(p1){c.fillStyle='#ffe65c';c.fillRect(x+8,y+8,5,17);this.text(this.coopEnabled?(this.selectReady[0]?'P1 READY':'P1'):'SELECTED',cx-(p2?34:0),y+21,9,'#ffe65c','center',true);}if(p2){c.fillStyle='#5de4e0';c.fillRect(x+w-13,y+8,5,17);this.text(this.selectReady[1]?'P2 READY':'P2',cx+(p1?35:0),y+21,9,'#5de4e0','center',true);}}
      const nameY=portraitBottom+30;this.text(h.name,cx,nameY,active?27:23,active?h.accent:'#b0a6b7','center',true);this.text(h.epithet,cx,nameY+17,10,active?'#f1e3f3':'#9f94a6','center');
      const names=['POWER','SPEED','ARMOR'],statsY=nameY+31;names.forEach((name,n)=>{const yy=statsY+n*14;this.text(name,x+18,yy+8,9,active?'#baadbf':'#817686');for(let s=0;s<5;s++){c.fillStyle=s<h.stats[n]?(active?h.accent:'#665b70'):'#27212f';c.fillRect(x+w-126+s*20,yy,14,8);if(active&&s<h.stats[n]){c.fillStyle='#ffffff66';c.fillRect(x+w-124+s*20,yy+1,10,2);}}});
      const arsenalY=y+hh-31;c.fillStyle=active?'#160d22':'#0d0914';c.fillRect(x+8,arsenalY-14,w-16,38);c.fillStyle=active?h.accent:'#3c3047';c.fillRect(x+8,arsenalY-14,3,38);this.text(h.weapon.toUpperCase(),x+18,arsenalY,11,'#ffd861','left',true);this.text(h.special,x+w-17,arsenalY+18,10,active?'#92f4e5':'#766f7c','right',true);
      c.fillStyle=active?h.accent:'#4a3a53';c.fillRect(x,portraitBottom-1,16,3);c.fillRect(x+w-16,portraitBottom-1,16,3);
      c.restore();
    }
    c.globalAlpha=.58+.42*pulse;this.text('<',24,286,30,'#fff16b','center',true);this.text('>',936,286,30,'#fff16b','center',true);c.globalAlpha=1;
    c.fillStyle='#080510ed';c.fillRect(68,465,824,59);c.strokeStyle='#5e426e';c.lineWidth=2;c.strokeRect(68,465,824,59);c.fillStyle='#ef3e67';c.fillRect(70,467,4,55);c.fillStyle='#5de4e0';c.fillRect(886,467,4,55);
    if(this.coopEnabled){this.text('P1  A/D + Z READY       P2  LEFT/RIGHT + NUM1 READY       TAB  1 PLAYER',480,488,12,'#fff','center',true);this.text('RIDE: P1 WASD / Z X C     P2 ARROWS / NUM1 NUM2 NUM3     GAMEPADS 1 + 2',480,511,10,'#bfb1c8','center');}
    else{this.text('A / D  OR  LEFT / RIGHT   CHOOSE     ENTER / Z   CONFIRM     TAB  2 PLAYERS',480,488,13,'#fff','center',true);this.text('IN RIDE:  MOVE WASD / ARROWS   |   Z FIRE   |   X JUMP   |   C SPECIAL   |   P PAUSE',480,511,10,'#bfb1c8','center');}
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
    if(h.id==='bruna'){c.fillStyle='#96d9ef';c.fillRect(23,-52,20,19);c.fillStyle='#1b3348';c.fillRect(28,-47,10,9);}if(h.id==='nova'){c.strokeStyle='#ff5578';c.lineWidth=5;c.beginPath();c.arc(0,-46,47,Math.PI*1.12,Math.PI*1.88);c.stroke();}
    c.restore();
  }

  private drawPause(){const c=this.ctx;c.fillStyle='#07040cbb';c.fillRect(0,0,W,H);c.fillStyle='#160d25ee';c.fillRect(278,166,404,205);c.strokeStyle='#f7cf4e';c.lineWidth=3;c.strokeRect(278,166,404,205);this.text('PAUSED',480,218,41,'#fff071','center',true);this.text('VENUS CAN WAIT',480,248,13,'#bfacc8','center');this.text('ENTER / P',390,294,15,'#64eadb','right',true);this.text('RESUME',410,294,15,'#fff');this.text('R',390,324,15,'#ff667f','right',true);this.text(this.pausedFrom==='brawler'?'RESTART STAGE':'RESTART RUN',410,324,15,'#fff');this.text('GAMEPAD: START TO RESUME',480,354,11,'#877b91','center');}

  private drawEnding(){
    const c=this.ctx,win=this.mode==='win',stageTwo=this.completedStage===2;c.fillStyle=win?'#09031cbb':'#100309c7';c.fillRect(0,0,W,H);
    if(win){for(let i=0;i<9;i++){const x=100+i*95,y=115+Math.sin(this.time*2+i)*25;c.fillStyle=i%2?'#ff4b86':'#65f1df';c.fillRect(x,y,5,18);}}
    c.fillStyle='#100a1eea';c.fillRect(236,109,488,323);c.strokeStyle=win?'#ffe15a':'#ff3f64';c.lineWidth=4;c.strokeRect(236,109,488,323);
    this.text(win?(stageTwo?'DISTRICT LIBERATED!':'VENUS RIDES FREE!'):(stageTwo?'CREW DOWN':'BIKE WRECKED'),480,173,43,win?'#fff16b':'#ff5270','center',true);this.text(win?(stageTwo?'THE FORGE OVERSEER IS FINISHED.':'THE SULFUR TYRANT’S WAR MACHINE IS SCRAP.'):(stageTwo?'THE FURNACE DISTRICT STILL NEEDS YOU.':'THE SKYWAY ISN’T DONE WITH YOU.'),480,208,14,'#e2d2e7','center');
    if(this.coopEnabled){
      const p1=HEROES[this.selectedHeroes[0]],p2=HEROES[this.selectedHeroes[1]];
      this.text(p1.name,462,263,16,p1.accent,'right',true);this.text('+',480,263,15,'#fff','center',true);this.text(p2.name,498,263,16,p2.accent,'left',true);
    }else this.text(HEROES[this.selected].name,344,263,16,HEROES[this.selected].accent);
    this.text('FINAL SCORE',344,296,12,'#a795ad');this.text(Math.floor(this.score).toLocaleString(),616,300,28,'#fff','right',true);this.text('ENEMIES TRASHED',344,330,12,'#a795ad');this.text(this.kills.toString(),616,330,18,'#ffbd52','right',true);this.text('MAX COMBO',344,358,12,'#a795ad');this.text(`x${this.combo.toFixed(1)}`,616,358,18,'#ff66a0','right',true);
    this.text('ENTER / Z  RIDE AGAIN',480,399,15,'#75f1dd','center',true);this.text('ESC  TITLE SCREEN',480,419,11,'#9b8ca5','center');
  }

  private text(value:string,x:number,y:number,size:number,color='#fff',align:CanvasTextAlign='left',bold=false){const c=this.ctx;c.save();c.font=`${bold?'900':'700'} ${size}px "Arial Narrow", Impact, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle='#06030c';c.globalAlpha=.75;c.fillText(value,x+2,y+2);c.globalAlpha=1;c.fillStyle=color;c.fillText(value,x,y);c.restore();}
}
