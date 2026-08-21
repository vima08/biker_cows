import { AudioSystem, type MusicMode, type SoundEffectName } from '../audio';

type SfxEventDetail = { name?: string; volume?: number; pitch?: number };
type MusicEventDetail = { cue?: string; intensity?: number };

const SOUND_EFFECTS: Record<string, SoundEffectName> = {
  menu_move: 'ui', menu_accept: 'ui', menu_back: 'ui', pause: 'ui',
  engine_start: 'jump', shoot: 'shoot', laser: 'shoot', rocket: 'explosion',
  melee_swing: 'melee', jump: 'jump', land: 'hit', special: 'boss',
  enemy_shoot: 'shoot', boss_cannon: 'explosion', warning: 'boss',
  player_hit: 'hurt', explode: 'explosion', boss_explode: 'explosion',
  pickup: 'pickup', stage_clear: 'victory', game_over: 'defeat',
};

/** Owns all DOM-to-Web-Audio wiring for the application shell. */
export class AudioEventBridge {
  private lastTerminalCue = '';
  private lastTerminalCueAt = -Infinity;

  constructor(
    private readonly audio: AudioSystem,
    private readonly eventTarget: Window = window,
  ) {}

  bind(unlockTarget: Document = document): void {
    this.audio.bindUnlock(unlockTarget);
    this.eventTarget.addEventListener('venus:sfx', this.handleSound as EventListener);
    this.eventTarget.addEventListener('venus:music', this.handleMusic as EventListener);
  }

  async destroy(): Promise<void> {
    this.eventTarget.removeEventListener('venus:sfx', this.handleSound as EventListener);
    this.eventTarget.removeEventListener('venus:music', this.handleMusic as EventListener);
    await this.audio.destroy();
  }

  private readonly handleSound = (event: CustomEvent<SfxEventDetail>): void => {
    const name = event.detail?.name;
    const mapped = name ? SOUND_EFFECTS[name] : undefined;
    if (!mapped) return;
    if (mapped === 'victory' || mapped === 'defeat') this.playTerminalCue(mapped);
    else this.audio.sfx(mapped, Math.max(.12, event.detail.volume ?? 1));
  };

  private readonly handleMusic = (event: CustomEvent<MusicEventDetail>): void => {
    const cue = event.detail?.cue ?? 'stage';
    const intensity = Math.max(.2, Math.min(1, event.detail?.intensity ?? 1));
    if (cue === 'pause') {
      void this.audio.pause();
      return;
    }
    if (cue === 'victory' || cue === 'defeat') {
      this.playTerminalCue(cue);
      return;
    }

    const mode: MusicMode = cue === 'boss' || cue === 'miniboss'
      ? 'boss'
      : cue === 'brawler' ? 'brawler' : 'ride';
    void this.audio.resume();
    this.audio.setMusicMode(mode);
    this.audio.start(mode);
    this.audio.setIntensity(cue === 'title' ? .36 : cue === 'select' ? .5 : intensity);
  };

  private playTerminalCue(name: 'victory' | 'defeat'): void {
    const now = performance.now();
    if (this.lastTerminalCue === name && now - this.lastTerminalCueAt < 6000) return;
    this.lastTerminalCue = name;
    this.lastTerminalCueAt = now;
    this.audio.stop();
    this.audio.sfx(name, 1);
  }
}
