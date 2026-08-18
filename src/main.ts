import './styles.css';
import { VenusGame } from './game';
import { AudioSystem, type MusicMode, type SoundEffectName } from './audio';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Game canvas was not found');

type SfxEventDetail = { name?: string; volume?: number; pitch?: number };
type MusicEventDetail = { cue?: string; intensity?: number };

const audio = new AudioSystem({ masterVolume: .78, musicVolume: .52, sfxVolume: .82 });
audio.bindUnlock(document);

const sfxMap: Record<string, SoundEffectName> = {
  menu_move: 'ui', menu_accept: 'ui', menu_back: 'ui', pause: 'ui',
  engine_start: 'jump', shoot: 'shoot', laser: 'shoot', rocket: 'explosion',
  jump: 'jump', land: 'hit', special: 'boss', enemy_shoot: 'shoot',
  boss_cannon: 'explosion', warning: 'boss', player_hit: 'hurt',
  explode: 'explosion', boss_explode: 'explosion', pickup: 'pickup',
  stage_clear: 'victory', game_over: 'defeat',
};

let lastTerminalCue = '';
let lastTerminalCueAt = -Infinity;
const playTerminalCue = (name: 'victory' | 'defeat'): void => {
  const now = performance.now();
  if (lastTerminalCue === name && now - lastTerminalCueAt < 6000) return;
  lastTerminalCue = name;
  lastTerminalCueAt = now;
  audio.stop();
  audio.sfx(name, 1);
};

window.addEventListener('venus:sfx', ((event: CustomEvent<SfxEventDetail>) => {
  const name = event.detail?.name;
  if (!name) return;
  const mapped = sfxMap[name];
  if (!mapped) return;
  if (mapped === 'victory' || mapped === 'defeat') playTerminalCue(mapped);
  else audio.sfx(mapped, Math.max(.12, event.detail.volume ?? 1));
}) as EventListener);

window.addEventListener('venus:music', ((event: CustomEvent<MusicEventDetail>) => {
  const cue = event.detail?.cue ?? 'stage';
  const intensity = Math.max(.2, Math.min(1, event.detail?.intensity ?? 1));
  if (cue === 'pause') {
    void audio.pause();
    return;
  }
  if (cue === 'victory' || cue === 'defeat') {
    playTerminalCue(cue);
    return;
  }
  const mode: MusicMode = cue === 'boss' || cue === 'miniboss' ? 'boss' : 'ride';
  void audio.resume();
  audio.setMusicMode(mode);
  audio.start(mode);
  audio.setIntensity(cue === 'title' ? .36 : cue === 'select' ? .5 : intensity);
}) as EventListener);

window.addEventListener('pagehide', () => { void audio.destroy(); }, { once: true });

const game = new VenusGame(canvas);
game.start();

declare global {
  interface Window {
    venusGame: VenusGame;
    __BCFV_DEBUG__: {
      readonly state: ReturnType<VenusGame['snapshot']>;
      snapshot: () => ReturnType<VenusGame['snapshot']>;
      gotoScene: (scene: string, time?: number) => ReturnType<VenusGame['snapshot']>;
      setDebugFireHeld: (held: boolean) => ReturnType<VenusGame['snapshot']>;
      setCoop: (enabled: boolean) => ReturnType<VenusGame['snapshot']>;
      setPlayerInput: (id: 1|2, state: Parameters<VenusGame['setDebugPlayerInput']>[1]) => ReturnType<VenusGame['snapshot']>;
      friendlyFireProbe: () => ReturnType<VenusGame['debugFriendlyFireProbe']>;
      damagePlayer: (id: 1|2, amount: number) => ReturnType<VenusGame['debugDamagePlayer']>;
    };
  }
}
window.venusGame = game;
window.__BCFV_DEBUG__ = {
  get state() { return game.snapshot(); },
  snapshot: () => game.snapshot(),
  gotoScene: (scene: string, time = 0) => game.gotoScene(scene, time),
  setDebugFireHeld: (held: boolean) => game.setDebugFireHeld(held),
  setCoop: (enabled: boolean) => game.setCoop(enabled),
  setPlayerInput: (id: 1|2, state: Parameters<VenusGame['setDebugPlayerInput']>[1]) => game.setDebugPlayerInput(id,state),
  friendlyFireProbe: () => game.debugFriendlyFireProbe(),
  damagePlayer: (id: 1|2, amount: number) => game.debugDamagePlayer(id,amount),
};
