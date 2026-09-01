export type CampaignCheckpoint = {
  readonly levelId: string;
  readonly stage: 1 | 2 | 3;
  readonly runtime: 'rider' | 'road-rash' | 'brawler';
};

export type ContinueSnapshot = {
  readonly attempts: { readonly current: number; readonly total: number; readonly remaining: number };
  readonly continues: number;
  readonly countdown: number;
  readonly checkpoint: CampaignCheckpoint;
  readonly awaitingInput: boolean;
  readonly exhausted: boolean;
};

/**
 * Owns campaign state that survives a stage restart. Gameplay runtimes stay
 * disposable: accepting a continue constructs a fresh stage from checkpoint.
 */
export class ContinueSystem {
  private readonly totalAttempts: number;
  private remainingAttempts: number;
  private currentAttempt = 1;
  private countdownSeconds = 0;
  private waiting = false;
  private exhausted = false;
  private active = false;
  private currentCheckpoint: CampaignCheckpoint;

  constructor(
    checkpoint: CampaignCheckpoint,
    totalAttempts = 3,
    private readonly countdownDuration = 9.99,
  ) {
    this.currentCheckpoint = checkpoint;
    this.totalAttempts = Math.max(1, Math.floor(totalAttempts));
    this.remainingAttempts = this.totalAttempts;
  }

  get isActive(): boolean { return this.active; }

  startCampaign(checkpoint: CampaignCheckpoint): void {
    this.currentCheckpoint = checkpoint;
    this.remainingAttempts = this.totalAttempts;
    this.currentAttempt = 1;
    this.countdownSeconds = 0;
    this.waiting = false;
    this.exhausted = false;
    this.active = true;
  }

  setCheckpoint(checkpoint: CampaignCheckpoint): void {
    this.currentCheckpoint = checkpoint;
  }

  registerDefeat(): 'continue' | 'game-over' {
    if (!this.active) this.startCampaign(this.currentCheckpoint);
    this.remainingAttempts = Math.max(0, this.remainingAttempts - 1);
    if (this.remainingAttempts === 0) {
      this.waiting = false;
      this.exhausted = true;
      this.countdownSeconds = 0;
      return 'game-over';
    }
    this.currentAttempt = this.totalAttempts - this.remainingAttempts + 1;
    this.waiting = true;
    this.exhausted = false;
    this.countdownSeconds = this.countdownDuration;
    return 'continue';
  }

  tick(dt: number): boolean {
    if (!this.waiting) return false;
    this.countdownSeconds = Math.max(0, this.countdownSeconds - Math.max(0, dt));
    if (this.countdownSeconds > 0) return false;
    this.waiting = false;
    this.exhausted = true;
    return true;
  }

  accept(): CampaignCheckpoint | null {
    if (!this.waiting || this.remainingAttempts <= 0) return null;
    this.waiting = false;
    this.countdownSeconds = 0;
    return this.currentCheckpoint;
  }

  abandon(): void {
    this.waiting = false;
    this.countdownSeconds = 0;
    this.active = false;
  }

  snapshot(): ContinueSnapshot {
    return {
      attempts: {
        current: this.currentAttempt,
        total: this.totalAttempts,
        remaining: this.remainingAttempts,
      },
      continues: Math.max(0, this.remainingAttempts),
      countdown: Number(this.countdownSeconds.toFixed(2)),
      checkpoint: { ...this.currentCheckpoint },
      awaitingInput: this.waiting,
      exhausted: this.exhausted,
    };
  }
}
