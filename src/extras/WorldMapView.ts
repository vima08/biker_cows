import { assetUrl } from '../assetUrl';
import type { InputController } from '../core/InputController';

export interface MapLocation { x: number; y: number; label: string }
export class WorldMapView {
  readonly root = document.createElement('section');
  private readonly viewport = document.createElement('div');
  private readonly layer = document.createElement('div');
  private readonly image = new Image();
  private readonly marker = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly status = document.createElement('p');
  private readonly expand: HTMLButtonElement;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private observer: ResizeObserver;
  private zoom = 1;
  private x = 0;
  private y = 0;
  private width = 1;
  private height = 1;
  private fullscreen = false;

  constructor(location?: MapLocation) {
    this.root.className = 'world-map';
    const tools = document.createElement('div'); tools.className = 'extras-map-tools';
    const button = (text: string, action: () => void, label = text) => {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = text;
      node.setAttribute('aria-label', label); node.onclick = action; return node;
    };
    this.expand = button('На весь экран', () => this.setFullscreen(!this.fullscreen));
    tools.append(button('−', () => this.scale(this.zoom - .5), 'Уменьшить карту'), this.label,
      button('+', () => this.scale(this.zoom + .5), 'Увеличить карту'),
      button('Вписать', () => { this.zoom = 1; this.x = this.y = 0; this.layout(); }), this.expand);
    const pan = document.createElement('div'); pan.className = 'world-map-pan';
    for (const [text, dx, dy, name] of [['←', 100, 0, 'Карта влево'], ['↑', 0, 100, 'Карта вверх'], ['↓', 0, -100, 'Карта вниз'], ['→', -100, 0, 'Карта вправо']] as const)
      pan.append(button(text, () => { this.x += dx; this.y += dy; this.layout(); }, name));
    tools.append(pan);
    this.viewport.className = 'extras-map-viewport'; this.viewport.tabIndex = 0;
    this.viewport.setAttribute('aria-label', 'Карта: стрелки для перемещения, плюс и минус для масштаба');
    this.layer.className = 'world-map-layer';
    this.image.alt = 'Карта Venus City и маршрута кампании'; this.image.draggable = false;
    this.image.onload = () => { this.status.hidden = true; this.layout(); };
    this.image.onerror = () => { this.status.hidden = false; this.status.textContent = 'Карта не загрузилась. '; this.status.append(button('Повторить', () => this.load())); };
    this.status.className = 'extras-image-status'; this.status.textContent = 'Загрузка карты…';
    this.marker.className = 'world-map-marker'; this.marker.hidden = !location;
    this.layer.append(this.image, this.marker); this.viewport.append(this.layer);
    this.root.append(tools, this.status, this.viewport,
      Object.assign(document.createElement('p'), { className: 'world-map-help', textContent: 'Стрелки / WASD — перемещение · + / − — масштаб · перетаскивание и щипок · Esc — свернуть' }));
    if (location) this.setLocation(location);
    this.viewport.addEventListener('wheel', event => {
      event.preventDefault(); const bounds = this.viewport.getBoundingClientRect();
      this.scale(this.zoom * Math.exp(-event.deltaY * .0015), event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
    }, { passive: false });
    this.root.addEventListener('keydown', event => {
      if (!this.fullscreen || event.key !== 'Tab') return;
      const controls = [...this.root.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); event.stopPropagation(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); event.stopPropagation(); first?.focus(); }
    });
    this.viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); this.viewport.focus(); this.viewport.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    this.viewport.addEventListener('pointermove', event => {
      const previous = this.pointers.get(event.pointerId); if (!previous) return;
      const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        const newDistance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (oldDistance > 2) {
          const bounds = this.viewport.getBoundingClientRect();
          this.scale(this.zoom * newDistance / oldDistance,
            (previous.x + other.x) / 2 - bounds.left - bounds.width / 2,
            (previous.y + other.y) / 2 - bounds.top - bounds.height / 2);
        }
        this.x += (event.clientX - previous.x) / 2; this.y += (event.clientY - previous.y) / 2;
      } else { this.x += event.clientX - previous.x; this.y += event.clientY - previous.y; }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this.layout();
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      this.viewport.addEventListener(name, event => this.pointers.delete(event.pointerId));
    this.observer = new ResizeObserver(() => this.layout()); this.observer.observe(this.viewport);
    this.load();
  }

  private load() { this.image.src = assetUrl('assets/world/venus-world-map-v1.png'); }
  setLocation(location: MapLocation) {
    this.marker.hidden = false; this.marker.style.left = `${location.x * 100}%`; this.marker.style.top = `${location.y * 100}%`;
    this.marker.textContent = 'Вы сейчас здесь'; this.marker.setAttribute('aria-label', `Вы сейчас здесь: ${location.label}`);
  }
  setFullscreen(value: boolean) {
    this.fullscreen = value; this.root.classList.toggle('is-fullscreen', value);
    this.expand.textContent = value ? 'Свернуть карту · Esc' : 'На весь экран';
    this.expand.setAttribute('aria-label', value ? 'Свернуть карту' : 'На весь экран');
    this.layout(); if (value) this.viewport.focus(); else this.expand.focus();
  }
  get expanded() { return this.fullscreen; }
  get focused() { return this.fullscreen || this.root.contains(document.activeElement); }
  update(input: InputController, dt: number): boolean {
    if (this.fullscreen && input.tap('Escape','P1PadJump')) { this.setFullscreen(false); return true; }
    if (!this.focused) return false;
    const speed = 450 * dt;
    this.x += ((input.down('ArrowLeft','KeyA','P1PadLeft') ? 1 : 0) - (input.down('ArrowRight','KeyD','P1PadRight') ? 1 : 0)) * speed;
    this.y += ((input.down('ArrowUp','KeyW','P1PadUp') ? 1 : 0) - (input.down('ArrowDown','KeyS','P1PadDown') ? 1 : 0)) * speed;
    if (input.tap('Equal','NumpadAdd')) this.scale(this.zoom + .5);
    if (input.tap('Minus','NumpadSubtract')) this.scale(this.zoom - .5);
    this.layout(); return true;
  }
  private scale(value: number, anchorX = 0, anchorY = 0) {
    const next = Math.max(1, Math.min(5, value)), ratio = next / this.zoom;
    this.x = anchorX - (anchorX - this.x) * ratio; this.y = anchorY - (anchorY - this.y) * ratio;
    this.zoom = next; this.layout();
  }
  private layout() {
    const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
    if (!vw || !vh) return;
    const ratio = (this.image.naturalWidth || 1536) / (this.image.naturalHeight || 1024);
    this.width = Math.min(vw, vh * ratio); this.height = this.width / ratio;
    const maxX = Math.max(0, (this.width * this.zoom - vw) / 2), maxY = Math.max(0, (this.height * this.zoom - vh) / 2);
    this.x = Math.max(-maxX, Math.min(maxX, this.x)); this.y = Math.max(-maxY, Math.min(maxY, this.y));
    this.layer.style.width = `${this.width}px`; this.layer.style.height = `${this.height}px`;
    this.layer.style.transform = `translate(-50%, -50%) translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
    this.marker.style.setProperty('--marker-scale', String(1 / this.zoom));
    this.label.textContent = `${Math.round(this.zoom * 100)}%`;
    this.root.dataset.zoom = String(this.zoom); this.root.dataset.panX = String(this.x); this.root.dataset.panY = String(this.y);
  }
  destroy() { this.observer.disconnect(); this.pointers.clear(); this.root.remove(); }
}
