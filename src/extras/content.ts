import heroines from '../../docs/heroines.md?raw';
import enemies from '../../docs/enemies-and-bosses.md?raw';
import world from '../../docs/narrative.md?raw';
import story from '../../docs/story.md?raw';

export interface ArchiveEntry { title: string; body: string; portrait?: { path: string; columns: number; rows: number; frame: number; isolated?: boolean } }
export interface ArchiveSection { label: string; entries: ArchiveEntry[] }

function sections(source: string, depth: number): ArchiveEntry[] {
  const marker = '#'.repeat(depth);
  return source.split(new RegExp(`^${marker} `, 'm')).slice(1).map(part => {
    const end = part.indexOf('\n');
    return { title: part.slice(0, end).trim(), body: part.slice(end + 1).trim() };
  });
}
const heroes = sections(heroines, 2).slice(0, 3).map((entry, frame) => ({ ...entry,
  portrait: { path: 'assets/ui/cow-portraits-sheet.webp', columns: 3, rows: 1, frame } }));
const bosses = sections(enemies.split('## Боссы')[1].split('## Ориентиры')[0], 3);
const bossArt = [
  { path: 'assets/sprites/road-ripper-sheet.png', columns: 3, rows: 2, frame: 0 },
  { path: 'assets/road-rash/road-rash-riders-atlas-v3.png', columns: 1, rows: 1, frame: 2, isolated: true },
  { path: 'assets/brawler/forge-overseer-sheet.png', columns: 3, rows: 2, frame: 0 },
  { path: 'assets/sprites/boss-body-sheet.png', columns: 3, rows: 2, frame: 0 },
];
const streetArt = (frame: number) => ({ path: 'assets/brawler/venus-gang-sheet.png', columns: 4, rows: 6, frame });
const rosterArt = (frame: number) => ({ path: 'assets/sprites/enemy-roster-sheet.png', columns: 4, rows: 3, frame });
const enemyArt: Array<ArchiveEntry['portrait']> = [
  { path: 'assets/sprites/rider-sheet.png', columns: 3, rows: 2, frame: 0 }, rosterArt(0),
  { path: 'assets/sprites/aerials-sheet.png', columns: 4, rows: 2, frame: 0 },
  { path: 'assets/sprites/aerials-sheet.png', columns: 4, rows: 2, frame: 4 }, rosterArt(4), rosterArt(8),
  { path: 'assets/road-rash/road-rash-riders-atlas-v3.png', columns: 1, rows: 1, frame: 0, isolated: true },
  undefined, streetArt(0), streetArt(8), streetArt(16),
];
export const ARCHIVE: ArchiveSection[] = [
  { label: 'Героини', entries: heroes },
  { label: 'Боссы', entries: bosses.map((entry, i) => ({ ...entry, portrait: bossArt[i] })) },
  { label: 'Рядовые враги', entries: sections(enemies.split('## Рядовые враги на Venus Highway')[1].split('## Боссы')[0], 3)
    .map((entry, i) => ({ ...entry, body: entry.body.replace(/^## .+$/gm, ''), portrait: enemyArt[i] })) },
  { label: 'Карта мира', entries: [{ title: 'Регион Venus City', body: '' }] },
  { label: 'История мира', entries: sections(world, 2).filter(entry => !['Границы канона'].includes(entry.title)) },
  { label: 'Сюжет игры', entries: sections(story, 2).filter(entry => !['Статус сценария', 'Подача и объём будущих сцен', 'Связь с реализацией'].includes(entry.title)) },
];
