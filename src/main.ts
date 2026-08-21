import './styles.css';
import { VenusGame } from './game';
import { AudioSystem } from './audio';
import { AudioEventBridge } from './core/AudioEventBridge';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Game canvas was not found');

const audio = new AudioSystem({ masterVolume: .78, musicVolume: .52, sfxVolume: .82 });
const audioBridge = new AudioEventBridge(audio);
audioBridge.bind(document);
window.addEventListener('pagehide', () => { void audioBridge.destroy(); }, { once: true });

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
