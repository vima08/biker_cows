export interface HighScore {
  name: string;
  score: number;
}

/** Keeps persistence and validation out of the game loop. */
export class HighScoreStore {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
    private readonly key = 'venus-stampede-highscores',
    private readonly limit = 5,
  ) {}

  load(): HighScore[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry): entry is HighScore => Boolean(entry)
          && typeof entry === 'object'
          && typeof (entry as HighScore).name === 'string'
          && Number.isFinite((entry as HighScore).score))
        .slice(0, this.limit);
    } catch {
      return [];
    }
  }

  add(current: readonly HighScore[], entry: HighScore): HighScore[] {
    const next = [...current, entry]
      .sort((left, right) => right.score - left.score)
      .slice(0, this.limit);
    try {
      this.storage.setItem(this.key, JSON.stringify(next));
    } catch {
      // Private browsing or a full quota must not interrupt gameplay.
    }
    return next;
  }
}
