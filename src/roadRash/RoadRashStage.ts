import type {
  RoadRashControls,
  RoadRashEntitySnapshot,
  RoadRashHeroId,
  RoadRashSnapshot,
  RoadRashStageOptions,
  RoadRashStatus,
} from './types';
import { assetUrl } from '../assetUrl';
import { isArtEnabled } from '../debug/runtime';

const W = 960;
const H = 540;
// The open-road panorama's asphalt converges at source pixel ~811,582.
// At the 960x540 game resolution that is (466,323). Keep both render modes and
// every projected object registered to that point; near the camera the road
// centre eases back to the canvas centre so player/collision anchors stay put.
const HORIZON = 323;
const VANISH_X = 466;
const ROAD_BOTTOM = 524;
const MAX_SPEED = 224;
const BOSS_DEFEAT_DURATION = 1.05;

// Atlas display sizes are expressed in projection-space pixels. A near car is
// 104px wide and a tanker 132px wide before perspective, so riders should sit
// between those silhouettes instead of dwarfing both vehicles.
const RIVAL_ATLAS_WIDTH = 88;
const RIVAL_ATLAS_HEIGHT = 114;
const BOSS_ATLAS_WIDTH = 108;
const BOSS_ATLAS_HEIGHT = 134;
const PLAYER_ATLAS_WIDTH = 112;
const PLAYER_ATLAS_HEIGHT = 140;

type EntityKind = RoadRashEntitySnapshot['kind'];

interface RoadEntity {
  id: number;
  kind: EntityKind;
  lane: number;
  distance: number;
  speed: number;
  hp: number;
  maxHp: number;
  active: boolean;
  attackCooldown: number;
  attackTimer: number;
  hitFlash: number;
  reactionTimer: number;
  recoilSide: number;
  wobble: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'smoke' | 'glass' | 'star';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (value: number) => value * value * (3 - 2 * value);
const px = (value: number) => Math.round(value);

/**
 * Self-contained pseudo-3D highway combat stage inspired by the best 16-bit road games.
 * It owns no DOM state and can be constructed before a canvas exists.
 */
export class RoadRashStage {
  readonly width = W;
  readonly height = H;

  private readonly courseLength: number;
  private readonly playerName: string;
  private readonly playerHero: RoadRashHeroId;
  private statusValue: RoadRashStatus = 'intro';
  private elapsed = 0;
  private stateTimer = 0;
  private introTimer: number;
  private distance = 0;
  private visualDistance = 0;
  private speed = 72;
  private lane = 0;
  private lean = 0;
  private playerHp = 100;
  private attackTimer = 0;
  private attackSide: -1 | 1 = 1;
  private attackConnected = false;
  private impactFreeze = 0;
  private impactFlash = 0;
  private playerRecoil = 0;
  private invulnerability = 0;
  private hitFlash = 0;
  private shake = 0;
  private score = 0;
  private confirmedHits = 0;
  private rivalsDefeated = 0;
  private collisions = 0;
  private nextSpawnAt = 300;
  private bossSpawned = false;
  private bossDefeated = false;
  private bossDefeatTimer = 0;
  private finishCrossed = false;
  private entitySerial = 0;
  private rngState: number;
  private entities: RoadEntity[] = [];
  private particles: Particle[] = [];
  private readonly panorama: HTMLImageElement | null;
  private readonly roadObjectsAtlas: HTMLImageElement | null;
  private readonly ridersAtlas: HTMLImageElement | null;
  private ridersAtlasCanvas: HTMLCanvasElement | null = null;
  private readonly heroinesAtlas: HTMLImageElement | null;
  private heroinesAtlasCanvas: HTMLCanvasElement | null = null;

  constructor(options: RoadRashStageOptions = {}) {
    this.rngState = (options.seed ?? 0x9e3779b9) >>> 0;
    this.courseLength = Math.max(2400, options.courseLength ?? 6200);
    this.playerName = (options.playerName ?? 'MOO RIDER').slice(0, 14).toUpperCase();
    this.playerHero = options.playerHero ?? 'cassia';
    this.introTimer = options.debugSkipIntro || options.debugBoss ? 0 : (options.introDuration ?? 2.3);
    this.panorama = typeof Image === 'undefined' ? null : new Image();
    if (this.panorama) this.panorama.src = assetUrl('assets/road-rash/venus-badlands-panorama-v2-open-road.png');
    this.roadObjectsAtlas = typeof Image === 'undefined' ? null : new Image();
    if (this.roadObjectsAtlas) this.roadObjectsAtlas.src = assetUrl('assets/road-rash/road-objects-atlas-v1.png');
    this.ridersAtlas = typeof Image === 'undefined' ? null : new Image();
    if(this.ridersAtlas){
      this.ridersAtlas.addEventListener('load',()=>this.prepareAtlas(this.ridersAtlas, canvas => { this.ridersAtlasCanvas = canvas; }),{once:true});
      this.ridersAtlas.src=assetUrl('assets/road-rash/road-rash-riders-atlas-v3.png');
    }
    this.heroinesAtlas = typeof Image === 'undefined' ? null : new Image();
    if (this.heroinesAtlas) {
      this.heroinesAtlas.addEventListener('load', () => this.prepareAtlas(this.heroinesAtlas, canvas => { this.heroinesAtlasCanvas = canvas; }), { once: true });
      this.heroinesAtlas.src = assetUrl('assets/road-rash/road-rash-heroines-atlas-v1.png');
    }
    if (this.introTimer === 0) this.statusValue = options.debugBoss ? 'boss' : 'racing';
    if (options.debugBoss) {
      this.distance = this.courseLength * .72;
      this.visualDistance = this.distance;
      this.speed = 170;
      this.nextSpawnAt = this.courseLength + 1000;
      this.spawnBoss(170);
    } else if(options.debugCombat){
      this.statusValue='racing';this.introTimer=0;this.speed=142;
      this.entities.push({id:++this.entitySerial,kind:'rival',lane:.28,distance:this.distance+76,speed:116,hp:5,maxHp:5,active:true,attackCooldown:1.1,attackTimer:0,hitFlash:0,reactionTimer:0,recoilSide:0,wobble:0,color:'#2dd4bf'});
    }
  }

  get status(): RoadRashStatus { return this.statusValue; }
  get completed(): boolean { return this.statusValue === 'victory'; }
  get defeated(): boolean { return this.statusValue === 'defeat'; }
  private get bossDefeatAnimating(): boolean { return this.bossDefeatTimer > 0; }
  private get bossDefeatResolved(): boolean { return this.bossDefeated && !this.bossDefeatAnimating; }

  /** Deterministic campaign/harness escape hatch; normal play never calls this. */
  debugCompleteVictory(): RoadRashSnapshot {
    this.playerHp = Math.max(1, this.playerHp);
    this.bossSpawned = true;
    this.bossDefeated = true;
    this.bossDefeatTimer = 0;
    this.finishCrossed = true;
    this.distance = this.courseLength;
    for (const entity of this.entities) if (entity.kind === 'boss' || entity.kind === 'rival') entity.active = false;
    this.changeStatus('victory');
    return this.snapshot();
  }

  /** Deterministic defeat path for continue-system integration tests. */
  debugDefeat(): RoadRashSnapshot {
    this.playerHp = 0;
    this.changeStatus('defeat');
    return this.snapshot();
  }

  update(rawDt: number, controls: RoadRashControls = {}): void {
    const dt = clamp(Number.isFinite(rawDt) ? rawDt : 0, 0, .05);
    this.elapsed += dt;
    this.stateTimer += dt;
    this.impactFlash = Math.max(0, this.impactFlash - dt);
    if (this.impactFreeze > 0) {
      this.impactFreeze = Math.max(0, this.impactFreeze - dt);
      this.shake = Math.max(0, this.shake - dt * 10);
      this.updateParticles(dt * .12);
      return;
    }
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const wasRecoiling = this.playerRecoil > 0;
    this.playerRecoil = Math.max(0, this.playerRecoil - dt);
    // Contact is a transient animation state, not a permanent pose. Without
    // this edge reset the fourth atlas cell survived until the next attack.
    if (wasRecoiling && this.playerRecoil === 0) this.attackConnected = false;
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 24);

    if (this.statusValue === 'intro') {
      this.introTimer -= dt;
      this.speed = lerp(this.speed, 102, Math.min(1, dt * 1.8));
      this.distance += this.speed * dt;
      this.visualDistance += this.speed * dt;
      if (this.introTimer <= 0) this.changeStatus('racing');
      this.updateParticles(dt);
      return;
    }
    if (this.statusValue === 'victory' || this.statusValue === 'defeat') {
      this.speed = Math.max(0, this.speed - dt * (this.completed ? 18 : 70));
      this.distance += this.speed * dt;
      this.visualDistance += this.speed * dt;
      this.updateParticles(dt);
      return;
    }

    const steer = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
    const accelerating = Boolean(controls.accelerate ?? controls.up);
    const braking = Boolean(controls.brake ?? controls.down);
    const throttle = accelerating ? 1 : 0;
    const targetSpeed = braking ? 46 : throttle ? MAX_SPEED : 126;
    const response = targetSpeed > this.speed ? 48 : braking ? 118 : 31;
    this.speed += clamp(targetSpeed - this.speed, -response * dt, response * dt);
    if (Math.abs(this.lane) > .94) this.speed = Math.max(52, this.speed - 54 * dt);

