/** Feature flags for post-MVP catalog modules. */
export const features = {
  slots: true,
  providers: true,
  bonuses: true,
  articles: true,
  guides: true,
  partnerBrands: true,
  expert: true,
  promoBanner: true,
  communityStats: true,
} as const;

export type FeatureKey = keyof typeof features;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return features[key] === true;
}
