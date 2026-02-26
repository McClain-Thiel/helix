import { tokens } from './tokens';

const featureColorMap: Record<string, string> = {
  promoter: tokens.feature.promoter,
  cds: tokens.feature.cds,
  terminator: tokens.feature.terminator,
  ori: tokens.feature.ori,
  rep_origin: tokens.feature.ori,
  resistance: tokens.feature.resistance,
  tag: tokens.feature.tag,
  rbs: tokens.feature.rbs,
  enhancer: '#67e8f9',
  gene: '#60a5fa',
  misc: tokens.feature.misc,
  source: '#6b6c74',
  primer: '#f0b429',
  regulatory: '#2dd4a8',
  signal: '#f472b6',
};

/** Get the display color for a feature type */
export function getFeatureColor(featureType: string): string {
  return featureColorMap[featureType.toLowerCase()] ?? tokens.feature.misc;
}
