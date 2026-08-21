import { gameEvents } from '../core/GameEvents';
import { ImageAsset } from '../core/ImageAsset';
import { BRAWLER_HEROES } from './catalog';
import type {
  BeatEmUpOptions,
  BrawlerControls,
  BrawlerEnemy,
  BrawlerHeroId,
  BrawlerParticle,
  BrawlerPickup,
  BrawlerPlayer,
  BrawlerStatus,
} from './types';

const W = 960;
const H = 540;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const px = (value: number) => Math.round(value / 2) * 2;

function audio(name: string, volume = 1, pitch = 1): void {
  gameEvents.sound(name, volume, pitch);
}

function music(cue: string, intensity = 1): void {
  gameEvents.music(cue, intensity);
}

export class BeatEmUpStage {
  private players: BrawlerPlayer[];
  private enemies: BrawlerEnemy[] = [];
  private particles: BrawlerParticle[] = [];
  private pickups: BrawlerPickup[] = [];
  private status: BrawlerStatus = 'intro';
  private introTimer = 2.8;
  private finishTimer = 0;
  private elapsed = 0;
  private cameraX = 0;
  private waveIndex = 0;
  private arenaLocked = false;
  private goTimer = 0;
  private shake = 0;
  private flash = 0;
  private enemySerial = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private bossDefeated = false;
  private defeatedCount = 0;
  private readonly heroSheets: Record<BrawlerHeroId, ImageAsset>;
  private readonly heroReactionSheets: Record<BrawlerHeroId, ImageAsset>;
  private readonly enemySheet: ImageAsset;
  private readonly bossSheet: ImageAsset;
  private readonly backdrop: ImageAsset;
  private readonly floor: ImageAsset;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly options: BeatEmUpOptions,
  ) {
    const heroes: BrawlerHeroId[] = options.heroes.length ? options.heroes.slice(0, 2) : ['cassia'];
    this.players = heroes.map((hero, index) => this.makePlayer((index + 1) as 1 | 2, hero));
    this.heroSheets = {
      cassia: new ImageAsset(BRAWLER_HEROES.cassia.sprites, 4, 4),
      bruna: new ImageAsset(BRAWLER_HEROES.bruna.sprites, 4, 4),
      nova: new ImageAsset(BRAWLER_HEROES.nova.sprites, 4, 4),
    };
    this.heroReactionSheets = {
      cassia: new ImageAsset(BRAWLER_HEROES.cassia.reactions, 4, 2),
      bruna: new ImageAsset(BRAWLER_HEROES.bruna.reactions, 4, 2),
      nova: new ImageAsset(BRAWLER_HEROES.nova.reactions, 4, 2),
    };
    this.enemySheet = new ImageAsset(options.level.assets.enemies, 4, 6);
    this.bossSheet = new ImageAsset(options.level.assets.boss, 3, 2);
    this.backdrop = new ImageAsset(options.level.assets.backdrop);
    this.floor = new ImageAsset(options.level.assets.floor);
    if (options.debugBoss) {
      this.status = 'running';
      this.introTimer = 0;
      this.cameraX = Math.max(0, options.level.length - 1050);
      this.waveIndex = options.level.waves.length - 1;
      for (const player of this.players) player.x = this.cameraX + 170 + (player.id - 1) * 84;
      this.spawnWave(this.waveIndex, true);
    }
    music(options.debugBoss ? 'boss' : options.level.musicCue, .9);
  }

  private makePlayer(id: 1 | 2, hero: BrawlerHeroId): BrawlerPlayer {
    const spec = BRAWLER_HEROES[hero];
    return {
      id, hero, x: 110 + (id - 1) * 76, y: 382 + (id - 1) * 36, z: 0, vz: 0,
      hp: spec.hp, maxHp: spec.hp, special: 35, facing: 1, moving: false,
      attackTimer: 0, attackDuration: 0, attackStep: 0, attackSerial: 0, comboWindow: 0,
      stun: 0, invuln: 0, knockX: 0, downed: false, hitEnemies: new Set<number>(),
    };
  }

  update(dt: number, controls: BrawlerControls[]): void {
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 24);
    this.flash = Math.max(0, this.flash - dt * 4);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    if (this.status === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) this.status = 'running';
      return;
    }
    if (this.status === 'victory' || this.status === 'defeat') {
      this.finishTimer += dt;
      return;
    }

    for (let index = 0; index < this.players.length; index++) this.updatePlayer(this.players[index], controls[index] ?? controls[0], dt);
    this.updateCamera(dt);
    this.updateEncounter();
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.updatePickups(dt);
    this.resolvePlayerAttacks();
    this.resolveEnemyAttacks();

    this.enemies = this.enemies.filter(enemy => !enemy.dead || enemy.phase < .7);
    if (this.arenaLocked && !this.enemies.some(enemy => !enemy.dead)) {
      this.arenaLocked = false;
      this.waveIndex++;
      this.goTimer = 2.2;
      for (const player of this.players) if (!player.downed) { player.hp = Math.min(player.maxHp, player.hp + 10); player.special = Math.min(100, player.special + 8); }
      audio('pickup', .7, 1.15);
    }
    this.goTimer = Math.max(0, this.goTimer - dt);

    if (!this.players.some(player => !player.downed)) {
      this.status = 'defeat';
      this.finishTimer = 0;
      music('defeat');
      audio('game_over');
    }
    if (this.bossDefeated && !this.enemies.some(enemy => enemy.kind === 'boss' && !enemy.dead)) {
      this.finishTimer += dt;
      if (this.finishTimer > 3.2) {
        this.status = 'victory';
        music('victory');
        audio('stage_clear');
      }
    }
  }

  private updatePlayer(player: BrawlerPlayer, controls: BrawlerControls, dt: number): void {
    if (player.downed) return;
    const spec = BRAWLER_HEROES[player.hero];
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.comboWindow = Math.max(0, player.comboWindow - dt);
    player.stun = Math.max(0, player.stun - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.knockX = lerp(player.knockX, 0, Math.min(1, dt * 8));
    player.x += player.knockX * dt;

    if (player.z > 0 || player.vz !== 0) {
      player.z += player.vz * dt;
      player.vz -= 880 * dt;
      if (player.z <= 0) { player.z = 0; player.vz = 0; this.emitDust(player.x, player.y, 6); }
    }

    if (player.stun <= 0 && player.attackTimer <= 0) {
      const horizontal = (controls.right ? 1 : 0) - (controls.left ? 1 : 0);
      const vertical = (controls.down ? 1 : 0) - (controls.up ? 1 : 0);
      const length = Math.hypot(horizontal, vertical) || 1;
      const speed = spec.speed * (player.z > 0 ? .72 : 1);
      player.x += horizontal / length * speed * dt;
      player.y += vertical / length * speed * .62 * dt;
      player.moving = horizontal !== 0 || vertical !== 0;
      if (horizontal) player.facing = horizontal > 0 ? 1 : -1;
      player.x = clamp(player.x, this.cameraX + 52, Math.min(this.options.level.length - 80, this.cameraX + W - 52));
      player.y = clamp(player.y, this.options.level.floorFar + 24, this.options.level.floorNear - 8);
    } else player.moving = false;

    if (controls.jumpPressed && player.z === 0 && player.stun <= 0) {
      player.vz = player.hero === 'nova' ? 430 : player.hero === 'bruna' ? 350 : 390;
      audio('jump', .65, player.hero === 'bruna' ? .82 : 1.08);
    }
    if (controls.specialPressed && player.special >= 35 && player.stun <= 0) {
      player.special -= 35;
      player.attackStep = 3;
      player.attackDuration = player.attackTimer = .46;
      player.attackSerial++;
      player.hitEnemies.clear();
      player.invuln = .55;
      this.shake = Math.max(this.shake, 7);
      this.emitRing(player.x, player.y - player.z, spec.accent);
      audio('special', .9, player.hero === 'bruna' ? .76 : 1.08);
    } else if (controls.attackPressed && player.stun <= 0 && player.attackTimer <= 0) {
      if (player.z > 12) player.attackStep = 4;
      else player.attackStep = player.comboWindow > 0 ? (player.attackStep + 1) % 3 : 0;
      player.attackDuration = player.attackTimer = player.attackStep === 2 ? .36 : player.attackStep === 4 ? .42 : .25;
      player.comboWindow = .48;
      player.attackSerial++;
      player.hitEnemies.clear();
      audio('melee_swing', .42, .72 + player.attackStep * .08);
    }
  }

  private updateCamera(dt: number): void {
    const living = this.players.filter(player => !player.downed);
    const leadX = living.length ? Math.max(...living.map(player => player.x)) : this.cameraX;
    const waves = this.options.level.waves;
    const lockMax = this.arenaLocked ? waves[Math.min(this.waveIndex, waves.length - 1)].at - 250 : this.options.level.length - W;
    const target = clamp(leadX - 310, 0, Math.max(0, lockMax));
    this.cameraX = lerp(this.cameraX, target, Math.min(1, dt * 4.4));
    for (const player of living) player.x = clamp(player.x, this.cameraX + 46, this.cameraX + W - 42);
  }

  private updateEncounter(): void {
    const waves = this.options.level.waves;
    if (this.arenaLocked || this.waveIndex >= waves.length) return;
    const lead = Math.max(...this.players.filter(player => !player.downed).map(player => player.x), 0);
    const wave = waves[this.waveIndex];
    if (lead >= wave.at - 150) this.spawnWave(this.waveIndex, false);
  }

  private spawnWave(index: number, debugBoss: boolean): void {
    const waves = this.options.level.waves;
    const wave = waves[index];
    this.arenaLocked = true;
    this.goTimer = 0;
    wave.enemies.forEach((kind, enemyIndex) => {
      const isBoss = kind === 'boss';
      const maxHp = isBoss ? (debugBoss ? 260 : 620) : kind === 'bruiser' ? 150 : kind === 'shocker' ? 92 : 74;
      if (isBoss) for (const player of this.players) if (!player.downed) { player.hp = player.maxHp; player.special = Math.max(player.special, 50); }
      this.enemies.push({
        id: ++this.enemySerial, kind,
        x: this.cameraX + (debugBoss && isBoss ? 760 : W + 80 + enemyIndex * 72),
        y: 332 + (enemyIndex % 3) * 58,
        hp: maxHp, maxHp, facing: -1, moving: false, attackTimer: 0, attackSerial: 0, cooldown: .6 + enemyIndex * .15,
        stun: 0, flash: 0, knockX: 0, phase: 0, dead: false, lastHitSerial: {},
      });
    });
    audio('warning', .72, index === waves.length - 1 ? .72 : 1.1);
    if (index === waves.length - 1) music('boss', 1);
  }

  private updateEnemies(dt: number): void {
    const living = this.players.filter(player => !player.downed);
    for (const enemy of this.enemies) {
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.stun = Math.max(0, enemy.stun - dt);
      enemy.cooldown -= dt;
      enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
      enemy.moving = false;
      enemy.phase += dt;
      enemy.knockX = lerp(enemy.knockX, 0, Math.min(1, dt * 7));
      enemy.x += enemy.knockX * dt;
      if (enemy.dead) continue;
      const target = living.reduce<BrawlerPlayer | null>((best, player) => !best || distance(enemy.x, enemy.y, player.x, player.y) < distance(enemy.x, enemy.y, best.x, best.y) ? player : best, null);
      if (!target || enemy.stun > 0) continue;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      enemy.facing = dx >= 0 ? 1 : -1;
      const reach = enemy.kind === 'boss' ? 92 : enemy.kind === 'bruiser' ? 64 : 50;
      if (Math.abs(dx) > reach || Math.abs(dy) > 26) {
        const length = Math.hypot(dx, dy) || 1;
        const speed = enemy.kind === 'boss' ? 105 : enemy.kind === 'bruiser' ? 80 : enemy.kind === 'shocker' ? 118 : 105;
        enemy.x += dx / length * speed * dt;
        enemy.y += dy / length * speed * .72 * dt;
        enemy.moving = true;
      } else if (enemy.cooldown <= 0 && enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.kind === 'boss' ? .78 : .48;
        enemy.attackSerial++;
        enemy.cooldown = enemy.kind === 'boss' ? 1.3 : enemy.kind === 'bruiser' ? 1.25 : .8;
        audio(enemy.kind === 'boss' ? 'boss_cannon' : 'melee_swing', .45, enemy.kind === 'bruiser' ? .7 : 1);
      }
      enemy.x = clamp(enemy.x, this.cameraX + 30, this.cameraX + W + 130);
      enemy.y = clamp(enemy.y, this.options.level.floorFar + 12, this.options.level.floorNear - 4);
    }
  }

  private resolvePlayerAttacks(): void {
    for (const player of this.players) {
      if (player.downed || player.attackTimer <= 0) continue;
      const progress = 1 - player.attackTimer / Math.max(.001, player.attackDuration);
      const active = player.attackStep === 3 ? progress > .12 && progress < .8 : progress > .22 && progress < .62;
      if (!active) continue;
      const radius = player.attackStep === 3 ? 105 : player.attackStep === 4 ? 78 : 52 + player.attackStep * 10;
      const damageAmount = player.attackStep === 3 ? 34 : player.attackStep === 4 ? 27 : [12, 16, 24][player.attackStep] ?? 12;
      for (const enemy of this.enemies) {
        if (enemy.dead || player.hitEnemies.has(enemy.id)) continue;
        const inDepth = Math.abs(enemy.y - player.y) < (player.attackStep === 3 ? 58 : 30);
        const ahead = player.attackStep === 3 || (enemy.x - player.x) * player.facing > -18;
        if (inDepth && ahead && distance(player.x, player.y, enemy.x, enemy.y) <= radius) {
          player.hitEnemies.add(enemy.id);
          enemy.hp -= damageAmount * (player.hero === 'bruna' ? 1.18 : player.hero === 'nova' ? .9 : 1);
          enemy.stun = player.attackStep >= 2 ? .28 : .15;
          enemy.flash = .12;
          enemy.knockX = player.facing * (player.attackStep >= 2 ? 260 : 145);
          player.special = clamp(player.special + 4.5, 0, 100);
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.comboTimer = 1.8;
          this.score += Math.round(35 * Math.max(1, this.combo * .35));
          this.shake = Math.max(this.shake, player.attackStep >= 2 ? 5 : 2.5);
          this.emitHit(enemy.x, enemy.y - 42, BRAWLER_HEROES[player.hero].accent, player.attackStep >= 2 ? 10 : 6);
          audio('hit', .6, .82 + player.attackStep * .08);
          if (enemy.hp <= 0) this.defeatEnemy(enemy, player);
        }
      }
    }
  }

  private resolveEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.attackTimer <= 0) continue;
      const duration = enemy.kind === 'boss' ? .78 : .48;
      const progress = 1 - enemy.attackTimer / duration;
      if (progress < .42 || progress > .58) continue;
      const radius = enemy.kind === 'boss' ? 112 : enemy.kind === 'bruiser' ? 68 : 48;
      for (const player of this.players) {
        if (player.downed || player.invuln > 0 || enemy.lastHitSerial[player.id] === enemy.attackSerial) continue;
        if (Math.abs(player.y - enemy.y) < 36 && Math.abs(player.x - enemy.x) < radius && player.z < 36) {
          enemy.lastHitSerial[player.id] = enemy.attackSerial;
          const damageAmount = enemy.kind === 'boss' ? 18 : enemy.kind === 'bruiser' ? 17 : 10;
          player.hp -= damageAmount;
          player.stun = .38;
          player.invuln = .75;
          player.knockX = enemy.facing * (enemy.kind === 'boss' ? 310 : 190);
          this.shake = Math.max(this.shake, enemy.kind === 'boss' ? 8 : 4);
          this.emitHit(player.x, player.y - 48, '#ff674d', 8);
          audio('player_hit', .7, .82);
          if (player.hp <= 0) { player.hp = 0; player.downed = true; this.emitBurst(player.x, player.y, BRAWLER_HEROES[player.hero].accent); }
        }
      }
    }
  }

  private defeatEnemy(enemy: BrawlerEnemy, player: BrawlerPlayer): void {
    enemy.dead = true;
    this.defeatedCount++;
    enemy.phase = 0;
    enemy.knockX = player.facing * 330;
    this.score += enemy.kind === 'boss' ? 25_000 : enemy.kind === 'bruiser' ? 750 : 420;
    this.emitBurst(enemy.x, enemy.y, enemy.kind === 'boss' ? '#ff6b39' : '#b965ff');
    audio(enemy.kind === 'boss' ? 'boss_explode' : 'explode', enemy.kind === 'boss' ? 1 : .55, enemy.kind === 'boss' ? .7 : 1);
    if (enemy.kind === 'boss') this.bossDefeated = true;
    else if (Math.random() < .28) this.pickups.push({ x: enemy.x, y: enemy.y, kind: Math.random() < .45 ? 'health' : Math.random() < .7 ? 'special' : 'score', life: 12 });
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.vz -= 500 * dt;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
  }

  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      for (const player of this.players) {
        if (player.downed || distance(pickup.x, pickup.y, player.x, player.y) > 34) continue;
        if (pickup.kind === 'health') player.hp = Math.min(player.maxHp, player.hp + 34);
        else if (pickup.kind === 'special') player.special = Math.min(100, player.special + 35);
        else this.score += 1200;
        pickup.life = 0;
        audio('pickup', .7, 1.18);
      }
    }
    this.pickups = this.pickups.filter(pickup => pickup.life > 0);
  }

  private emitHit(x: number, y: number, color: string, amount: number): void {
    for (let index = 0; index < amount; index++) {
      const angle = Math.PI + (index / Math.max(1, amount - 1) - .5) * 1.6;
      this.particles.push({ x, y, z: 18, vx: Math.cos(angle) * (90 + index * 7), vy: Math.sin(angle) * 36, vz: 80 + index * 8, life: .22 + index * .018, maxLife: .38, size: index % 3 ? 4 : 7, color: index % 3 ? color : '#fff8d8', kind: 'spark' });
    }
  }

  private emitDust(x: number, y: number, amount: number): void {
    for (let index = 0; index < amount; index++) this.particles.push({ x: x + (index - amount / 2) * 5, y, z: 0, vx: -40 + index * 10, vy: 0, vz: 18 + index * 3, life: .34, maxLife: .34, size: 5 + index, color: '#715063', kind: 'dust' });
  }

  private emitRing(x: number, y: number, color: string): void {
    this.particles.push({ x, y, z: 28, vx: 0, vy: 0, vz: 0, life: .48, maxLife: .48, size: 18, color, kind: 'ring' });
  }

  private emitBurst(x: number, y: number, color: string): void {
    for (let index = 0; index < 18; index++) {
      const angle = index / 18 * Math.PI * 2;
      this.particles.push({ x, y, z: 18, vx: Math.cos(angle) * (70 + index * 4), vy: Math.sin(angle) * 30, vz: 60 + (index % 5) * 22, life: .7, maxLife: .7, size: 5 + index % 4, color: index % 3 ? color : '#ffd660', kind: index % 4 ? 'spark' : 'smoke' });
    }
  }

  draw(showStageOverlay = true): void {
    const ctx = this.ctx;
    ctx.save();
    const sx = this.shake > 0 ? (Math.random() - .5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - .5) * this.shake * .6 : 0;
    ctx.translate(px(sx), px(sy));
    this.drawEnvironment();
    const actors: Array<{ y: number; draw: () => void }> = [];
    for (const pickup of this.pickups) actors.push({ y: pickup.y, draw: () => this.drawPickup(pickup) });
    for (const enemy of this.enemies) actors.push({ y: enemy.y, draw: () => this.drawEnemy(enemy) });
    for (const player of this.players) actors.push({ y: player.y, draw: () => this.drawPlayer(player) });
    actors.sort((a, b) => a.y - b.y).forEach(actor => actor.draw());
    for (const particle of this.particles) this.drawParticle(particle);
    this.drawForeground();
    ctx.restore();
    this.drawHud();
    if (showStageOverlay && this.status === 'intro') this.drawIntro();
    if (showStageOverlay && (this.status === 'victory' || this.status === 'defeat')) this.drawResult();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,240,198,${this.flash})`; ctx.fillRect(0, 0, W, H); }
  }

  private drawEnvironment(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#120b20';
    ctx.fillRect(0, 0, W, H);
    if (this.backdrop.state === 'ready' && this.backdrop.image) {
      const image = this.backdrop.image;
      const cropWidth = Math.min(image.naturalWidth, Math.round(image.naturalHeight * (W / 320)));
      const travel = Math.max(0, image.naturalWidth - cropWidth);
      const sourceX = travel ? Math.round((this.cameraX / Math.max(1, this.options.level.length - W)) * travel) : 0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, sourceX, 0, cropWidth, image.naturalHeight, 0, 0, W, 322);
    } else {
      ctx.fillStyle = '#3e1d44'; ctx.fillRect(0, 80, W, 242);
      ctx.fillStyle = '#9b483e'; ctx.fillRect(0, 220, W, 102);
      for (let index = -1; index < 8; index++) {
        const x = px(index * 170 - (this.cameraX * .22) % 170);
        ctx.fillStyle = index % 2 ? '#21152e' : '#2f1933'; ctx.fillRect(x, 112, 118, 210);
        ctx.fillStyle = '#f05d54'; ctx.fillRect(x + 12, 138, 6, 92);
        ctx.fillStyle = '#5de4e0'; ctx.fillRect(x + 30, 160, 44, 4);
      }
    }
    if (this.floor.state === 'ready' && this.floor.image) {
      const tileWidth = Math.round(254 * this.floor.image.naturalWidth / this.floor.image.naturalHeight);
      const offset = -((this.cameraX * 1.04) % tileWidth);
      ctx.imageSmoothingEnabled = false;
      for (let index = -1; index < Math.ceil(W / tileWidth) + 2; index++) ctx.drawImage(this.floor.image, 0, 0, this.floor.image.naturalWidth, this.floor.image.naturalHeight, px(offset + index * tileWidth), 286, tileWidth, 254);
      ctx.fillStyle = '#0a0711aa'; ctx.fillRect(0, 286, W, 4);
      ctx.fillStyle = '#ff7040aa'; ctx.fillRect(0, 289, W, 2);
    } else {
      ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 286, W, 254);
      for (let band = 0; band < 12; band++) {
        const y = this.options.level.floorFar + band * 16;
        ctx.fillStyle = band % 2 ? '#171522' : '#11121b';
        ctx.fillRect(0, y, W, 17);
      }
      for (let index = -2; index < 13; index++) {
        const x = px(index * 104 - (this.cameraX * 1.05) % 104);
        ctx.fillStyle = '#05060d'; ctx.fillRect(x, 302, 4, 178);
        ctx.fillStyle = '#392b43'; ctx.fillRect(x + 4, 304, 2, 174);
        ctx.fillStyle = '#5e3b50'; ctx.fillRect(x + 8, 333 + (index % 3) * 42, 62, 3);
      }
      ctx.fillStyle = '#05060b'; ctx.fillRect(0, 478, W, 62);
      ctx.fillStyle = '#302038'; ctx.fillRect(0, 478, W, 5);
      ctx.fillStyle = '#ff6b43'; ctx.fillRect(0, 482, W, 2);
    }
  }

  private drawForeground(): void {
    const ctx = this.ctx;
    if (this.floor.state === 'ready') {
      ctx.fillStyle = '#07050c99'; ctx.fillRect(0, 532, W, 8);
      ctx.fillStyle = '#56334899'; ctx.fillRect(0, 532, W, 2);
      return;
    }
    for (let index = -1; index < 7; index++) {
      const x = px(index * 210 - (this.cameraX * 1.62) % 210);
      ctx.fillStyle = '#070711'; ctx.fillRect(x, 504, 152, 36);
      ctx.fillStyle = '#21172c'; ctx.fillRect(x + 8, 500, 134, 29);
      ctx.fillStyle = '#664056'; ctx.fillRect(x + 12, 502, 62, 3);
      ctx.fillStyle = index % 2 ? '#ff5a70' : '#4ce6df'; ctx.fillRect(x + 104, 508, 20, 4);
    }
  }

  private drawPlayer(player: BrawlerPlayer): void {
    const ctx = this.ctx;
    const spec = BRAWLER_HEROES[player.hero];
    const screenX = px(player.x - this.cameraX);
    const screenY = px(player.y - player.z);
    ctx.save();
    ctx.globalAlpha = player.downed ? .42 : player.invuln > 0 && Math.floor(player.invuln * 18) % 2 ? .55 : 1;
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(screenX, player.y + 5, player.downed ? 50 : 36, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(screenX, screenY);
    const frame = this.playerFrame(player);
    const authoredSize = player.hero === 'bruna' ? { width: 184, height: 138 } : player.hero === 'nova' ? { width: 168, height: 126 } : { width: 174, height: 130 };
    let drawn = false;
    if (player.downed || player.stun > .1) {
      ctx.save();
      if (player.facing < 0) ctx.scale(-1, 1);
      drawn = this.drawSheetFrame(this.heroReactionSheets[player.hero], 7, 0, 12, authoredSize.width, authoredSize.height, .5, 1);
      ctx.restore();
    } else drawn = this.drawSheetFrame(this.heroSheets[player.hero], frame, 0, 12, authoredSize.width, authoredSize.height, .5, 1);
    if (!drawn) {
      ctx.save();
      if (player.facing < 0) ctx.scale(-1, 1);
      this.drawPlayerFallback(player, spec);
      ctx.restore();
    }
    ctx.restore();
    if (player.downed) { ctx.fillStyle = spec.accent; ctx.font = '900 11px Arial'; ctx.textAlign = 'center'; ctx.fillText(`P${player.id} DOWN`, screenX, player.y - 84); }
  }

  private playerFrame(player: BrawlerPlayer): number {
    const directionBase = player.facing > 0 ? 0 : 8;
    if (player.z > 8) return directionBase + (player.attackTimer > 0 ? 7 : 6);
    if (player.attackTimer > 0) {
      if (player.attackStep === 0) return directionBase + 3;
      if (player.attackStep === 1) return directionBase + 4;
      return directionBase + 5;
    }
    if (player.moving) return directionBase + 1 + (Math.floor(this.elapsed * 7.5 + player.id) % 2);
    return directionBase;
  }

  private drawPlayerFallback(player: BrawlerPlayer, spec: typeof BRAWLER_HEROES[BrawlerHeroId]): void {
    const ctx = this.ctx;
    const attack = player.attackTimer > 0;
    ctx.fillStyle = spec.dark; ctx.fillRect(-23, -58, 46, 54);
    ctx.fillStyle = spec.fur; ctx.beginPath(); ctx.ellipse(0, -76, 24, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-18, -92); ctx.lineTo(-29, -112); ctx.lineTo(-7, -96); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -92); ctx.lineTo(27, -112); ctx.lineTo(8, -96); ctx.fill();
    ctx.fillStyle = '#f4d7ad'; ctx.fillRect(-11, -72, 26, 12);
    ctx.fillStyle = spec.accent; ctx.fillRect(-22, -54, 44, 6);
    ctx.fillStyle = spec.fur; ctx.fillRect(attack ? 8 : -27, -48, attack ? 54 : 18, 12); ctx.fillRect(-28, -7, 18, 28); ctx.fillRect(10, -7, 18, 28);
    ctx.fillStyle = '#11121a'; ctx.fillRect(-31, 18, 23, 8); ctx.fillRect(8, 18, 23, 8);
    if (player.hero === 'bruna') { ctx.fillStyle = '#a9d8e8'; ctx.fillRect(-31, -50, 14, 42); ctx.fillStyle = '#51e8ff'; ctx.fillRect(-28, -47, 5, 5); }
  }

  private drawEnemy(enemy: BrawlerEnemy): void {
    const ctx = this.ctx;
    const screenX = px(enemy.x - this.cameraX);
    const screenY = px(enemy.y);
    ctx.save();
    ctx.globalAlpha = enemy.dead ? clamp(1 - enemy.phase / .7, 0, 1) : 1;
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(screenX, screenY + 4, enemy.kind === 'boss' ? 76 : 34, enemy.kind === 'boss' ? 16 : 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(screenX, screenY);
    if (enemy.kind === 'boss' && enemy.facing > 0) ctx.scale(-1, 1);
    if (enemy.dead && enemy.kind !== 'boss') ctx.rotate(-enemy.facing * enemy.phase * 1.2);
    const attacking = enemy.attackTimer > 0;
    const hit = enemy.flash > 0;
    const frame = attacking ? 3 : enemy.moving ? 1 + (Math.floor(enemy.phase * 7) % 2) : 0;
    const asset = enemy.kind === 'boss' ? this.bossSheet : this.enemySheet;
    const bossAttackProgress = attacking ? 1 - enemy.attackTimer / .78 : 0;
    const mappedFrame = enemy.kind === 'boss'
      ? enemy.dead ? 5 : hit ? 4 : attacking ? (bossAttackProgress > .45 ? 3 : 2) : Math.floor(enemy.phase * 5) % 2
      : (enemy.kind === 'bruiser' ? 8 : enemy.kind === 'shocker' ? 16 : 0) + (enemy.facing > 0 ? 0 : 4) + frame;
    const width = enemy.kind === 'boss' ? 268 : enemy.kind === 'bruiser' ? 174 : enemy.kind === 'shocker' ? 142 : 138;
    const height = enemy.kind === 'boss' ? 202 : enemy.kind === 'bruiser' ? 142 : enemy.kind === 'shocker' ? 118 : 114;
    if (!this.drawSheetFrame(asset, mappedFrame, 0, 10, width, height, .5, 1)) {
      ctx.save();
      if (enemy.kind !== 'boss' && enemy.facing < 0) ctx.scale(-1, 1);
      this.drawEnemyFallback(enemy);
      ctx.restore();
    }
    if (hit && !enemy.dead) {
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .42;
      this.drawSheetFrame(asset, mappedFrame, 0, 10, width, height, .5, 1);
    }
    ctx.restore();
  }

  private drawEnemyFallback(enemy: BrawlerEnemy): void {
    const ctx = this.ctx;
    const boss = enemy.kind === 'boss';
    const bruiser = enemy.kind === 'bruiser';
    const scale = boss ? 1.65 : bruiser ? 1.2 : 1;
    ctx.scale(scale, scale);
    ctx.fillStyle = enemy.flash > 0 ? '#fff' : boss ? '#7d335d' : enemy.kind === 'shocker' ? '#2aa8a9' : bruiser ? '#7c3840' : '#4b345f';
    ctx.fillRect(-24, -66, 48, 62); ctx.fillRect(-32, -54, 14, 48); ctx.fillRect(18, -54, 14, 48);
    ctx.fillStyle = '#16131f'; ctx.fillRect(-27, -5, 20, 30); ctx.fillRect(7, -5, 20, 30);
    ctx.fillStyle = '#b7a7c6'; ctx.beginPath(); ctx.ellipse(0, -79, 23, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff506f'; ctx.fillRect(4, -83, 12, 4);
    if (enemy.attackTimer > 0) { ctx.fillStyle = '#ffb840'; ctx.fillRect(24, -48, boss ? 56 : 38, boss ? 18 : 12); }
  }

  private drawSheetFrame(asset: ImageAsset, frame: number, x: number, y: number, width: number, height: number, anchorX: number, anchorY: number): boolean {
    if (asset.state !== 'ready' || !asset.image) return false;
    const image = asset.image;
    const frameWidth = image.naturalWidth / asset.columns;
    const frameHeight = image.naturalHeight / asset.rows;
    const wrapped = ((frame % (asset.columns * asset.rows)) + asset.columns * asset.rows) % (asset.columns * asset.rows);
    const sx = (wrapped % asset.columns) * frameWidth;
    const sy = Math.floor(wrapped / asset.columns) * frameHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(image, sx, sy, frameWidth, frameHeight, x - width * anchorX, y - height * anchorY, width, height);
    return true;
  }

  private drawParticle(particle: BrawlerParticle): void {
    const ctx = this.ctx;
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    const x = px(particle.x - this.cameraX);
    const y = px(particle.y - particle.z);
    ctx.save(); ctx.globalAlpha = alpha;
    if (particle.kind === 'ring') {
      const radius = particle.size + (1 - alpha) * 70;
      ctx.fillStyle = particle.color;
      for (let index = 0; index < 18; index++) {
        const angle = index / 18 * Math.PI * 2;
        const segmentX = px(x + Math.cos(angle) * radius);
        const segmentY = px(y + Math.sin(angle) * radius * .42);
        const size = index % 3 === 0 ? 6 : 4;
        ctx.fillRect(segmentX - size / 2, segmentY - size / 2, size, size);
      }
    }
    else { const size = px(particle.size * (.7 + (1 - alpha) * .6)); ctx.fillStyle = particle.color; ctx.fillRect(x - size / 2, y - size / 2, size, size); }
    ctx.restore();
  }

  private drawPickup(pickup: BrawlerPickup): void {
    const ctx = this.ctx;
    const x = px(pickup.x - this.cameraX);
    const y = px(pickup.y - 12 - Math.sin(this.elapsed * 6) * 4);
    ctx.fillStyle = '#080610'; ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.strokeStyle = pickup.kind === 'health' ? '#ff5578' : pickup.kind === 'special' ? '#58e6e0' : '#ffd65c'; ctx.lineWidth = 3; ctx.strokeRect(x - 12, y - 12, 24, 24);
    ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(x - 4, y - 9, 8, 18); ctx.fillRect(x - 9, y - 4, 18, 8);
  }

  private drawHud(): void {
    const ctx = this.ctx;
    for (const player of this.players) {
      const spec = BRAWLER_HEROES[player.hero];
      const left = player.id === 1 ? 14 : 704;
      ctx.fillStyle = '#070610e8'; ctx.fillRect(left, 12, 242, 58);
      ctx.strokeStyle = spec.accent; ctx.lineWidth = 2; ctx.strokeRect(left, 12, 242, 58);
      ctx.fillStyle = spec.accent; ctx.font = '900 15px Arial'; ctx.textAlign = 'left'; ctx.fillText(`P${player.id} ${player.hero.toUpperCase()}`, left + 10, 33);
      ctx.fillStyle = '#291524'; ctx.fillRect(left + 10, 42, 142, 10); ctx.fillStyle = '#ff5272'; ctx.fillRect(left + 12, 44, 138 * player.hp / player.maxHp, 6);
      ctx.fillStyle = '#14263b'; ctx.fillRect(left + 160, 42, 70, 10); ctx.fillStyle = '#55e6ee'; ctx.fillRect(left + 162, 44, 66 * player.special / 100, 6);
      ctx.fillStyle = '#c7b8ce'; ctx.font = '700 9px Arial'; ctx.fillText(`HP ${Math.ceil(player.hp)}`, left + 10, 65); ctx.fillText(`SP ${Math.floor(player.special)}`, left + 160, 65);
    }
    ctx.fillStyle = '#070610df'; ctx.fillRect(344, 12, 272, 54); ctx.strokeStyle = '#65416e'; ctx.strokeRect(344, 12, 272, 54);
    ctx.fillStyle = '#fff'; ctx.font = '900 19px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.score.toString().padStart(8, '0'), 480, 35);
    ctx.fillStyle = '#ff5e83'; ctx.font = '800 10px Arial'; ctx.fillText(`STAGE ${this.options.level.order} // ${this.arenaLocked ? 'AREA LOCKED' : 'MOVE RIGHT'}`, 480, 55);
    if (this.combo > 1 && this.comboTimer > 0) { ctx.fillStyle = '#ffd65c'; ctx.font = '900 25px Arial'; ctx.textAlign = 'right'; ctx.fillText(`${this.combo} HIT`, 934, 104); }
    if (this.goTimer > 0) { ctx.fillStyle = '#5af0df'; ctx.font = '900 31px Arial'; ctx.textAlign = 'right'; ctx.fillText('GO >', 914, 150); }
    const boss = this.enemies.find(enemy => enemy.kind === 'boss' && !enemy.dead);
    if (boss) {
      ctx.fillStyle = '#090613e6'; ctx.fillRect(212, 486, 536, 40);
      ctx.fillStyle = '#ffb45a'; ctx.font = '900 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.options.level.bossName, 480, 501);
      ctx.fillStyle = '#281426'; ctx.fillRect(229, 507, 502, 10);
      ctx.fillStyle = '#ff486f'; ctx.fillRect(231, 509, 498 * Math.max(0, boss.hp / boss.maxHp), 6);
    }
  }

  private drawIntro(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#05030acc'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#160d22ef'; ctx.fillRect(178, 150, 604, 222); ctx.strokeStyle = '#ff5a78'; ctx.lineWidth = 4; ctx.strokeRect(178, 150, 604, 222);
    ctx.fillStyle = '#ffd85a'; ctx.font = '900 17px Arial'; ctx.textAlign = 'center'; ctx.fillText(`STAGE ${this.options.level.order}`, 480, 196);
    ctx.fillStyle = '#fff'; ctx.font = '900 42px Arial'; ctx.fillText(this.options.level.title, 480, 245);
    ctx.fillStyle = '#65e9df'; ctx.font = '800 14px Arial'; ctx.fillText("BREAK THE OVERSEER'S STREET BLOCKADE", 480, 277);
    ctx.fillStyle = '#c7b6cc'; ctx.font = '700 12px Arial'; ctx.fillText('MOVE IN 8 DIRECTIONS  //  Z ATTACK  //  X JUMP  //  C SPECIAL', 480, 326);
  }

  private drawResult(): void {
    const ctx = this.ctx;
    const win = this.status === 'victory';
    ctx.fillStyle = '#05030bcc'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#130b1fed'; ctx.fillRect(220, 154, 520, 220); ctx.strokeStyle = win ? '#ffe062' : '#ff4d69'; ctx.lineWidth = 4; ctx.strokeRect(220, 154, 520, 220);
    ctx.fillStyle = win ? '#ffe868' : '#ff5873'; ctx.font = '900 38px Arial'; ctx.textAlign = 'center'; ctx.fillText(win ? 'DISTRICT LIBERATED!' : 'CREW DOWN', 480, 224);
    ctx.fillStyle = '#fff'; ctx.font = '900 25px Arial'; ctx.fillText(this.score.toString().padStart(8, '0'), 480, 278);
    ctx.fillStyle = '#c9b8ce'; ctx.font = '700 13px Arial'; ctx.fillText(win ? `${this.options.level.bossName} IS FINISHED` : 'VENUS STILL NEEDS ITS RIDERS', 480, 314);
  }

  snapshot() {
    const boss = this.enemies.find(enemy => enemy.kind === 'boss' && !enemy.dead);
    const assets = {
      cassia: this.heroSheets.cassia.state, bruna: this.heroSheets.bruna.state, nova: this.heroSheets.nova.state,
      enemies: this.enemySheet.state, boss: this.bossSheet.state, environment: this.backdrop.state, floor: this.floor.state,
    };
    return {
      status: this.status, elapsed: Number(this.elapsed.toFixed(2)), cameraX: Number(this.cameraX.toFixed(2)),
      levelId: this.options.level.id, stageLength: this.options.level.length, wave: this.waveIndex, arenaLocked: this.arenaLocked, score: this.score, combo: this.combo, maxCombo: this.maxCombo,
      players: this.players.map(player => ({ id: player.id, hero: player.hero, x: Number(player.x.toFixed(2)), y: Number(player.y.toFixed(2)), z: Number(player.z.toFixed(2)), hp: Number(player.hp.toFixed(2)), maxHp: player.maxHp, special: Number(player.special.toFixed(2)), downed: player.downed, facing: player.facing, moving: player.moving, frame: this.playerFrame(player), airborneAttack: player.z > 8 && player.attackTimer > 0, attackStep: player.attackStep, attackTimer: Number(player.attackTimer.toFixed(3)) })),
      enemies: this.enemies.filter(enemy => !enemy.dead).map(enemy => ({ id: enemy.id, kind: enemy.kind, x: Number(enemy.x.toFixed(2)), y: Number(enemy.y.toFixed(2)), hp: Number(enemy.hp.toFixed(2)), maxHp: enemy.maxHp, facing: enemy.facing, moving: enemy.moving, frame: enemy.kind === 'boss' ? null : (enemy.kind === 'bruiser' ? 8 : enemy.kind === 'shocker' ? 16 : 0) + (enemy.facing > 0 ? 0 : 4) + (enemy.attackTimer > 0 ? 3 : enemy.moving ? 1 + (Math.floor(enemy.phase * 7) % 2) : 0) })),
      boss: boss ? { hp: boss.hp, maxHp: boss.maxHp } : null,
      bossDefeated: this.bossDefeated, defeatedCount: this.defeatedCount, friendlyFire: false, assets,
      finishReady: (this.status === 'victory' || this.status === 'defeat') && this.finishTimer > 1.2,
    };
  }

  getStatus(): BrawlerStatus { return this.status; }
  getScore(): number { return this.score; }
  getDefeatedCount(): number { return this.defeatedCount; }
  getMaxCombo(): number { return this.maxCombo; }
}
