export type CampaignAct = 1 | 2 | 3;

export type CampaignSegment =
  | 'rider-pre-miniboss'
  // Standalone experimental scene; campaignSegment() never returns this.
  | 'road-rash'
  | 'brawler'
  | 'rider-post-miniboss';

export const CAMPAIGN_TIMING = Object.freeze({
  minibossAtSeconds: 145,
  originalBossAtSeconds: 465,
  originalPostMinibossSeconds: 320,
  act3BossAtSeconds: 160,
  act3TimelineRate: 2,
});

export function campaignSegment(act: CampaignAct): CampaignSegment {
  if (act === 1) return 'rider-pre-miniboss';
  if (act === 2) return 'brawler';
  return 'rider-post-miniboss';
}

/**
 * Act 3 replays the old post-miniboss encounter curve at double speed. This
 * keeps its enemy mix and late-stage intensity while halving 320 seconds to
 * exactly 160 seconds before the final boss appears.
 */
export function riderSourceElapsed(act: CampaignAct, segmentElapsed: number): number {
  if (act === 3) {
    return Math.min(
      CAMPAIGN_TIMING.originalBossAtSeconds,
      CAMPAIGN_TIMING.minibossAtSeconds + Math.max(0, segmentElapsed) * CAMPAIGN_TIMING.act3TimelineRate,
    );
  }
  return Math.max(0, segmentElapsed);
}

export function riderSegmentDuration(act: CampaignAct): number | null {
  if (act === 1) return CAMPAIGN_TIMING.minibossAtSeconds;
  if (act === 3) return CAMPAIGN_TIMING.act3BossAtSeconds;
  return null;
}
