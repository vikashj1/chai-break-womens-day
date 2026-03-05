export const CAMPAIGN_END_UTC_MS = Date.UTC(2026, 2, 7, 18, 31, 0)

export function isCampaignEnded(nowMs: number = Date.now()): boolean {
  return nowMs >= CAMPAIGN_END_UTC_MS
}
