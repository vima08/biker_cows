import { InputController } from '../core/InputController';
import { ARCHIVE } from './content';
import { archivePortrait } from './ArchivePortrait';
import './extras.css';
import { WorldMapView } from './WorldMapView';

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
export function article(body: string) {
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
  private worldMap?: WorldMapView;
  private previousFocus: HTMLElement | null = null;

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
  close() { this.worldMap?.setFullscreen(false); this.root.hidden = true; this.canvas.removeAttribute('aria-hidden'); (this.previousFocus ?? this.canvas).focus(); }

  update(input: InputController, dt: number) {
    if (this.worldMap?.expanded && input.tap('Escape','P1PadJump')) { this.worldMap.setFullscreen(false); return; }
    if (input.tap('Escape','P1PadJump')) { this.onClose(); return; }
    if (this.worldMap?.update(input, dt)) return;
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
    this.worldMap?.destroy(); this.worldMap = undefined;
    const focusArea = this.tabs.contains(document.activeElement) ? 'tabs' : this.list.contains(document.activeElement) ? 'list' : null;
    const section = ARCHIVE[this.section]; const entry = section.entries[this.entry];
    this.reader.classList.toggle('extras-reader-map', this.section === 3);
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
    else { if (entry.portrait) this.reader.append(archivePortrait(entry)); this.reader.append(article(entry.body)); }
    if (focusArea === 'tabs') this.tabs.querySelector<HTMLButtonElement>('.active')?.focus();
    if (focusArea === 'list') this.list.querySelector<HTMLButtonElement>('.active')?.focus();
  }

  private map() {
    this.worldMap = new WorldMapView();
    this.reader.append(element('p', 'extras-map-caption', 'Маршрут: Magma Mauler → Road King → The Forge Overseer → Sulfur Dreadnought.'), this.worldMap.root);
  }
}
