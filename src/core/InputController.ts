/**
 * Collects keyboard, pointer and gamepad input into one frame-based API.
 * `down` represents held input, while `tap` is cleared after every game frame.
 */
export class InputController {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly padPrevious: boolean[][] = [[], []];

  constructor(canvas: HTMLCanvasElement) {
    const blockedKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    addEventListener('keydown', (event) => {
      if (blockedKeys.has(event.code)) event.preventDefault();
      if (!this.held.has(event.code)) this.pressed.add(event.code);
      this.held.add(event.code);
    });
    addEventListener('keyup', (event) => this.held.delete(event.code));
    addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('pointerdown', () => {
      canvas.focus();
      this.pressed.add('Enter');
    });
    canvas.tabIndex = 0;
  }

  pollGamepads(): void {
    const pads = navigator.getGamepads?.() ?? [];
    for (let player = 0; player < 2; player++) {
      const pad = pads[player];
      if (!pad) continue;

      const prefix = `P${player + 1}Pad`;
      const buttons = pad.buttons.map(button => button.pressed);
      const previous = this.padPrevious[player];
      const mapping: Array<[number, string]> = [
        [0, `${prefix}Fire`], [1, `${prefix}Jump`], [2, `${prefix}Special`],
        [9, `${prefix}Start`], [8, 'Escape'], [12, `${prefix}Up`],
        [13, `${prefix}Down`], [14, `${prefix}Left`], [15, `${prefix}Right`],
      ];

      for (const [index, key] of mapping) {
        this.setAxis(key, buttons[index] ?? false);
        if (buttons[index] && !previous[index]) this.pressed.add(key);
      }

      const [axisX = 0, axisY = 0] = pad.axes;
      this.setAxis(`${prefix}Left`, axisX < -.28);
      this.setAxis(`${prefix}Right`, axisX > .28);
      this.setAxis(`${prefix}Up`, axisY < -.28);
      this.setAxis(`${prefix}Down`, axisY > .28);
      this.padPrevious[player] = buttons;
    }
  }

  down(...codes: string[]): boolean {
    return codes.some(code => this.held.has(code));
  }

  tap(...codes: string[]): boolean {
    return codes.some(code => this.pressed.has(code));
  }

  endFrame(): void {
    this.pressed.clear();
  }

  private setAxis(key: string, active: boolean): void {
    if (active) this.held.add(key);
    else this.held.delete(key);
  }
}
