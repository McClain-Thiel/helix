import React from 'react';

interface FeatureIconProps {
  type: string;
  color: string;
  size?: number;
}

/** SBOL-style SVG icons for feature types */
export function FeatureIcon({ type, color, size = 14 }: FeatureIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      {type === 'promoter' && (
        <path d="M2 10V4l8 3-8 3z" fill={color} opacity="0.8" />
      )}
      {type === 'terminator' && (
        <>
          <line x1="7" y1="3" x2="7" y2="11" stroke={color} strokeWidth="1.5" opacity="0.8" />
          <line x1="3" y1="3" x2="11" y2="3" stroke={color} strokeWidth="2" opacity="0.8" />
        </>
      )}
      {type === 'cds' && (
        <rect x="1" y="3" width="12" height="8" rx="2" fill={color} opacity="0.6" />
      )}
      {(type === 'ori' || type === 'rep_origin') && (
        <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.8" />
      )}
      {type === 'resistance' && (
        <path d="M3 11L7 3l4 8H3z" fill={color} opacity="0.6" />
      )}
      {type === 'gene' && (
        <rect x="1" y="3" width="12" height="8" rx="2" fill={color} opacity="0.5" />
      )}
      {(type === 'tag' || type === 'rbs' || type === 'misc' || type === 'misc_feature') && (
        <rect x="2" y="4" width="10" height="6" rx="3" fill={color} opacity="0.5" />
      )}
      {type === 'enhancer' && (
        <path d="M2 7h3l2-4 2 8 2-4h3" stroke={color} strokeWidth="1.2" fill="none" opacity="0.8" />
      )}
    </svg>
  );
}
