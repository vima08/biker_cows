import type { GameMode } from '../rider/types';
import type { InputController } from './InputController';

type SensorConstructor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

export class TabletControls {
  private readonly root = document.createElement('div');
  private readonly rotate = document.createElement('div');
  private readonly pointers = new Map<number, HTMLButtonElement>();
  private readonly touchMedia = matchMedia('(any-pointer: coarse)');
  private mode: GameMode | null = null;
  private tiltEnabled = false;
  private tiltPending = false;
  private tiltValue = 0;
  private neutral: number | null = null;
  private sensorAt = 0;
  private sensorStarted = 0;
  private tiltStatus = '';
  private tiltButton?: HTMLButtonElement;
  private status?: HTMLElement;
  private stick?: HTMLElement;
  private stickPointer: number | null = null;
  private stickValue = { x: 0, y: 0 };

  get movement(): { x: number; y: number } | undefined {
    return this.stickPointer !== null && !this.blocked ? this.stickValue : undefined;
  }

  constructor(private readonly input: InputController, canvas: HTMLCanvasElement) {
    this.root.className = 'tablet-controls';
    this.root.setAttribute('aria-label', 'Touch controls');
    this.rotate.className = 'tablet-rotate';
    this.rotate.innerHTML = '<span aria-hidden="true">↻</span><strong>Поверните планшет</strong><p>Игра работает в альбомной ориентации</p>';
    this.rotate.setAttribute('role', 'status');
    canvas.parentElement!.append(this.root);
    document.body.append(this.rotate);
    this.root.addEventListener('contextmenu', event => event.preventDefault());
    addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    addEventListener('resize', () => this.reset());
    screen.orientation?.addEventListener('change', () => this.reset());
    addEventListener('deviceorientation', event => this.readTilt(event));
  }

  get blocked(): boolean {
    return this.available && innerHeight > innerWidth;
  }

  private get available(): boolean {
    return navigator.maxTouchPoints > 0 || this.touchMedia.matches;
  }

  sync(mode: GameMode): void {
    this.root.hidden = !this.available || mode === 'extras' || this.blocked;
    this.rotate.hidden = !this.blocked;
    if (this.mode !== mode) {
      this.reset();
      this.mode = mode;
      this.render();
    }
    if (this.tiltEnabled && performance.now() - this.sensorStarted > 3000 && !this.sensorAt) {
      this.tiltEnabled = false;
      this.tiltStatus = 'Нет данных датчика — используйте стик';
      this.updateTiltLabel();
    }
  }

  /** Sensor input is analog; buttons/keyboard can still override it. */
  get steering(): number | undefined {
    if (this.movement) return this.movement.x;
    return this.tiltEnabled && this.mode === 'road-rash' && !this.blocked && !document.hidden
      && performance.now() - this.sensorAt < 700 && this.neutral !== null ? this.tiltValue : undefined;
  }

  private reset(): void {
    for (const [id, button] of this.pointers) {
      this.input.setVirtual(`touch-${id}`, []);
      button.classList.remove('is-held');
    }
    this.pointers.clear();
    this.releaseStick();
    this.neutral = null;
    this.tiltValue = 0;
  }

  private releaseStick(): void {
    const pointer = this.stickPointer;
    this.stickPointer = null;
    this.stickValue = { x: 0, y: 0 };
    this.input.setVirtual('touch-stick-menu', []);
    this.stick?.classList.remove('is-held');
    this.stick?.style.setProperty('--stick-x', '0px');
    this.stick?.style.setProperty('--stick-y', '0px');
    if (pointer !== null && this.stick?.hasPointerCapture(pointer)) this.stick.releasePointerCapture(pointer);
  }