    const steerPower = (.7 + this.speed / MAX_SPEED * .48) * dt;
    this.lane = clamp(this.lane + steer * steerPower, -1.12, 1.12);
    this.lean = lerp(this.lean, steer * .9, Math.min(1, dt * 10));
    if (!steer) this.lean = lerp(this.lean, 0, Math.min(1, dt * 6));
    this.distance += this.speed * dt;
    this.visualDistance += this.speed * dt;

    const attackPressed = Boolean(controls.attackPressed || controls.specialPressed || (controls.attack && this.attackTimer <= 0));
    if (attackPressed && this.attackTimer <= 0) this.beginAttack();

    this.spawnTraffic();
    this.maybeSpawnBoss();
    // Apply the logical gate before AI simulation, so both actors use the same
    // coordinate origin during the arena frame.
    if (this.bossSpawned && !this.bossDefeatResolved) {
      this.distance = Math.min(this.distance, this.courseLength * .9);
    }
    this.updateEntities(dt);
    this.resolveContacts();
    this.updateBossDefeat(dt);
    this.updateParticles(dt);

    this.entities = this.entities.filter(entity => entity.active && entity.distance > this.distance - 95);
    if (this.playerHp <= 0) this.changeStatus('defeat');
    // The last stretch is a boss arena. Race progress waits below the finish,
    // while visualDistance keeps the asphalt and roadside parallax moving.
    if (this.bossSpawned && !this.bossDefeatResolved) {
      this.distance = Math.min(this.distance, this.courseLength * .9);
    }
    if (this.distance >= this.courseLength) {
      if (this.bossDefeatResolved) {
        this.finishCrossed = true;
        this.changeStatus('victory');
      } else {
        this.distance = this.courseLength * .9;
      }
    }
  }

  private beginAttack(): void {
    const nearbyRivals = this.entities.filter(entity =>
      entity.active && (entity.kind === 'rival' || entity.kind === 'boss') &&
      Math.abs(entity.distance - this.distance) < (entity.kind === 'boss' ? 76 : 58),
    );
    if (nearbyRivals.length) {
      const closest = nearbyRivals.reduce((a, b) => Math.abs(a.lane - this.lane) < Math.abs(b.lane - this.lane) ? a : b);
      this.attackSide = closest.lane < this.lane ? -1 : 1;
    } else this.attackSide = this.lean < 0 ? -1 : 1;
    this.attackTimer = .72;
    this.attackConnected = false;
    this.emitSound('road_attack', .72, .9 + this.random() * .16);
  }

  private spawnTraffic(): void {
    while (this.distance + 520 > this.nextSpawnAt && this.nextSpawnAt < this.courseLength - 550) {
      const progress = this.nextSpawnAt / this.courseLength;
      const roll = this.random();
      const kind: EntityKind = roll < .46 ? 'car' : roll < .64 ? 'truck' : roll < .91 ? 'rival' : 'oil';
      const lanes = [-.72, 0, .72];
      const lane = lanes[Math.floor(this.random() * lanes.length)] + (this.random() - .5) * .12;
      const base = kind === 'truck' ? 72 : kind === 'car' ? 92 : kind === 'oil' ? 0 : 138 + progress * 28;
      const hp = kind === 'rival' ? 3 : 1;
      this.entities.push({
        id: ++this.entitySerial, kind, lane, distance: this.nextSpawnAt,
        speed: base, hp, maxHp: hp, active: true, attackCooldown: .6 + this.random(),
        attackTimer: 0, hitFlash: 0, reactionTimer: 0, recoilSide: 0, wobble: this.random() * 6.28,
        color: kind === 'rival' ? (this.random() > .5 ? '#2dd4bf' : '#f472b6') : (this.random() > .5 ? '#f97316' : '#60a5fa'),
      });
      this.nextSpawnAt += lerp(250, 155, progress) + this.random() * 95;
    }
  }

  private maybeSpawnBoss(): void {
    if (!this.bossSpawned && this.distance >= this.courseLength * .72) this.spawnBoss(470);
  }

  private spawnBoss(ahead: number): void {
    this.bossSpawned = true;
    this.changeStatus('boss');
    this.entities.push({
      id: ++this.entitySerial, kind: 'boss', lane: .18, distance: this.distance + ahead,
      speed: Math.max(156, this.speed * .92), hp: 8, maxHp: 8, active: true,
      attackCooldown: 1.4, attackTimer: 0, hitFlash: 0, reactionTimer: 0, recoilSide: 0, wobble: 0, color: '#facc15',
    });
    this.emitMusic('road_boss', 1);
    this.emitSound('warning', .9, .76);
  }

  private updateEntities(dt: number): void {
    for (const entity of this.entities) {
      if (!entity.active) continue;
      entity.hitFlash = Math.max(0, entity.hitFlash - dt);
      entity.reactionTimer = Math.max(0, entity.reactionTimer - dt);
      entity.attackTimer = Math.max(0, entity.attackTimer - dt);
      entity.attackCooldown -= dt;
      entity.wobble += dt * (entity.kind === 'boss' ? 3.5 : 2.2);

      // Zero HP is a visible crash state, not an instant despawn. Keep the
      // Road King alongside the player while drawRival throws the silhouette
      // out of the saddle, and suppress all AI/attack work during the beat.
      if (entity.kind === 'boss' && entity.hp <= 0 && this.bossDefeatAnimating) {
        entity.attackTimer = 0;
        entity.attackCooldown = Number.POSITIVE_INFINITY;
        entity.speed = this.speed;
        entity.distance = lerp(entity.distance, this.distance + 24, Math.min(1, dt * 7));
        entity.lane = clamp(entity.lane + entity.recoilSide * dt * .22, -1.02, 1.02);
        continue;
      }

      if (entity.kind === 'oil') continue;
      if (entity.kind === 'rival' || entity.kind === 'boss') {
        const relative = entity.distance - this.distance;
        const isBoss = entity.kind === 'boss';
        // Rubber-band toward a fair side-by-side combat distance. Far-ahead riders
        // deliberately lose ground; riders knocked behind accelerate to rejoin.
        // Once Road King commits to a swing he matches the player's pace. The
        // old loose chase could carry him outside the contact test between the
        // telegraph and active frame, making a visually correct swing harmless.
        const desiredGap = isBoss && entity.attackTimer > .12 ? 28 : isBoss ? 38 : 46;
        const correction = clamp((desiredGap - relative) * .16, -30, 28);
        const chaseSpeed = isBoss
          ? clamp(this.speed + correction, 128, 216)
          : clamp(this.speed + correction, 105, 198);
        const chaseResponse = isBoss && entity.attackTimer > .12 ? 4.8 : 1.5;
        entity.speed = lerp(entity.speed, chaseSpeed, Math.min(1, dt * chaseResponse));
        // Preserve the rider's current side. Periodically flipping the target
        // lane made the large authored sprites pass through one another after
        // contact, even though their recoil art was correct.
        if (Math.abs(relative) < 150) {
          // Stay inside the player's authored weapon reach. The previous .55
          // boss spacing exceeded the .49 hit window and made repeat hits fail.
          const spacing = isBoss ? (entity.attackTimer > .12 ? .34 : .4) : .43;
          const currentDelta = entity.lane - this.lane;
          const side = entity.reactionTimer > 0
            ? entity.recoilSide
            : Math.abs(currentDelta) > .08 ? Math.sign(currentDelta) : (Math.sin(entity.wobble) > 0 ? 1 : -1);
          const preferredSide = side * (entity.reactionTimer > 0 ? (isBoss ? .58 : .66) : spacing);
          const targetLane = clamp(this.lane + preferredSide, -.85, .85);
          const response = entity.reactionTimer > 0 ? 7.5 : isBoss && entity.attackTimer > .12 ? 5.4 : isBoss ? 1.7 : 1.15;
          entity.lane = lerp(entity.lane, targetLane, Math.min(1, dt * response));
        }
        if (entity.attackTimer <= 0 && entity.reactionTimer <= 0 && Math.abs(relative) < (isBoss ? 58 : 48) &&
            Math.abs(entity.lane - this.lane) < (isBoss ? .48 : .42) && entity.attackCooldown <= 0) {
          // A longer wind-up gives the mace/baton silhouette a readable warning
          // before the active frames begin, especially for the oversized boss.
          entity.attackTimer = isBoss ? .82 : .54;
          entity.attackCooldown = isBoss ? 2.05 : 1.2 + this.random() * .8;
        }
      }
      entity.distance += entity.speed * dt;
      if (entity.kind === 'boss' && !this.bossDefeatResolved && this.distance >= this.courseLength * .9 - 1) {
        // Logical race progress is gated here, so the boss must remain relative
        // to the player rather than continuing along an uncapped world axis.
        // Keep the arena clamp inside the 58-unit attack acquisition radius.
        // At +64 Road King could be visibly alongside the player forever while
        // never satisfying his own attack-start condition.
        entity.distance = clamp(entity.distance, this.distance - 22, this.distance + 52);
      }
    }
  }

