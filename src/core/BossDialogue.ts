import type { HeroId } from '../rider/types';

export type DialogueBoss = 'mauler' | 'road-king' | 'overseer' | 'dreadnought';
type Line = { speaker: string; text: string; hero?: HeroId };
const DIALOGUES: Record<DialogueBoss, Line[]> = {
  mauler: [
    { speaker: 'Magma Mauler Mk.IV', text: 'Частный маршрут. Несанкционированное движение будет прекращено.' },
    { speaker: 'Cassia', hero: 'cassia', text: 'Большая машина. Узкая дорога. Решаемая задача.' },
  ],
  'road-king': [{ speaker: 'Road King', text: 'Моя дорога. Мой темп. Твой последний поворот.' }],
  overseer: [
    { speaker: 'The Forge Overseer', text: 'Смена не закончена. Вернуться на рабочие места.' },
    { speaker: 'Bruna', hero: 'bruna', text: 'Твоя закончена.' },
  ],
  dreadnought: [
    { speaker: 'Sulfur Tyrant', text: 'Вы называете это свободой. Я называю это перебоем.' },
    { speaker: 'Sulfur Tyrant', text: 'Без меня у этого города нет будущего.' },
    { speaker: 'Cassia', hero: 'cassia', text: 'Тогда тебе лучше посмотреть внимательно.' },
  ],
};

/** One exchange per encounter; its clock advances only during active gameplay. */
export class BossDialogue {
  private seen = new Set<DialogueBoss>();
  private lines: Line[] = [];
  private remaining = 0;
  reset() { this.seen.clear(); this.lines = []; this.remaining = 0; }
  hasSeen(boss: DialogueBoss) { return this.seen.has(boss); }
  encounter(boss: DialogueBoss, heroes: HeroId[]) {
    if (this.seen.has(boss)) return;
    this.seen.add(boss);
    this.lines = DIALOGUES[boss].filter(line => !line.hero || heroes.includes(line.hero));
    this.remaining = 4;
  }
  get active() { return this.lines.length > 0; }
  get snapshot() { return this.active ? { ...this.lines[0], remaining: this.remaining, linesLeft: this.lines.length } : null; }
  update(dt: number, skip: boolean) {
    this.remaining -= dt;
    if (skip || this.remaining <= 0) { this.lines.shift(); this.remaining = 4; }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const line = this.lines[0];
    if (!line) return;
    const x = line.hero ? 42 : 378, y = 82, width = 540;
    ctx.save();
    ctx.fillStyle = '#fff5dc'; ctx.strokeStyle = '#25132f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, width, 138, 20); ctx.fill(); ctx.stroke();
    const tail = line.hero ? x + 72 : x + width - 86;
    ctx.beginPath(); ctx.moveTo(tail, y + 137); ctx.lineTo(tail + (line.hero ? -22 : 22), y + 163); ctx.lineTo(tail + 32, y + 137); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = line.hero ? '#177267' : '#9b2948'; ctx.font = '900 18px Arial';
    ctx.fillText(line.speaker, x + 22, y + 29);
    ctx.fillStyle = '#25132f'; ctx.font = '700 19px Arial';
    let row = '', rowY = y + 59;
    for (const word of line.text.split(' ')) {
      const next = row ? `${row} ${word}` : word;
      if (ctx.measureText(next).width > width - 44 && row) { ctx.fillText(row, x + 22, rowY); rowY += 24; row = word; }
      else row = next;
    }
    ctx.fillText(row, x + 22, rowY);
    ctx.font = '12px Arial'; ctx.fillStyle = '#716072';
    ctx.fillText('Enter / Z / A — дальше', x + 22, y + 122);
    ctx.restore();
  }
}
