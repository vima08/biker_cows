import type { InputController } from '../core/InputController';
import { ARCHIVE } from './content';
import { archivePortrait } from './ArchivePortrait';
import { article } from './ExtrasView';
import { MISSIONS, missionLocation } from './missionContent';
import { WorldMapView } from './WorldMapView';
import './mission.css';

function node(tag: string, className: string, text = '') {
  const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
}
export class MissionJournal {
  private readonly root = node('section', 'extras mission-journal');
  private readonly card = node('div', 'mission-card');
  private readonly read = new Set<number>();
  private readonly briefed = new Set<number>();
  private readonly defeated = new Set<number>();
  private map?: WorldMapView;
  private segment = 0;
  private progress = 0;
  private hero = 0;
  private kind = '';
  private resume?: () => void;
  private previousFocus: HTMLElement | null = null;
  private readyAt = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly resetControls: () => void) {
    this.root.hidden = true; this.root.lang = 'ru'; this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true'); this.root.setAttribute('aria-labelledby', 'mission-heading');
    this.root.append(this.card); document.body.append(this.root);
    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...this.root.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
      const first = controls[0], last = controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }
  get active() { return !this.root.hidden; }
  get snapshot() { return { open: this.active, view: this.kind, segment: this.segment, briefed: [...this.briefed], defeated: [...this.defeated], read: [...this.read] }; }
  reset() { if (this.active) this.close(); this.resume = undefined; this.dossierBack = undefined; this.briefed.clear(); this.defeated.clear(); this.read.clear(); }
  context(segment: number, progress: number, hero: number, automatic: boolean) {
    this.segment = segment; this.progress = progress; this.hero = hero;
    if (automatic && !this.active && !this.briefed.has(segment)) this.briefing();
  }
  private button(text: string, action: () => void) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.onclick = action; return button;
  }
  private show(kind: string, title: string, subtitle: string) {
    if (!this.active) this.previousFocus = document.activeElement as HTMLElement;
    this.resetControls(); this.map?.destroy(); this.map = undefined;
    this.root.hidden = false; this.kind = kind; this.root.dataset.view = kind;
    this.readyAt = performance.now() + 250;
    this.canvas.setAttribute('aria-hidden', 'true'); this.card.replaceChildren();
    const heading = node('h1', '', title); heading.id = 'mission-heading';
    this.card.append(node('div', 'extras-kicker', subtitle), heading);
  }
  private focus() { (this.card.querySelector<HTMLButtonElement>('.mission-actions button') ?? this.card.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true }); this.card.scrollTop = 0; }
  private close() {
    this.map?.destroy(); this.map = undefined; this.root.hidden = true; this.canvas.removeAttribute('aria-hidden');
    this.resetControls(); (this.previousFocus?.isConnected ? this.previousFocus : this.canvas)?.focus();
  }
  briefing() {
    this.briefed.add(this.segment);
    const mission = MISSIONS[this.segment];
    this.show('briefing', mission.title, `Брифинг ${this.segment + 1} / 4 · ${mission.subtitle}`);
    const body = node('div', 'mission-body'), text = node('div', 'mission-text');
    text.append(node('p', 'mission-objective', mission.objective), node('p', 'mission-copy', mission.briefing),
      node('blockquote', 'mission-radio', mission.radio), node('p', 'mission-hint', mission.hint));
    this.map = new WorldMapView(missionLocation(this.segment, this.progress)); body.append(text, this.map.root); this.card.append(body);
    const actions = node('div', 'mission-actions'); actions.append(
      this.button('Начать миссию', () => this.close()),
      this.button('О героине', () => this.dossier(0, this.hero, () => this.briefing())));
    this.card.append(actions); this.focus();
  }
  debrief(segment: number, next: () => void): boolean {
    if (this.defeated.has(segment)) return false;
    this.defeated.add(segment); this.segment = segment; this.progress = 1; this.resume = next;
    this.victory(); return true;
  }
  private victory() {
    const mission = MISSIONS[this.segment], boss = ARCHIVE[1].entries[this.segment];
    this.show('victory', 'Путь открыт', `Победа · ${boss.title.replace(/`/g, '')}`);
    this.card.append(node('p', 'mission-objective', mission.outcome));
    this.map = new WorldMapView(missionLocation(this.segment, 1)); this.card.append(this.map.root);
    const actions = node('div', 'mission-actions'); actions.append(
      this.button(this.segment === 3 ? 'К эпилогу' : 'Продолжить маршрут', () => this.continue()),
      this.button('Прочитать биографию босса', () => this.dossier(1, this.segment, () => this.victory())));
    this.card.append(actions); this.focus();
  }
  private continue() { const next = this.resume; this.resume = undefined; this.close(); next?.(); }
  private dossier(section: number, index: number, back: () => void) {
    const entry = ARCHIVE[section].entries[index];
    if (section === 1) this.read.add(index);
    this.show('dossier', entry.title.replace(/`/g, ''), section === 1 ? 'Архив Венеры · Досье противника' : 'Архив Венеры · Личное дело');
    const reader = node('article', 'mission-dossier'); reader.tabIndex = 0;
    if (entry.portrait) reader.append(archivePortrait(entry));
    reader.append(article(entry.body));
    this.card.append(reader, this.button('Назад', back)); this.dossierBack = back; this.focus();
  }
  private dossierBack?: () => void;
  openMap() {
    this.show('map', 'Маршрут команды', 'Карта Венеры · M / Esc — вернуться');
    this.card.append(node('p', 'mission-objective', `${MISSIONS[this.segment].title} · ${Math.round(this.progress * 100)}% маршрута`));
    this.map = new WorldMapView(missionLocation(this.segment, this.progress)); this.card.append(this.map.root);
    const actions = node('div', 'mission-actions'); actions.append(this.button('Вернуться в игру', () => this.close()),
      this.button('Задача миссии', () => this.briefing()));
    if (this.defeated.size) for (const index of this.defeated)
      actions.append(this.button(`Досье: ${ARCHIVE[1].entries[index].title.split(' — ')[0]}`, () => this.dossier(1, index, () => this.openMap())));
    this.card.append(actions); this.focus();
  }
  update(input: InputController, dt: number) {
    if (this.map?.expanded && input.tap('Escape','P1PadJump')) { this.map.setFullscreen(false); return; }
    this.map?.update(input, dt);
    if (performance.now() < this.readyAt) return;
    if (input.tap('Escape','KeyM','P1PadJump')) {
      if (this.kind === 'dossier') this.dossierBack?.();
      else if (this.kind === 'victory') this.continue();
      else this.close();
      return;
    }
    if (input.tap('P1PadFire') && document.activeElement instanceof HTMLButtonElement && this.root.contains(document.activeElement)) {
      document.activeElement.click(); return;
    }
    if (input.tap('P1PadStart') || input.tap('Enter') && !(document.activeElement instanceof HTMLButtonElement)) {
      if (this.kind === 'victory') this.continue(); else if (this.kind !== 'dossier') this.close();
    }
    if (this.kind === 'dossier') {
      const reader = this.card.querySelector('.mission-dossier');
      if (reader) reader.scrollTop += ((input.down('PageDown','ArrowDown','P1PadDown') ? 1 : 0) - (input.down('PageUp','ArrowUp','P1PadUp') ? 1 : 0)) * dt * 380;
    }
  }
}