  private resolveContacts(): void {
    for (const entity of this.entities) {
      if (!entity.active) continue;
      const dz = entity.distance - this.distance;
      const lateral = Math.abs(entity.lane - this.lane);

      const isBoss = entity.kind === 'boss';
      const hitLongitudinalReach = isBoss ? 76 : 57;
      const hitLateralReach = isBoss ? .62 : .49;
      const targetOnAttackSide = this.attackSide * (entity.lane - this.lane) >= -.08;
      if (!this.attackConnected && entity.hp > 0 && (entity.kind === 'rival' || isBoss) && this.attackTimer > .27 && this.attackTimer < .4 &&
          Math.abs(dz) < hitLongitudinalReach && lateral < hitLateralReach && targetOnAttackSide) {
        entity.hp -= entity.kind === 'boss' ? 1 : 2;
        this.confirmedHits++;
        // Keep the white contact pose to a single beat. The longer recoil that
        // follows carries the motion without hiding both riders in one flash.
        entity.hitFlash = .065;
        entity.reactionTimer = entity.kind === 'boss' ? .68 : .54;
        entity.recoilSide = this.attackSide;
        entity.lane = clamp(entity.lane + this.attackSide * (entity.kind === 'boss' ? .15 : .23), -1.05, 1.05);
        this.attackConnected = true;
        this.attackTimer = .48;
        this.playerRecoil = .48;
        this.impactFreeze = entity.kind === 'boss' ? .085 : .065;
        this.impactFlash = .085;
        this.score += entity.kind === 'boss' ? 400 : 180;
        this.shake = Math.max(this.shake, 5);
        const impact = this.project(dz, entity.lane);
        this.emitImpact(lerp(480 + this.lane * 215, impact.x, .58), impact.y - 88 * impact.scale, entity.kind === 'boss' ? '#fde047' : '#fef08a');
        this.emitSound('melee_hit', .9, entity.kind === 'boss' ? .72 : .94);
        if (entity.hp <= 0) this.defeatRival(entity);
      }

      const enemyAttackActive = isBoss
        ? entity.attackTimer > .12 && entity.attackTimer <= .31
        : entity.attackTimer > .16 && entity.attackTimer < .3;
      const enemyLongitudinalReach = isBoss ? 64 : 45;
      const enemyLateralReach = isBoss ? .5 : .42;
      if ((entity.kind === 'rival' || isBoss) && enemyAttackActive &&
          Math.abs(dz) < enemyLongitudinalReach && lateral < enemyLateralReach) {
        // Dropping below the active range makes each committed swing deal at
        // most one hit. Invulnerability remains a second line of protection.
        entity.attackTimer = isBoss ? .1 : .14;
        this.damagePlayer(isBoss ? 14 : 10, entity.lane < this.lane ? 1 : -1);
      }

      const collisionWidth = entity.kind === 'truck' ? .38 : entity.kind === 'oil' ? .24 : .3;
      if ((entity.kind === 'car' || entity.kind === 'truck' || entity.kind === 'oil') &&
          Math.abs(dz) < (entity.kind === 'oil' ? 14 : 25) && lateral < collisionWidth) {
        entity.active = false;
        if (entity.kind === 'oil') {
          this.lane = clamp(this.lane + (this.random() > .5 ? .62 : -.62), -1.1, 1.1);
          this.speed *= .72;
          this.damagePlayer(6, 0);
        } else {
          this.speed *= entity.kind === 'truck' ? .36 : .52;
          this.damagePlayer(entity.kind === 'truck' ? 24 : 16, entity.lane < this.lane ? 1 : -1);
        }
        this.collisions++;
      }
    }
  }

  private defeatRival(entity: RoadEntity): void {
    this.rivalsDefeated++;
    this.score += entity.kind === 'boss' ? 5000 : 900;
    for (let index = 0; index < 14; index++) {
      this.particles.push({ x: 480 + (entity.lane - this.lane) * 190, y: 360, vx: (this.random() - .5) * 190,
        vy: -35 - this.random() * 145, life: .5 + this.random() * .45, maxLife: 1, size: 2 + this.random() * 4,
        color: index % 3 ? entity.color : '#fff7ae', kind: index % 4 ? 'spark' : 'star' });
    }
    if (entity.kind === 'boss') {
      this.bossDefeated = true;
      this.bossDefeatTimer = BOSS_DEFEAT_DURATION;
      entity.active = true;
      entity.hp = 0;
      entity.attackTimer = 0;
      entity.attackCooldown = Number.POSITIVE_INFINITY;
      entity.reactionTimer = 0;
      entity.recoilSide = this.attackSide;
      this.emitSound('boss_down', 1, .7);
    } else {
      entity.active = false;
    }
  }

  private updateBossDefeat(dt: number): void {
    if (!this.bossDefeatAnimating) return;
    const boss = this.entities.find(entity => entity.kind === 'boss' && entity.active);
    this.bossDefeatTimer = Math.max(0, this.bossDefeatTimer - dt);
    if (boss && this.random() < dt * 28) {
      const projected = this.project(boss.distance - this.distance, boss.lane);
      const smoke = this.random() > .42;
      this.particles.push({
        x: projected.x + (this.random() - .5) * 54 * projected.scale,
        y: projected.y - (42 + this.random() * 84) * projected.scale,
        vx: boss.recoilSide * (24 + this.random() * 54),
        vy: smoke ? -18 - this.random() * 30 : -65 - this.random() * 90,
        life: smoke ? .48 + this.random() * .42 : .16 + this.random() * .22,
        maxLife: smoke ? .9 : .38,
        size: smoke ? 5 + this.random() * 7 : 2 + this.random() * 4,
        color: smoke ? (this.random() > .5 ? '#4d4050' : '#9d7754') : '#ffe47a',
        kind: smoke ? 'smoke' : 'spark',
      });
    }
    if (this.bossDefeatTimer === 0) {
      if (boss) boss.active = false;
      this.changeStatus('racing');
      this.emitMusic('road_finale', 1);
    }
  }

  private damagePlayer(amount: number, push: number): void {
    if (this.invulnerability > 0) return;
    this.playerHp = Math.max(0, this.playerHp - amount);
    this.invulnerability = .72;
    this.hitFlash = .25;
    this.attackConnected = false;
    this.attackSide = push >= 0 ? -1 : 1;
    this.playerRecoil = .48;
    this.shake = Math.max(this.shake, amount > 15 ? 10 : 6);
    this.lane = clamp(this.lane + push * .16, -1.1, 1.1);
    this.emitImpact(480 + this.lane * 215, 405, '#fb7185');
    this.emitSound('rider_hurt', .85, .8);
  }

  private updateParticles(dt: number): void {
    if (this.speed > 100 && this.random() < dt * 16) {
      this.particles.push({ x: 480 + (this.random() - .5) * 220, y: 430, vx: (this.random() - .5) * 18,
        vy: 38 + this.random() * 44, life: .28, maxLife: .28, size: 2 + this.random() * 3,
        color: '#d7c9a1', kind: 'smoke' });
    }
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.kind === 'smoke' ? -8 * dt : 250 * dt;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
  }

  private emitImpact(x: number, y: number, color: string): void {
    for (let index = 0; index < 7; index++) this.particles.push({
      x, y, vx: (this.random() - .5) * 210, vy: -30 - this.random() * 110,
      life: .09 + this.random() * .13, maxLife: .22, size: 2 + this.random() * 4,
      color, kind: index % 3 ? 'spark' : 'star',
    });
  }

  private changeStatus(status: RoadRashStatus): void {
    if (this.statusValue === status) return;
    this.statusValue = status;
    this.stateTimer = 0;
    if (status === 'victory' || status === 'defeat') {
      this.attackTimer = 0;
      this.attackConnected = false;
      this.playerRecoil = 0;
      this.impactFreeze = 0;
      this.impactFlash = 0;
      for (const entity of this.entities) {
        entity.attackTimer = 0;
        entity.reactionTimer = 0;
        if (status === 'victory' && (entity.kind === 'rival' || entity.kind === 'boss')) entity.active = false;
      }
    }
    if (status === 'racing' && this.elapsed < 4) this.emitMusic('road_rash', .9);
    if (status === 'victory') { this.speed = Math.min(this.speed, 108); this.score += Math.round(this.playerHp * 50); this.emitMusic('victory', 1); this.emitSound('stage_clear', 1, 1); }
    if (status === 'defeat') { this.emitMusic('defeat', 1); this.emitSound('game_over', 1, .82); }
  }

