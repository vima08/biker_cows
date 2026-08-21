/**
 * Typed facade over the DOM events used to decouple gameplay from Web Audio.
 * Gameplay modules publish intent; the application shell decides how it sounds.
 */
export class GameEvents {
  constructor(private readonly target: Window = window) {}

  sound(name: string, volume = 1, pitch = 1): void {
    this.target.dispatchEvent(new CustomEvent('venus:sfx', { detail: { name, volume, pitch } }));
  }

  music(cue: string, intensity = 1): void {
    this.target.dispatchEvent(new CustomEvent('venus:music', { detail: { cue, intensity } }));
  }
}

export const gameEvents = new GameEvents();
