import { assetUrl } from '../assetUrl';
import { InputController } from '../core/InputController';
import { prepareRiderAtlas } from '../roadRash/riderAtlas';
import { ARCHIVE, type ArchiveEntry } from './content';
import './extras.css';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
}
function button(text: string, action: () => void, className = '') {
  const node = element('button', className, text); node.type = 'button'; node.onclick = action; return node;
}
// Documentation is bundled at build time. Render as DOM text, never as trusted HTML.
function inline(target: HTMLElement, text: string) {
  const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1');
  clean.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (part.startsWith('**')) target.append(element('strong', '', part.slice(2, -2)));
    else target.append(document.createTextNode(part));
  });
}
function article(body: string) {
  const node = element('div', 'extras-prose');
  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    if (!block.trim()) continue;
    if (block.startsWith('|')) {
      const wrap = element('div', 'extras-table'); const table = element('table');
      block.split('\n').filter(line => !/^\|[\s:|\-]+\|\s*$/.test(line)).forEach((line, i) => {
        const row = element('tr');
        line.trim().replace(/^\||\|$/g, '').split('|').forEach(cell => {
          const td = element(i === 0 ? 'th' : 'td'); inline(td, cell.trim()); row.append(td);
        }); table.append(row);
      }); wrap.append(table); node.append(wrap);
    } else if (/^[-\d]/.test(block) && /^(?:- |\d+\. )/m.test(block)) {
      const list = element(/^\d/.test(block) ? 'ol' : 'ul');
      block.split('\n').forEach(line => { const item = element('li'); inline(item, line.replace(/^(?:- |\d+\. )/, '')); list.append(item); });
      node.append(list);
    } else {
      const heading = block.match(/^### (.+)\n?([\s\S]*)/);
      if (heading) { node.append(element('h3', '', heading[1])); if (heading[2]) { const p = element('p'); inline(p, heading[2]); node.append(p); } }
      else { const p = element('p'); inline(p, block); node.append(p); }
    }
  }
  return node;
}