  private joystick(combat: boolean): HTMLElement {
    const stick = document.createElement('div');
    stick.className = 'tablet-stick';
    stick.setAttribute('role', 'group');
    stick.setAttribute('aria-label', 'Джойстик движения');
    const thumb = document.createElement('span');
    thumb.className = 'tablet-stick-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    stick.append(thumb);
    this.stick = stick;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.stickPointer) return;
      event.preventDefault();
      const bounds = stick.getBoundingClientRect();
      const radius = bounds.width * .32;
      const dx = event.clientX - bounds.left - bounds.width / 2;
      const dy = event.clientY - bounds.top - bounds.height / 2;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(radius, distance);
      const magnitude = Math.max(0, (travel / radius - .12) / .88);
      this.stickValue = { x: distance ? dx / distance * magnitude : 0, y: distance ? dy / distance * magnitude : 0 };
      stick.style.setProperty('--stick-x', `${distance ? dx / distance * travel : 0}px`);
      stick.style.setProperty('--stick-y', `${distance ? dy / distance * travel : 0}px`);
      if (!combat) {
        const { x, y } = this.stickValue;
        this.input.setVirtual('touch-stick-menu', Math.max(Math.abs(x), Math.abs(y)) < .35 ? []
          : Math.abs(x) >= Math.abs(y) ? [x > 0 ? 'KeyD' : 'KeyA'] : [y > 0 ? 'ArrowDown' : 'ArrowUp']);
      }
    };
    stick.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (event.button !== 0 || this.stickPointer !== null) return;
      this.stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      stick.classList.add('is-held');
      move(event);
    });
    stick.addEventListener('pointermove', move);
    const release = (event: PointerEvent) => { if (event.pointerId === this.stickPointer) this.releaseStick(); };
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
    stick.addEventListener('lostpointercapture', release);
    return stick;
  }

  private button(label: string, keys?: string[], action?: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (keys) button.dataset.keys = keys.join(' ');
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (event.button !== 0) return;
      button.setPointerCapture(event.pointerId);
      if (keys) {
        this.pointers.set(event.pointerId, button);
        this.input.setVirtual(`touch-${event.pointerId}`, keys);
        button.classList.add('is-held');
      }
    });
    const release = (event: PointerEvent) => {
      this.input.setVirtual(`touch-${event.pointerId}`, []);
      this.pointers.delete(event.pointerId);
      if (![...this.pointers.values()].includes(button)) button.classList.remove('is-held');
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    if (action) button.addEventListener('click', action);
    return button;
  }

  private render(): void {
    this.root.replaceChildren();
    this.tiltButton = undefined;
    this.status = undefined;
    const mode = this.mode;
    const combat = mode === 'playing' || mode === 'brawler' || mode === 'road-rash';
    this.root.dataset.mode = mode ?? '';
    const toolbar = document.createElement('div');
    toolbar.className = 'tablet-toolbar';
    toolbar.append(this.button('⛶ Экран', undefined, () => { void this.fullscreen(); }));
    if (combat) toolbar.append(this.button('Ⅱ Пауза', ['KeyP']));
    if (mode === 'road-rash') {
      this.tiltButton = this.button('', undefined, () => { void this.toggleTilt(); });
      toolbar.append(this.tiltButton, this.button('Центр руля', undefined, () => { this.neutral = null; this.tiltValue = 0; }));
      this.status = document.createElement('span');
      this.status.className = 'tablet-sensor-status';
      this.status.setAttribute('role', 'status');
      toolbar.append(this.status);
      this.updateTiltLabel();
    }
    const directions = document.createElement('div');
    directions.className = 'tablet-movement';
    if (combat && mode !== 'road-rash') directions.append(this.button('Прыжок', ['KeyX']));
    directions.append(this.joystick(combat));
    const actions = document.createElement('div');
    actions.className = 'tablet-actions';
    if (combat) {
      if (mode !== 'road-rash') actions.append(this.button('Спец', ['KeyC']));
      else actions.append(this.button('Тормоз', ['KeyS']), this.button('Газ', ['KeyW']));
      actions.append(this.button(mode === 'playing' ? 'Огонь' : 'Удар', ['KeyZ']));
    } else if (mode === 'paused') {
      actions.append(this.button('Заново', ['KeyR']), this.button('Продолжить', ['KeyP']));
    } else {
      actions.append(this.button('Назад', ['Escape']), this.button('Далее', ['Enter']));
    }
    this.root.append(toolbar, directions, actions);
  }

  private updateTiltLabel(): void {
    if (this.tiltButton) {
      this.tiltButton.textContent = this.tiltPending ? 'Доступ…' : this.tiltEnabled ? 'Наклоны: вкл' : 'Включить наклоны';
      this.tiltButton.setAttribute('aria-pressed', String(this.tiltEnabled));
      this.tiltButton.disabled = this.tiltPending;
    }
    if (this.status) this.status.textContent = this.tiltStatus;
  }

  private async toggleTilt(): Promise<void> {
    if (this.tiltPending) return;
    if (this.tiltEnabled) {
      this.tiltEnabled = false;
      this.tiltStatus = '';
    } else {
      this.tiltPending = true;
      this.updateTiltLabel();
      try {
        const sensor = window.DeviceOrientationEvent as SensorConstructor | undefined;
        if (!isSecureContext || !sensor) throw new Error('unavailable');
        if (sensor.requestPermission && await sensor.requestPermission() !== 'granted') throw new Error('denied');
        this.tiltEnabled = true;
        this.neutral = null;
        this.sensorAt = 0;
        this.sensorStarted = performance.now();
        this.tiltStatus = 'Держите удобно • наклоняйте влево / вправо';
      } catch {
        this.tiltStatus = 'Наклоны недоступны — используйте стик';
      } finally {
        this.tiltPending = false;
      }
    }
    this.updateTiltLabel();
  }

  private readTilt(event: DeviceOrientationEvent): void {
    if (!this.tiltEnabled || this.mode !== 'road-rash' || this.blocked || document.hidden
      || event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const rad = Math.PI / 180;
    const angle = (screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0) * rad;
    const horizontal = Math.sin(event.gamma * rad) * Math.cos(event.beta * rad) * Math.cos(angle)
      + Math.sin(event.beta * rad) * Math.sin(angle);
    const roll = Math.asin(Math.max(-1, Math.min(1, horizontal))) / rad;
    this.neutral ??= roll;
    const delta = roll - this.neutral;
    const target = Math.sign(delta) * Math.min(1, Math.max(0, Math.abs(delta) - 3) / 22);
    this.tiltValue += (target - this.tiltValue) * .3;
    this.sensorAt = performance.now();
  }

  private async fullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
      await orientation?.lock?.('landscape');
    } catch { /* Portrait guard remains available when the browser cannot lock. */ }
  }
}
