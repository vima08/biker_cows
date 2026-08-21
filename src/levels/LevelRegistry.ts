import type { LevelDefinition } from './types';

/**
 * Ordered, validated campaign catalog. Adding a level is intentionally data-first:
 * register one definition and let the game ask the catalog for transitions.
 */
export class LevelRegistry {
  private readonly levels: readonly LevelDefinition[];
  private readonly byId = new Map<string, LevelDefinition>();

  constructor(definitions: readonly LevelDefinition[]) {
    this.levels = [...definitions].sort((left, right) => left.order - right.order);
    for (const level of this.levels) {
      if (this.byId.has(level.id)) throw new Error(`Duplicate level id: ${level.id}`);
      this.byId.set(level.id, level);
    }
  }

  first(): LevelDefinition {
    const level = this.levels[0];
    if (!level) throw new Error('The campaign has no levels');
    return level;
  }

  get<T extends LevelDefinition = LevelDefinition>(id: string): T {
    const level = this.byId.get(id);
    if (!level) throw new Error(`Unknown level: ${id}`);
    return level as T;
  }

  nextAfter(id: string): LevelDefinition | null {
    const index = this.levels.findIndex(level => level.id === id);
    return index >= 0 ? this.levels[index + 1] ?? null : null;
  }

  all(): readonly LevelDefinition[] {
    return this.levels;
  }
}