export class ExtrasView {
  private readonly root = element('section', 'extras');
  private readonly tabs = element('nav', 'extras-tabs');
  private readonly list = element('nav', 'extras-list');
  private readonly reader = element('article', 'extras-reader');
  private section = 0;
  private entry = 0;
  private zoom = 1;
  private previousFocus: HTMLElement | null = null;
  private readonly images = new Map<string, Promise<HTMLImageElement>>();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onClose: () => void) {
    this.root.hidden = true;
    this.root.lang = 'ru'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'extras-title');
    const header = element('header', 'extras-header');
    const title = element('div'); title.append(element('span', 'extras-kicker', 'NEON STAMPEDE / АРХИВ ВЕНЕРЫ'));
    const h = element('h1', '', 'EXTRAS'); h.id = 'extras-title'; title.append(h);
    header.append(title, button('← В меню · Esc', () => this.onClose(), 'extras-back'));
    this.tabs.setAttribute('aria-label', 'Разделы архива'); this.list.setAttribute('aria-label', 'Статьи');
    this.reader.tabIndex = 0; this.reader.setAttribute('aria-label', 'Содержание статьи');
    const layout = element('div', 'extras-layout'); layout.append(this.list, this.reader);
    this.root.append(header, this.tabs, layout, element('footer', 'extras-footer', '← → разделы · ↑ ↓ статьи · Tab выбор · PgUp / PgDn прокрутка · Esc назад'));
    this.root.addEventListener('keydown', event => {
      if (event.key === 'End' || event.key === 'Home') {
        event.preventDefault(); event.stopPropagation();
        this.reader.scrollTop = event.key === 'End' ? this.reader.scrollHeight : 0;
      }
      if (event.key === 'Tab') {
        const controls = [...this.root.querySelectorAll<HTMLElement>('button, a, [tabindex="0"]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    document.body.append(this.root);
  }

  open() { this.previousFocus = document.activeElement as HTMLElement; this.root.hidden = false; this.canvas.setAttribute('aria-hidden', 'true'); this.render(); this.root.querySelector('button')?.focus(); }
  close() { this.root.hidden = true; this.canvas.removeAttribute('aria-hidden'); (this.previousFocus ?? this.canvas).focus(); }

  update(input: InputController, dt: number) {
    if (input.tap('Escape','P1PadJump')) { this.onClose(); return; }
    if (input.tap('ArrowLeft','KeyA','P1PadLeft')) this.chooseSection(-1);
    else if (input.tap('ArrowRight','KeyD','P1PadRight')) this.chooseSection(1);
    else if (input.tap('ArrowUp','KeyW','P1PadUp')) this.chooseEntry(-1);
    else if (input.tap('ArrowDown','KeyS','P1PadDown')) this.chooseEntry(1);
    if (input.down('PageDown','P1PadSpecial')) this.reader.scrollTop += 340 * dt;
    if (input.down('PageUp')) this.reader.scrollTop -= 340 * dt;
    if (input.tap('Home')) this.reader.scrollTop = 0;
    if (input.tap('End')) this.reader.scrollTop = this.reader.scrollHeight;
  }

  private chooseSection(delta: number) { this.section = (this.section + delta + ARCHIVE.length) % ARCHIVE.length; this.entry = 0; this.render(); }
  private chooseEntry(delta: number) { const length = ARCHIVE[this.section].entries.length; this.entry = (this.entry + delta + length) % length; this.render(); }

  private render() {
    const focusArea = this.tabs.contains(document.activeElement) ? 'tabs' : this.list.contains(document.activeElement) ? 'list' : null;
    const section = ARCHIVE[this.section]; const entry = section.entries[this.entry];
    this.tabs.replaceChildren(...ARCHIVE.map((item, i) => {
      const node = button(item.label, () => { this.section = i; this.entry = 0; this.render(); }, i === this.section ? 'active' : '');
      node.setAttribute('aria-pressed', String(i === this.section)); return node;
    }));
    this.list.replaceChildren(...section.entries.map((item, i) => {
      const node = button(item.title.replace(/ — `[^`]+`$/, ''), () => { this.entry = i; this.render(); }, i === this.entry ? 'active' : '');
      if (i === this.entry) node.setAttribute('aria-current', 'true'); return node;
    }));
    this.reader.replaceChildren(element('div', 'extras-kicker', `${section.label} / ${String(this.entry + 1).padStart(2, '0')}`),
      element('h2', '', entry.title.replace(/`/g, '')));
    this.reader.scrollTop = 0;
    if (this.section === 3) this.map();
    else { if (entry.portrait) this.portrait(entry); this.reader.append(article(entry.body)); }
    if (focusArea === 'tabs') this.tabs.querySelector<HTMLButtonElement>('.active')?.focus();
    if (focusArea === 'list') this.list.querySelector<HTMLButtonElement>('.active')?.focus();
  }

  private load(path: string) {
    if (!this.images.has(path)) this.images.set(path, new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => { this.images.delete(path); reject(new Error('Image unavailable')); }; image.src = assetUrl(path);
    }));
    return this.images.get(path)!;
  }

  private portrait(entry: ArchiveEntry) {
    const spec = entry.portrait!;
    const figure = element('figure', 'extras-portrait');
    const portrait = element('canvas'); portrait.width = 600; portrait.height = 420;
    portrait.setAttribute('role', 'img'); portrait.setAttribute('aria-label', entry.title);
    const status = element('figcaption', '', 'Загрузка портрета…'); figure.append(portrait, status); this.reader.append(figure);
    void this.load(spec.path).then(image => {
      const context = portrait.getContext('2d')!;
      let source: CanvasImageSource = image;
      let sx = spec.frame % spec.columns * image.naturalWidth / spec.columns;
      let sy = Math.floor(spec.frame / spec.columns) * image.naturalHeight / spec.rows;
      let sw = image.naturalWidth / spec.columns, sh = image.naturalHeight / spec.rows;
      if (spec.isolated) { const frame = prepareRiderAtlas(image).frames[spec.frame]?.[0]; if (!frame) throw new Error('Portrait unavailable'); source = frame; sx = sy = 0; sw = frame.width; sh = frame.height; }
      const scale = Math.min(600 / sw, 420 / sh);
      context.drawImage(source, sx, sy, sw, sh, (600 - sw * scale) / 2, (420 - sh * scale) / 2, sw * scale, sh * scale);
      status.textContent = entry.title.split(' — ')[0];
    }).catch(() => { status.textContent = 'Портрет не загрузился'; figure.append(button('Повторить', () => this.render())); });
  }

  private map() {
    const toolbar = element('div', 'extras-map-tools'); const label = element('span');
    const viewport = element('div', 'extras-map-viewport'); viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Карта мира, прокрутка после увеличения');
    const image = element('img'); image.alt = 'Карта региона Venus City: Venus Boardwalk, Venus Highway, Sulfur Run, Furnace District и четыре босса кампании';
    image.src = assetUrl('assets/world/venus-world-map-v1.png');
    const resize = () => { label.textContent = `${Math.round(this.zoom * 100)}%`; image.style.width = `${this.zoom * 100}%`; };
    toolbar.append(button('−', () => { this.zoom = Math.max(1, this.zoom - .5); resize(); }), label,
      button('+', () => { this.zoom = Math.min(4, this.zoom + .5); resize(); }), button('Вписать', () => { this.zoom = 1; resize(); }));
    toolbar.querySelectorAll('button')[0].setAttribute('aria-label', 'Уменьшить карту');
    toolbar.querySelectorAll('button')[1].setAttribute('aria-label', 'Увеличить карту');
    const status = element('p', 'extras-image-status', 'Загрузка карты…');
    image.onload = () => { status.hidden = true; };
    image.onerror = () => { status.textContent = 'Не удалось загрузить карту. '; status.append(button('Повторить', () => { image.src = assetUrl('assets/world/venus-world-map-v1.png'); })); };
    viewport.append(image); resize();
    this.reader.append(element('p', 'extras-map-caption', 'Маршрут: Magma Mauler → Road King → The Forge Overseer → Sulfur Dreadnought. Увеличьте карту, чтобы рассмотреть улицы Furnace District.'), toolbar, status, viewport);
  }
}