  private emitSound(name: string, volume: number, pitch: number): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('venus:sfx', { detail: { name, volume, pitch } }));
  }

  private emitMusic(cue: string, intensity: number): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('venus:music', { detail: { cue, intensity } }));
  }

  private random(): number {
    let value = this.rngState;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.rngState = value >>> 0;
    return this.rngState / 4294967296;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const shakeX = this.shake ? (this.random() - .5) * this.shake : 0;
    const shakeY = this.shake ? (this.random() - .5) * this.shake * .55 : 0;
    ctx.translate(px(shakeX), px(shakeY));
    this.drawSky(ctx);
    this.drawRoad(ctx);
    this.drawForegroundMotion(ctx);
    this.drawWorldObjects(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawHud(ctx);
    this.drawOverlay(ctx);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#100622'); gradient.addColorStop(.5, '#8e2f47'); gradient.addColorStop(1, '#151329');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    const hasPanorama = Boolean(isArtEnabled() && this.panorama?.complete && this.panorama.naturalWidth > 0);
    if (hasPanorama && this.panorama) {
      // The asset was authored at exactly 16:9. Showing the whole frame preserves
      // its road, foreground industry and generous vertical depth.
      ctx.drawImage(this.panorama, 0, 0, this.panorama.naturalWidth, this.panorama.naturalHeight, 0, 0, W, H);
      ctx.fillStyle = '#15082518'; ctx.fillRect(0, 0, W, H);
    }
    if (!hasPanorama) {
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(716, 54, 90, 90);
      ctx.fillStyle = '#f19169';
      for (let y = 66; y < 140; y += 12) ctx.fillRect(712, y, 98, 5);
      const farShift = (this.visualDistance * .025) % 180;
      ctx.fillStyle = '#30245d';
      ctx.beginPath(); ctx.moveTo(-180 - farShift, HORIZON + 18);
      for (let x = -180; x < W + 360; x += 90) ctx.lineTo(x - farShift, 104 + ((x / 90) % 3 + 3) % 3 * 18);
      ctx.lineTo(W + 200, HORIZON + 25); ctx.closePath(); ctx.fill();
      const nearShift = (this.visualDistance * .055) % 240;
      ctx.fillStyle = '#171b46';
      ctx.beginPath(); ctx.moveTo(-240 - nearShift, HORIZON + 38);
      for (let x = -240; x < W + 480; x += 80) ctx.lineTo(x - nearShift, 138 - Math.abs((x / 80) % 4 - 2) * 9);
      ctx.lineTo(W + 200, HORIZON + 45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#242335'; ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    // Heat haze at the vanishing point keeps the static panorama alive without
    // muddying its deliberately crisp pixel clusters.
    ctx.globalAlpha = .16 + Math.sin(this.elapsed * 3.1) * .035;
    ctx.fillStyle = '#ffd66d'; ctx.fillRect(VANISH_X - 59, HORIZON + 11, 118, 2);
    ctx.fillStyle = '#79eff0'; ctx.fillRect(VANISH_X - 32, HORIZON + 18, 64, 1);
    ctx.globalAlpha = 1;
  }

  private roadCurve(atDistance: number): number {
    // This course runs through the monumental straight seen in the panorama.
    // Tiny lateral drift supplies motion while keeping overlays registered.
    return Math.sin(atDistance * .00115) * .045 + Math.sin(atDistance * .00039 + 1.3) * .028;
  }

  private project(relativeDistance: number, lane: number): { x: number; y: number; scale: number; roadHalf: number } {
    const depth = clamp(1 - relativeDistance / 620, 0, 1);
    const perspective = depth * depth;
    const y = HORIZON + perspective * (ROAD_BOTTOM - HORIZON);
    const roadHalf = lerp(10, 486, perspective);
    const curve = this.roadCurve(this.visualDistance + relativeDistance) * (1 - depth) * 210;
    const roadCenter = lerp(VANISH_X, W / 2, perspective);
    return { x: roadCenter + curve + lane * roadHalf * .72, y, scale: .12 + perspective * 1.02, roadHalf };
  }

  private drawRoad(ctx: CanvasRenderingContext2D): void {
    // Moving seams are translucent: the detailed authored asphalt remains the
    // hero, while their acceleration gives an unmistakable sense of speed.
    const offset = this.visualDistance % 78;
    for (let marker = -offset; marker < 620; marker += 78) {
      const a = this.project(marker + 24, 0); const b = this.project(marker, 0);
      if (b.y < HORIZON || a.y > H) continue;
      for (const lane of [-.34, .34]) {
        ctx.strokeStyle = '#fff4c6b8'; ctx.lineWidth = Math.max(1, px(b.scale * 3));
        ctx.beginPath(); ctx.moveTo(px(a.x + lane * a.roadHalf), px(a.y)); ctx.lineTo(px(b.x + lane * b.roadHalf), px(b.y)); ctx.stroke();
      }
    }
    // Perspective-locked transverse seams make the asphalt itself travel,
    // instead of leaving motion entirely to props sliding over a static plate.
    const seamOffset = this.visualDistance % 47;
    for (let marker = -seamOffset; marker < 620; marker += 47) {
      const seam = this.project(marker, 0);
      if (seam.y < HORIZON + 2 || seam.y > ROAD_BOTTOM) continue;
      const band = Math.floor((this.visualDistance + marker) / 47);
      const half = seam.roadHalf * (.68 + ((band % 4 + 4) % 4) * .065);
      ctx.globalAlpha = clamp((seam.scale - .1) * .34, .035, .28);
      ctx.strokeStyle = band % 3 ? '#080817' : '#84604d';
      ctx.lineWidth = Math.max(1, px(seam.scale * 2));
      ctx.beginPath(); ctx.moveTo(px(seam.x - half), px(seam.y)); ctx.lineTo(px(seam.x + half), px(seam.y)); ctx.stroke();
      if (band % 2 === 0) {
        ctx.globalAlpha = clamp((seam.scale - .08) * .9, .08, .62);
        ctx.fillStyle = band % 4 ? '#64eee2' : '#ffd65b';
        const reflector = Math.max(1, px(3 * seam.scale));
        ctx.fillRect(px(seam.x - seam.roadHalf * .81), px(seam.y - reflector), reflector * 2, reflector);
        ctx.fillRect(px(seam.x + seam.roadHalf * .81 - reflector * 2), px(seam.y - reflector), reflector * 2, reflector);
      }
    }
    ctx.globalAlpha = 1;
    const speedLines = Math.floor(clamp((this.speed - 105) / 11, 0, 11));
    for (let index = 0; index < speedLines; index++) {
      const side = index % 2 ? 1 : -1;
      const phase = ((this.elapsed * (240 + this.speed * 2.2) + index * 73) % 245) / 245;
      const y = HORIZON + 28 + phase * 228;
      const spread = 34 + phase * 430;
      ctx.strokeStyle = index % 3 ? '#ffd36a70' : '#65e8e670';
      ctx.lineWidth = 1 + phase * 3;
      const roadCenter = lerp(VANISH_X, W / 2, phase);
      ctx.beginPath(); ctx.moveTo(roadCenter + side * spread, y); ctx.lineTo(roadCenter + side * (spread + 18 + phase * 42), y + 12 + phase * 28); ctx.stroke();
    }
    // Player shadow anchors the sprite to the road.
    ctx.fillStyle = '#0808138f'; ctx.beginPath(); ctx.ellipse(480 + this.lane * 215, 516, 38, 8, 0, 0, Math.PI * 2); ctx.fill();
  }

  /**
   * Fast perspective cues layered over the authored panorama. The distant
   * refinery bridge in the bitmap is the horizon portal; these repeated
   * gantries and reflector posts visibly travel toward the camera, so the
   * background no longer reads as a stationary picture frame.
   */
  private drawForegroundMotion(ctx: CanvasRenderingContext2D): void {
    const firstPost = Math.ceil(this.visualDistance / 64) * 64;
    for (let marker = firstPost + 576; marker >= firstPost; marker -= 64) {
      const dz = marker - this.visualDistance;
      const band = Math.floor(marker / 64);
      for (const side of [-1, 1]) {
        const pos = this.project(dz, side * 1.03);
        const s = pos.scale;
        if (s < .15 || pos.x < -28 || pos.x > W + 28) continue;
        const postHeight = Math.max(2, px(15 * s));
        const postWidth = Math.max(1, px(4 * s));
        ctx.fillStyle = '#070817b8';
        ctx.fillRect(px(pos.x - postWidth), px(pos.y - postHeight + 2 * s), postWidth * 2, postHeight);
        ctx.fillStyle = (band + side) % 2 ? '#57f1e4' : '#ffd75a';
        ctx.fillRect(px(pos.x - 5 * s), px(pos.y - 15 * s), Math.max(2, px(10 * s)), Math.max(1, px(4 * s)));
        ctx.fillStyle = '#fff4b8';
        ctx.fillRect(px(pos.x - 2 * s), px(pos.y - 14 * s), Math.max(1, px(4 * s)), Math.max(1, px(2 * s)));
      }
    }

    const firstGantry = Math.ceil(this.visualDistance / 720) * 720;
    for (let marker = firstGantry + 720; marker >= firstGantry; marker -= 720) {
      const dz = marker - this.visualDistance;
      if (dz < 18 || dz > 620) continue;
      const pos = this.project(dz, 0);
      const s = pos.scale;
      if (s < .17) continue;
      const edge = pos.roadHalf * 1.035;
      const top = pos.y - 78 * s;
      const beam = Math.max(2, px(8 * s));
      const post = Math.max(2, px(7 * s));
      const alpha = clamp((s - .15) * 1.4, .18, .92);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#09081b';
      ctx.fillRect(px(pos.x - edge), px(top), px(edge * 2), beam);
      ctx.fillRect(px(pos.x - edge), px(top), post, px(pos.y - top));
      ctx.fillRect(px(pos.x + edge - post), px(top), post, px(pos.y - top));
      ctx.fillStyle = '#3b2646';
      ctx.fillRect(px(pos.x - edge + 4 * s), px(top + 2 * s), px(edge * 2 - 8 * s), Math.max(1, px(2 * s)));
      for (let lamp = -3; lamp <= 3; lamp++) {
        ctx.fillStyle = lamp === 0 ? '#fff09a' : '#39e5dd';
        ctx.fillRect(px(pos.x + lamp * edge * .19 - 3 * s), px(top + 4 * s), Math.max(1, px(6 * s)), Math.max(1, px(3 * s)));
      }
      ctx.restore();
    }
  }

  private drawWorldObjects(ctx: CanvasRenderingContext2D): void {
    // Foreground hazards and sulfur crystals cross the frame quickly and create
    // the parallax layer that the distant panorama cannot provide by itself.
    const firstMarker = Math.ceil(this.visualDistance / 118) * 118;
    for (let marker = firstMarker + 590; marker >= firstMarker; marker -= 118) {
      const dz = marker - this.visualDistance;
      for (const side of [-1, 1]) {
        const pos = this.project(dz, side * (1.06 + ((marker / 118) % 3) * .12));
        const s = pos.scale;
        if (s < .16) continue;
        const variant = ((Math.floor(marker / 118) + (side > 0 ? 2 : 0)) % 5 + 5) % 5;
        const authored = variant === 0
          ? this.drawRoadObjectAtlasFrame(ctx, 6, pos.x, pos.y, 82 * s, 108 * s)
          : variant === 1
            ? this.drawRoadObjectAtlasFrame(ctx, 7, pos.x, pos.y, 86 * s, 112 * s)
            : variant === 2
              ? this.drawRoadObjectAtlasFrame(ctx, side > 0 ? 5 : 4, pos.x, pos.y, 106 * s, 106 * s)
              : variant === 3
                ? this.drawRoadObjectAtlasFrame(ctx, 3, pos.x, pos.y, 104 * s, 104 * s)
                : this.drawRoadObjectAtlasFrame(ctx, side > 0 ? 4 : 5, pos.x, pos.y, 100 * s, 100 * s);
        if (!authored) this.drawProceduralRoadsideObject(ctx, pos.x, pos.y, s, side, variant);
      }
    }

    const visible = this.entities
      .map(entity => ({ entity, dz: entity.distance - this.distance }))
      .filter(item => item.entity.active && item.dz > -35 && item.dz < 620)
      .sort((a, b) => b.dz - a.dz);
    for (const item of visible) {
      const pos = this.project(item.dz, item.entity.lane);
      if (item.entity.kind === 'oil') this.drawOil(ctx, pos.x, pos.y, pos.scale);
      else if (item.entity.kind === 'car' || item.entity.kind === 'truck') this.drawVehicle(ctx, item.entity, pos.x, pos.y, pos.scale);
      else this.drawRival(ctx, item.entity, pos.x, pos.y, pos.scale);
    }

    if (this.bossDefeatResolved && this.courseLength - this.distance < 620 && this.courseLength >= this.distance - 30) {
      const p = this.project(this.courseLength - this.distance, 0); const s = p.scale;
      ctx.fillStyle = '#d9e4e8'; ctx.fillRect(px(p.x - p.roadHalf), px(p.y - 60 * s), px(8 * s), px(60 * s));
      ctx.fillRect(px(p.x + p.roadHalf - 8 * s), px(p.y - 60 * s), px(8 * s), px(60 * s));
      ctx.fillStyle = '#121426'; ctx.fillRect(px(p.x - p.roadHalf), px(p.y - 62 * s), px(p.roadHalf * 2), px(17 * s));
      ctx.fillStyle = '#f8d34e'; ctx.font = `bold ${Math.max(5, px(11 * s))}px monospace`; ctx.textAlign = 'center'; ctx.fillText('FINISH', px(p.x), px(p.y - 49 * s));
    }
  }

  private drawVehicle(ctx: CanvasRenderingContext2D, entity: RoadEntity, x: number, y: number, scale: number): void {
    const truck = entity.kind === 'truck';
    if (this.drawRoadObjectAtlasFrame(ctx, truck ? 1 : 0, x, y, (truck ? 132 : 104) * scale, (truck ? 132 : 104) * scale)) return;
    ctx.save(); ctx.translate(px(x), px(y)); ctx.scale(scale, scale);
    const w = truck ? 88 : 70; const h = truck ? 98 : 62;
    ctx.fillStyle = '#070814a8'; ctx.beginPath(); ctx.ellipse(0, 2, w * .58, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#080914'; ctx.fillRect(-w * .47, -21, 14, 25); ctx.fillRect(w * .47 - 14, -21, 14, 25);
    ctx.fillStyle = '#160d23'; ctx.beginPath(); ctx.moveTo(-w / 2, -5); ctx.lineTo(-w * .46, -h * .72);
    ctx.lineTo(-w * .3, -h); ctx.lineTo(w * .3, -h); ctx.lineTo(w * .46, -h * .72); ctx.lineTo(w / 2, -5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = entity.hitFlash > 0 ? '#fff7d6' : entity.color;
    ctx.beginPath(); ctx.moveTo(-w * .45, -12); ctx.lineTo(-w * .4, -h * .67); ctx.lineTo(w * .4, -h * .67);
    ctx.lineTo(w * .45, -12); ctx.lineTo(w * .32, -4); ctx.lineTo(-w * .32, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = truck ? '#101629' : '#17283d'; ctx.beginPath(); ctx.moveTo(-w * .31, -h * .72); ctx.lineTo(-w * .22, -h * .91);
    ctx.lineTo(w * .22, -h * .91); ctx.lineTo(w * .31, -h * .72); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4eb7c2'; ctx.fillRect(-w * .2, -h * .86, w * .4, Math.max(3, h * .07));
    ctx.fillStyle = '#ff445e'; ctx.fillRect(-w * .36, -20, w * .2, 8); ctx.fillRect(w * .16, -20, w * .2, 8);
    ctx.fillStyle = '#ffd66e'; ctx.fillRect(-w * .3, -18, w * .1, 3); ctx.fillRect(w * .2, -18, w * .1, 3);
    ctx.fillStyle = '#b9c4c8'; ctx.fillRect(-w * .38, -8, w * .76, 5);
    ctx.fillStyle = '#211327'; ctx.fillRect(-w * .18, -7, w * .36, 6);
    if (truck) { ctx.fillStyle = '#ffd754'; ctx.fillRect(-25, -58, 50, 5); ctx.fillStyle = '#311934'; ctx.fillRect(-3, -88, 6, 73); }
    ctx.restore();
  }

  private drawOil(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    if (this.drawRoadObjectAtlasFrame(ctx, 2, x, y, 104 * scale, 104 * scale)) return;
    ctx.fillStyle = '#080a14cc'; ctx.beginPath(); ctx.ellipse(px(x), px(y), px(31 * scale), px(9 * scale), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#76549777'; ctx.fillRect(px(x - 9 * scale), px(y - 3 * scale), px(17 * scale), Math.max(1, px(2 * scale)));
  }

  /** Draw one cell from the transparent 4x2 road-object atlas, bottom-centred on the road. */
  private drawRoadObjectAtlasFrame(
    ctx: CanvasRenderingContext2D,
    frame: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    const atlas = this.roadObjectsAtlas;
    if (!isArtEnabled() || !atlas?.complete || atlas.naturalWidth <= 0) return false;
    const column = frame % 4;
    const row = Math.floor(frame / 4);
    // The generated atlas has an odd-sized grid. Integer edge coordinates avoid
    // sampling a transparent seam or a neighbour when smoothing is disabled.
    const sx = Math.floor(column * atlas.naturalWidth / 4);
    const sy = Math.floor(row * atlas.naturalHeight / 2);
    const sw = Math.floor((column + 1) * atlas.naturalWidth / 4) - sx;
    const sh = Math.floor((row + 1) * atlas.naturalHeight / 2) - sy;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, sx, sy, sw, sh, px(x - width * .5), px(y - height), px(width), px(height));
    ctx.restore();
    return true;
  }

  /** Lightweight vector fallback used during asset loading and `?art=vector`. */
  private drawProceduralRoadsideObject(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    side: number,
    variant: number,
  ): void {
    ctx.save(); ctx.translate(px(x), px(y));
    ctx.fillStyle = '#08091b9c'; ctx.beginPath(); ctx.ellipse(0, 2 * scale, 24 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
    if (variant <= 1) {
      ctx.fillStyle = '#311331'; ctx.fillRect(px(-5 * scale), px(-55 * scale), Math.max(2, px(10 * scale)), px(55 * scale));
      ctx.fillStyle = variant ? '#50e6df' : '#f05b43'; ctx.fillRect(px(-9 * scale), px(-58 * scale), px(18 * scale), Math.max(2, px(8 * scale)));
      ctx.fillStyle = '#ffd65a'; ctx.fillRect(px(-4 * scale), px(-56 * scale), Math.max(2, px(8 * scale)), Math.max(2, px(3 * scale)));
    } else {
      ctx.fillStyle = variant === 3 ? '#492238' : side > 0 ? '#26c7be' : '#d14472';
      ctx.beginPath(); ctx.moveTo(px(-20 * scale), 0); ctx.lineTo(px(-8 * scale), px(-38 * scale));
      ctx.lineTo(0, px(-13 * scale)); ctx.lineTo(px(11 * scale), px(-48 * scale)); ctx.lineTo(px(22 * scale), 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff2a4'; ctx.fillRect(px(-4 * scale), px(-27 * scale), Math.max(2, px(5 * scale)), Math.max(2, px(13 * scale)));
    }
    ctx.restore();
  }

  private prepareAtlas(image: HTMLImageElement | null, accept: (canvas: HTMLCanvasElement) => void):void{
    if(!image||!image.naturalWidth||typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return;
    context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data,w=canvas.width,h=canvas.height;
    const queue=new Uint32Array(w*h);let head=0,tail=0;
    const eligible=(index:number)=>{const o=index*4,r=data[o],g=data[o+1],b=data[o+2];return data[o+3]>0&&r>188&&g>188&&b>188&&Math.max(r,g,b)-Math.min(r,g,b)<22;};
    const push=(index:number)=>{if(!eligible(index))return;data[index*4+3]=0;queue[tail++]=index;};
    for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}for(let y=1;y<h-1;y++){push(y*w);push(y*w+w-1);}
    while(head<tail){const index=queue[head++],x=index%w,y=(index/w)|0;if(x>0)push(index-1);if(x<w-1)push(index+1);if(y>0)push(index-w);if(y<h-1)push(index+w);}
    context.putImageData(pixels,0,0);accept(canvas);
  }

  private drawAtlasFrame(ctx:CanvasRenderingContext2D,atlas:HTMLCanvasElement|null,row:number,frame:number,x:number,y:number,width:number,height:number,flip=false):boolean{
    if(!isArtEnabled()||!atlas)return false;
    const cellW=atlas.width/6,cellH=atlas.height/3,sx=Math.floor(clamp(frame,0,5))*cellW,sy=Math.floor(clamp(row,0,2))*cellH;
    ctx.save();ctx.translate(px(x),px(y));ctx.scale(flip?-1:1,1);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas,sx,sy,cellW,cellH,-width*.5,-height,width,height);ctx.restore();return true;
  }

  private drawRidersAtlasFrame(ctx:CanvasRenderingContext2D,row:number,frame:number,x:number,y:number,width:number,height:number,flip=false):boolean{
    return this.drawAtlasFrame(ctx,this.ridersAtlasCanvas,row,frame,x,y,width,height,flip);
  }

  private drawHeroineAtlasFrame(ctx:CanvasRenderingContext2D,frame:number,x:number,y:number,width:number,height:number,flip=false):boolean{
    const row = this.playerHero === 'cassia' ? 0 : this.playerHero === 'bruna' ? 1 : 2;
    return this.drawAtlasFrame(ctx,this.heroinesAtlasCanvas,row,frame,x,y,width,height,flip);
  }

  private drawRival(ctx: CanvasRenderingContext2D, entity: RoadEntity, x: number, y: number, scale: number): void {
    const boss = entity.kind === 'boss'; const s = scale * (boss ? 1.04 : .9);
    const defeatAnimating = boss && entity.hp <= 0 && this.bossDefeatAnimating;
    if (defeatAnimating) {
      const phase = clamp(1 - this.bossDefeatTimer / BOSS_DEFEAT_DURATION, 0, 1);
      const throwEase = ease(phase);
      const direction = entity.recoilSide || 1;
      const throwX = direction * (18 + throwEase * 108) * scale;
      const dropY = (phase < .3 ? -Math.sin(phase / .3 * Math.PI) * 21 : (phase - .3) * 78) * scale;
      const alpha = clamp((1 - phase) * 3.8, 0, 1);
      // The atlas is rotated around its wheel/base, not its centre. Account for
      // the tall sprite's swept horizontal extent so an outward throw remains
      // readable without clipping most of Road King at either canvas edge.
      const defeatScale = scale * lerp(1, .84, throwEase);
      const atlasWidth = BOSS_ATLAS_WIDTH * defeatScale; const atlasHeight = BOSS_ATLAS_HEIGHT * defeatScale;
      const rotation = direction * (.16 + throwEase * 1.08);
      const sweptExtent = Math.abs(Math.cos(rotation)) * atlasWidth * .5 + Math.abs(Math.sin(rotation)) * atlasHeight;
      const defeatX = clamp(x + throwX, sweptExtent + 8, W - sweptExtent - 8);
      ctx.save();
      ctx.globalAlpha = .2 * alpha; ctx.fillStyle = '#ff493f';
      ctx.beginPath(); ctx.ellipse(px(defeatX), px(y + 4 * scale), atlasWidth * .38, Math.max(3, 11 * scale), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px(defeatX), px(y + dropY));
      ctx.rotate(rotation);
      this.drawRidersAtlasFrame(ctx, 2, phase < .28 ? 4 : 5, 0, 0, atlasWidth, atlasHeight, false);
      ctx.restore();
      return;
    }
    const leanPose = Math.sin(entity.wobble) > .32 ? 1 : Math.sin(entity.wobble) < -.32 ? -1 : 0;
    const suspensionPose = Math.abs(Math.floor(entity.wobble * 2.2)) % 3;
    const suspension = suspensionPose === 0 ? -2 : suspensionPose === 1 ? 1 : 0;
    const reactionDuration = boss ? .68 : .54;
    const reactionPhase = entity.reactionTimer > 0 ? 1 - entity.reactionTimer / reactionDuration : 0;
    const recoilDistance = boss ? 48 : 42;
    const recoil = entity.reactionTimer > 0
      ? ((1 - reactionPhase) * 14 + Math.sin(clamp(reactionPhase, 0, 1) * Math.PI) * recoilDistance) * entity.recoilSide
      : 0;
    const attacking=entity.attackTimer>0,side=entity.lane<this.lane?1:-1;
    const telegraphSplit=boss ? .43 : .34;
    const atlasFrame=entity.hitFlash>0?3:entity.reactionTimer>0?(reactionPhase<.62?4:5):attacking?(entity.attackTimer>telegraphSplit?1:2):0;
    const atlasWidth=(boss?BOSS_ATLAS_WIDTH:RIVAL_ATLAS_WIDTH)*scale;
    const atlasHeight=(boss?BOSS_ATLAS_HEIGHT:RIVAL_ATLAS_HEIGHT)*scale;
    // Road combat is side-by-side. Preserve a small screen-space gap at close
    // depth so authored silhouettes never collapse into one unreadable stack.
    const playerX = 480 + this.lane * 215;
    const rawRenderX = x + recoil * s;
    const closeEnough = Math.abs(entity.distance - this.distance) < 86;
    const minimumGap = (PLAYER_ATLAS_WIDTH + (boss ? BOSS_ATLAS_WIDTH : RIVAL_ATLAS_WIDTH)) * scale * .29;
    const separationSide = Math.sign(rawRenderX - playerX) || Math.sign(entity.lane - this.lane) || 1;
    const renderX = closeEnough && Math.abs(rawRenderX - playerX) < minimumGap
      ? playerX + separationSide * minimumGap
      : rawRenderX;
    ctx.save();ctx.globalAlpha=.25;ctx.fillStyle=boss?'#ff493f':'#070813';ctx.beginPath();ctx.ellipse(px(renderX),px(y),atlasWidth*.34,Math.max(3,10*scale),0,0,Math.PI*2);ctx.fill();ctx.restore();
    if (boss && attacking) {
      const swing = clamp((telegraphSplit - entity.attackTimer + .18) / .36, 0, 1);
      ctx.save(); ctx.globalAlpha = .2 + swing * .48;
      ctx.strokeStyle = swing > .48 ? '#fff0a3' : '#f5c542';
      ctx.lineWidth = Math.max(2, px(5 * scale));
      const arcCenterX = renderX + side * 12 * scale;
      const arcCenterY = y - 78 * scale;
      ctx.beginPath();
      ctx.arc(arcCenterX, arcCenterY, 49 * scale, side > 0 ? -1.65 : Math.PI + .1, side > 0 ? .35 : Math.PI * 2 - .35, side < 0);
      ctx.stroke(); ctx.restore();
    }
    if(this.drawRidersAtlasFrame(ctx,boss?2:1,atlasFrame,renderX,y+suspension*s,atlasWidth,atlasHeight,attacking&&side<0))return;
    ctx.save(); ctx.translate(px(renderX), px(y + suspension * s)); ctx.scale(s, s);
    ctx.rotate(leanPose * .045 + (entity.reactionTimer > 0 ? entity.recoilSide * .075 : 0));
    ctx.translate(leanPose * 2.5, 0);
    if (boss) {
      ctx.globalAlpha = .22 + Math.sin(this.elapsed * 7) * .06; ctx.fillStyle = '#ff3c35';
      ctx.beginPath(); ctx.ellipse(0, -54, 43, 61, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    // One strong rear wheel immediately reads as a motorcycle from behind.
    ctx.fillStyle = '#080812'; ctx.beginPath(); ctx.ellipse(leanPose * 2, -9, boss ? 16 : 13, boss ? 29 : 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#343341'; ctx.fillRect(-5, -28, 10, 36); ctx.fillStyle = '#9ca5a4'; ctx.fillRect(-2, -25, 4, 31);
    ctx.fillStyle = '#0b0912'; ctx.fillRect(-31, -24, 14, 8); ctx.fillRect(17, -24, 14, 8);
    ctx.fillStyle = '#d6c9a4'; ctx.fillRect(-29, -22, 12, 4); ctx.fillRect(17, -22, 12, 4);
    if (this.speed > 138) {
      const flame = 5 + ((Math.floor(this.elapsed * 18) + entity.id) % 3) * 3;
      ctx.fillStyle = boss ? '#ff9d22' : '#65eadb'; ctx.fillRect(-28, -15, 7, flame);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(-26, -13, 3, Math.max(3, flame - 4));
    }
    ctx.fillStyle = entity.hitFlash > 0 ? '#fff' : entity.color;
    ctx.beginPath(); ctx.moveTo(-23, -39); ctx.lineTo(-13, -52); ctx.lineTo(13, -52); ctx.lineTo(24, -39);
    ctx.lineTo(13, -27); ctx.lineTo(-14, -27); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6cc43'; ctx.fillRect(-6, -37, 12, 6); ctx.fillStyle = '#43152b'; ctx.fillRect(-3, -48, 6, 14);
    // Boots, jacket and broad bovine shoulders.
    ctx.fillStyle = '#17121c'; ctx.fillRect(-18, -51, 10, 25); ctx.fillRect(8, -51, 10, 25);
    ctx.fillStyle = entity.hitFlash > 0 ? '#fff' : (boss ? '#8d1831' : '#25314b');
    ctx.beginPath(); ctx.moveTo(-25, -92); ctx.lineTo(-15, -103); ctx.lineTo(16, -103); ctx.lineTo(27, -91);
    ctx.lineTo(18, -53); ctx.lineTo(-18, -53); ctx.closePath(); ctx.fill();
    if (boss) {
      // Asymmetric armour avoids the flat cross-shaped torso of the prototype.
      ctx.fillStyle = '#25121d';
      ctx.beginPath(); ctx.moveTo(-23, -98); ctx.lineTo(-12, -103); ctx.lineTo(3, -57); ctx.lineTo(-12, -57); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22, -96); ctx.lineTo(12, -102); ctx.lineTo(2, -57); ctx.lineTo(16, -57); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5c542'; ctx.fillRect(-25, -94, 12, 7); ctx.fillRect(14, -94, 12, 7);
      ctx.fillStyle = '#e9d7a0'; ctx.fillRect(-7, -82, 14, 11); ctx.fillStyle = '#55172b'; ctx.fillRect(-3, -80, 6, 7);
    } else {
      ctx.fillStyle = entity.color; ctx.fillRect(-20, -91, 40, 7); ctx.fillRect(-4, -99, 8, 43);
    }
    // Cow head, ears and horns form a clear silhouette even at medium depth.
    const fur = boss ? '#b77a43' : '#d8b58e'; ctx.fillStyle = fur;
    ctx.beginPath(); ctx.moveTo(-14, -119); ctx.lineTo(-10, -134); ctx.lineTo(10, -134); ctx.lineTo(15, -119);
    ctx.lineTo(10, -104); ctx.lineTo(-10, -104); ctx.closePath(); ctx.fill();
    ctx.fillRect(-24, -129, 12, 8); ctx.fillRect(12, -129, 12, 8);
    ctx.fillStyle = '#f5e3aa';
    ctx.beginPath(); ctx.moveTo(-13, -133); ctx.lineTo(-25, -148); ctx.lineTo(-19, -128); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -133); ctx.lineTo(25, -148); ctx.lineTo(19, -128); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1320'; ctx.fillRect(-14, -120, 28, 7); ctx.fillStyle = '#ffef88'; ctx.fillRect(-8, -117, 5, 3); ctx.fillRect(4, -117, 5, 3);
    ctx.fillStyle = boss ? '#f5c542' : entity.color;
    ctx.fillRect(-20 - leanPose * 3, -121, 8, 4); ctx.fillRect(-28 - leanPose * 5, -119, 10, 3);
    ctx.fillStyle = boss ? '#531426' : '#17223b';
    ctx.beginPath(); ctx.moveTo(-13, -57); ctx.lineTo(-3, -57); ctx.lineTo(-9 - leanPose * 4, -42); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -57); ctx.lineTo(14, -57); ctx.lineTo(10 - leanPose * 3, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fur;
    if (entity.reactionTimer > 0) {
      ctx.save(); ctx.translate(0, -92); ctx.rotate(-entity.recoilSide * (.42 - reactionPhase * .18));
      ctx.fillRect(entity.recoilSide > 0 ? 16 : -16, 0, entity.recoilSide * 43, 9); ctx.restore();
      ctx.fillRect(entity.recoilSide > 0 ? -18 : 18, -94, -entity.recoilSide * 27, 8);
    } else if (attacking) {
      const telegraph = clamp((entity.attackTimer - .3) / .12, 0, 1);
      ctx.save(); ctx.translate(side * 18, -94); ctx.rotate(side * (-.62 * telegraph + .08));
      ctx.fillRect(0, 0, side * 42, 9);
      if (boss) {
        ctx.strokeStyle = '#e8d7a2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(side * 37, 2); ctx.lineTo(side * 68, -15 - telegraph * 22); ctx.stroke();
        ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(side * 73, -17 - telegraph * 22, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff1a2'; ctx.fillRect(side > 0 ? 70 : -78, -22 - telegraph * 22, side * 8, 4);
      } else {
        ctx.fillStyle = '#c8d3d5'; ctx.fillRect(side * 36, -4, side * 34, 5);
        ctx.fillStyle = '#fff3a0'; ctx.fillRect(side * 64, -7, side * 9, 9);
      }
      ctx.restore();
    } else { ctx.fillRect(-34, -93, 17, 8); ctx.fillRect(18, -93, 17, 8); }
    if (boss) { ctx.fillStyle = '#22101d'; ctx.fillRect(-32, -73, 7, 38); ctx.fillRect(25, -73, 7, 38); }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const x = 480 + this.lane * 215;
    const leanPose = this.lean > .24 ? 1 : this.lean < -.24 ? -1 : 0;
    const suspensionPose = Math.floor(this.elapsed * (8 + this.speed * .025)) % 3;
    const bob = suspensionPose === 0 ? -3 : suspensionPose === 1 ? 2 : 0;
    const recoilPhase = this.playerRecoil > 0 ? 1 - this.playerRecoil / .48 : 0;
    const recoilShift = this.playerRecoil > 0
      ? -this.attackSide * ((1 - recoilPhase) * 8 + Math.sin(recoilPhase * Math.PI) * 29)
      : 0;
    let atlasFrame=0;
    if(this.attackConnected)atlasFrame=recoilPhase<.12?3:recoilPhase<.62?4:5;
    else if(this.attackTimer>.58)atlasFrame=1;else if(this.attackTimer>.39)atlasFrame=2;else if(this.attackTimer>0)atlasFrame=3;
    ctx.save();ctx.translate(px(x+recoilShift),px(514+bob));ctx.rotate(leanPose*.055+this.lean*.02);
    if (this.hitFlash > 0) ctx.filter = 'brightness(2.8) saturate(0)';
    const atlasDrawn=this.drawHeroineAtlasFrame(ctx,atlasFrame,0,0,PLAYER_ATLAS_WIDTH,PLAYER_ATLAS_HEIGHT,this.attackTimer>0&&this.attackSide<0);
    ctx.restore();
    if(atlasDrawn){
      if(this.speed>132){ctx.fillStyle='#58efe0';const flame=7+(Math.floor(this.elapsed*20)%3)*4;ctx.fillRect(px(x+recoilShift-7),510,5,flame);ctx.fillStyle='#fff18c';ctx.fillRect(px(x+recoilShift-6),510,2,Math.max(3,flame-4));}
      return;
    }
    ctx.save(); ctx.translate(px(x + recoilShift), px(514 + bob)); ctx.rotate(leanPose * .075 + this.lean * .025);
    if (this.speed > 145) {
      ctx.fillStyle = '#73f0e34d';
      for (let index = 0; index < 5; index++) ctx.fillRect(-13 + index * 7, 2 + index % 2 * 4, 3, 22 + index * 6);
    }
    ctx.fillStyle = '#080812'; ctx.beginPath(); ctx.ellipse(leanPose * 3, -9, 16, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c3945'; ctx.fillRect(-6, -31, 12, 40); ctx.fillStyle = '#bec8c5'; ctx.fillRect(-2, -29, 4, 35);
    ctx.fillStyle = '#100b16'; ctx.fillRect(-38, -27, 17, 10); ctx.fillRect(21, -27, 17, 10);
    ctx.fillStyle = '#d8d2bb'; ctx.fillRect(-37, -24, 16, 5); ctx.fillRect(21, -24, 16, 5);
    if (this.speed > 132) {
      const flame = 7 + (Math.floor(this.elapsed * 20) % 3) * 4;
      ctx.fillStyle = '#55e8dc'; ctx.fillRect(-34, -18, 8, flame); ctx.fillStyle = '#fff18c'; ctx.fillRect(-32, -16, 3, Math.max(3, flame - 5));
    }
    const fallbackPalette = this.playerHero === 'cassia'
      ? { bike: '#d63b6b', jacket: '#632155', stripe: '#65eadb', hair: '#f4d13f', visor: '#7ff4e3' }
      : this.playerHero === 'bruna'
        ? { bike: '#318ac6', jacket: '#24384f', stripe: '#86d9ff', hair: '#d8dde3', visor: '#67e8ff' }
        : { bike: '#f0ebe3', jacket: '#9b294d', stripe: '#ff785f', hair: '#f1e7ed', visor: '#ff9b43' };
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : fallbackPalette.bike;
    ctx.beginPath(); ctx.moveTo(-29, -45); ctx.lineTo(-17, -61); ctx.lineTo(17, -61); ctx.lineTo(29, -45);
    ctx.lineTo(16, -31); ctx.lineTo(-17, -31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd849'; ctx.fillRect(-8, -42, 16, 7); ctx.fillStyle = '#4f1743'; ctx.fillRect(-4, -57, 8, 19);
    ctx.fillStyle = '#16101b'; ctx.fillRect(-20, -60, 11, 28); ctx.fillRect(9, -60, 11, 28);
    // Hero jacket uses the same neon-magenta/teal/yellow hierarchy as the core game.
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : fallbackPalette.jacket;
    ctx.beginPath(); ctx.moveTo(-29, -105); ctx.lineTo(-17, -115); ctx.lineTo(18, -115); ctx.lineTo(31, -102);
    ctx.lineTo(20, -61); ctx.lineTo(-20, -61); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fallbackPalette.bike; ctx.fillRect(-25, -103, 50, 8); ctx.fillStyle = fallbackPalette.stripe; ctx.fillRect(-5, -108, 10, 43);
    ctx.fillStyle = '#32142f';
    ctx.beginPath(); ctx.moveTo(-15, -64); ctx.lineTo(-3, -64); ctx.lineTo(-11 - leanPose * 5, -45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -64); ctx.lineTo(16, -64); ctx.lineTo(11 - leanPose * 4, -43); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0d0a2';
    ctx.beginPath(); ctx.moveTo(-15, -133); ctx.lineTo(-11, -148); ctx.lineTo(11, -148); ctx.lineTo(16, -132);
    ctx.lineTo(11, -115); ctx.lineTo(-11, -115); ctx.closePath(); ctx.fill();
    ctx.fillRect(-27, -141, 13, 9); ctx.fillRect(14, -141, 13, 9);
    ctx.fillStyle = '#f7dd73';
    ctx.beginPath(); ctx.moveTo(-13, -146); ctx.lineTo(-27, -162); ctx.lineTo(-20, -141); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, -146); ctx.lineTo(27, -162); ctx.lineTo(20, -141); ctx.closePath(); ctx.fill();
    ctx.fillStyle = fallbackPalette.hair; ctx.fillRect(-18, -139, 36, 8); ctx.fillRect(-22, -136, 7, 14);
    ctx.fillStyle = fallbackPalette.bike; ctx.fillRect(-25 - leanPose * 3, -138, 9, 4); ctx.fillRect(-34 - leanPose * 6, -136, 12, 3);
    ctx.fillStyle = '#171421'; ctx.fillRect(-14, -132, 28, 7); ctx.fillStyle = fallbackPalette.visor; ctx.fillRect(-8, -129, 5, 3); ctx.fillRect(4, -129, 5, 3);
    ctx.fillStyle = '#f0d0a2';
    if (this.attackTimer > 0) {
      let reach = 16; let angle = -.16;
      if (this.attackConnected) {
        if (recoilPhase < .22) { reach = 69; angle = -.7; }
        else if (recoilPhase < .68) { reach = lerp(69, 27, (recoilPhase - .22) / .46); angle = lerp(-.7, .2, (recoilPhase - .22) / .46); }
        else { reach = lerp(27, 10, (recoilPhase - .68) / .32); angle = .2; }
      } else if (this.attackTimer > .58) { reach = 20; angle = .48; }
      else if (this.attackTimer > .39) { const p = (.58 - this.attackTimer) / .19; reach = lerp(20, 69, p); angle = lerp(.48, -.7, p); }
      else { reach = 69; angle = -.7; }
      ctx.save(); ctx.translate(0, -105); ctx.rotate(this.attackSide * angle);
      ctx.fillRect(this.attackSide > 0 ? 17 : -17, 0, this.attackSide * reach, 10);
      ctx.fillStyle = '#d7e0e2'; ctx.fillRect(this.attackSide * (reach + 9), -5, this.attackSide * 42, 6);
      ctx.fillStyle = '#fff4a3'; ctx.fillRect(this.attackSide * (reach + 44), -8, this.attackSide * 10, 12);
      ctx.restore();
    } else { ctx.fillRect(-39, -105, 18, 9); ctx.fillRect(22, -105, 18, 9); }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1); ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color; const size = px(particle.size);
      if (particle.kind === 'star') {
        ctx.fillRect(px(particle.x - size * 2), px(particle.y), size * 4, Math.max(2, size));
        ctx.fillRect(px(particle.x), px(particle.y - size * 2), Math.max(2, size), size * 4);
      } else ctx.fillRect(px(particle.x), px(particle.y), size, particle.kind === 'smoke' ? size * 2 : size);
    }
    ctx.globalAlpha = 1;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#080a18d9'; ctx.fillRect(18, 17, 302, 75); ctx.fillRect(718, 17, 224, 75);
    ctx.strokeStyle = '#56d8c8'; ctx.lineWidth = 3; ctx.strokeRect(18.5, 17.5, 302, 75); ctx.strokeRect(718.5, 17.5, 224, 75);
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#f8df71'; ctx.fillText(this.playerName, 32, 40);
    ctx.fillStyle = '#261529'; ctx.fillRect(32, 50, 248, 17); ctx.fillStyle = this.playerHp > 30 ? '#39c59f' : '#ef476f'; ctx.fillRect(35, 53, px(242 * this.playerHp / 100), 11);
    ctx.fillStyle = '#e8ecde'; ctx.font = 'bold 12px monospace'; ctx.fillText(`HP ${this.playerHp.toString().padStart(3, '0')}`, 32, 84);
    ctx.textAlign = 'right'; ctx.font = 'bold 25px monospace'; ctx.fillStyle = '#fff0a3'; ctx.fillText(`${Math.round(this.speed).toString().padStart(3, '0')} KM/H`, 927, 48);
    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#85eee0'; ctx.fillText(`${Math.min(100, Math.floor(this.distance / this.courseLength * 100))}%  SCORE ${this.score}`, 927, 77);

    const boss = this.entities.find(entity => entity.kind === 'boss' && entity.active);
    if (boss && !this.bossDefeatAnimating) {
      ctx.fillStyle = '#080a18e8'; ctx.fillRect(288, 103, 384, 34); ctx.strokeStyle = '#f5c542'; ctx.strokeRect(288.5, 103.5, 384, 34);
      ctx.fillStyle = '#35131e'; ctx.fillRect(365, 114, 291, 11); ctx.fillStyle = '#ef4444'; ctx.fillRect(367, 116, 287 * boss.hp / boss.maxHp, 7);
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe66d'; ctx.fillText('ROAD KING', 301, 126);
    }
    ctx.restore();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.bossDefeatAnimating) {
      const phase = clamp(1 - this.bossDefeatTimer / BOSS_DEFEAT_DURATION, 0, 1);
      ctx.globalAlpha = clamp(1 - Math.max(0, phase - .72) / .28, 0, 1);
      ctx.fillStyle = '#301326d9'; ctx.fillRect(298, 400, 364, 40);
      ctx.strokeStyle = '#f5c542'; ctx.strokeRect(298.5, 400.5, 364, 40);
      ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0a3'; ctx.fillText('ROAD KING // WRECKED', 480, 427);
      ctx.globalAlpha = 1;
    } else if (this.statusValue === 'intro') {
      const slide = clamp(this.stateTimer * 3, 0, 1);
      ctx.fillStyle = '#080817c9'; ctx.fillRect(0, 190, W, 132);
      ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#f6d34f'; ctx.fillText('NEON BADLANDS', 480, 240);
      ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#81eee0'; ctx.fillText('GAS UP · DODGE TRAFFIC · STRIKE SIDEWAYS', 480, 279);
      ctx.fillStyle = '#f6d34f'; ctx.fillRect(260, 298, px(440 * slide), 5);
    } else if (this.statusValue === 'boss' && this.stateTimer < 2.1) {
      ctx.fillStyle = '#8d1830d9'; ctx.fillRect(0, 151, W, 49);
      ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff0a3'; ctx.fillText('⚠ ROAD KING CLOSING FAST ⚠', 480, 183);
    } else if (this.statusValue === 'victory' || this.statusValue === 'defeat') {
      ctx.fillStyle = '#070914d9'; ctx.fillRect(0, 153, W, 205);
      ctx.textAlign = 'center'; ctx.font = 'bold 52px monospace'; ctx.fillStyle = this.completed ? '#f6d34f' : '#ef476f';
      ctx.fillText(this.completed ? 'ROAD CONQUERED' : 'WRECKED OUT', 480, 225);
      ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#b7fff5';
      ctx.fillText(this.completed ? `ROAD KING DOWN · SCORE ${this.score}` : 'THE BADLANDS CLAIM ANOTHER RIDER', 480, 269);
      ctx.font = '14px monospace'; ctx.fillStyle = '#e8ecde'; ctx.fillText(`RIVALS ${this.rivalsDefeated}   COLLISIONS ${this.collisions}`, 480, 312);
    }
  }

  private entityScreenX(entity: RoadEntity, dz: number): number { return this.project(dz, entity.lane).x; }

  snapshot(): RoadRashSnapshot {
    const serialize = (entity: RoadEntity): RoadRashEntitySnapshot => ({
      id: entity.id, kind: entity.kind, lane: Number(entity.lane.toFixed(3)), distance: Number(entity.distance.toFixed(2)),
      relativeDistance: Number((entity.distance - this.distance).toFixed(2)), speed: Number(entity.speed.toFixed(2)),
      hp: entity.hp, maxHp: entity.maxHp, active: entity.active, attacking: entity.attackTimer > 0,
    });
    const boss = this.entities.find(entity => entity.kind === 'boss') ?? null;
    return {
      status: this.statusValue, completed: this.completed, defeated: this.defeated,
      elapsed: Number(this.elapsed.toFixed(3)), distance: Number(this.distance.toFixed(2)),
      visualDistance: Number(this.visualDistance.toFixed(2)), courseLength: this.courseLength,
      progress: Number(clamp(this.distance / this.courseLength, 0, 1).toFixed(4)), speed: Number(this.speed.toFixed(2)),
      speedKph: Math.round(this.speed), lane: Number(this.lane.toFixed(3)), health: this.playerHp, maxHealth: 100,
      playerHero: this.playerHero,
      score: this.score, rivalsDefeated: this.rivalsDefeated, collisions: this.collisions,
      hits: this.confirmedHits, finishReady: this.bossDefeatResolved && this.distance >= this.courseLength * .94,
      finishCrossed: this.finishCrossed,
      finishVisible: this.bossDefeatResolved && this.courseLength - this.distance < 620 && this.courseLength >= this.distance - 30,
      bossSpawned: this.bossSpawned, bossDefeated: this.bossDefeated,
      bossDefeatAnimating: this.bossDefeatAnimating,
      bossDefeatTimer: Number(this.bossDefeatTimer.toFixed(3)),
      bossDefeatProgress: Number((this.bossDefeated ? clamp(1 - this.bossDefeatTimer / BOSS_DEFEAT_DURATION, 0, 1) : 0).toFixed(3)),
      boss: boss ? serialize(boss) : null,
      entities: this.entities.filter(entity => entity.active).map(serialize), attackTimer: Number(this.attackTimer.toFixed(3)),
      invulnerability: Number(this.invulnerability.toFixed(3)),
      bossArenaLocked: this.bossSpawned && !this.bossDefeatResolved && this.distance >= this.courseLength * .9 - .01,
    };
  }
}
