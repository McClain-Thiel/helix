import React, { useCallback, useRef, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { tokens, baseColors } from '../../theme/tokens';
import { useSelectionStore } from '../../store/selectionStore';
import { useViewStore } from '../../store/viewStore';
import type { SequenceDto, FeatureDto } from '../../types/sequence';

interface SequenceViewProps {
  sequence: SequenceDto;
}

const ROW_HEIGHT = 56; // px per row (bases + ruler + optional translation)
const CHAR_WIDTH = 8.4; // approximate monospace char width at 13px

export function SequenceView({ sequence }: SequenceViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const basesPerRow = useViewStore((s) => s.basesPerRow);
  const showComplement = useViewStore((s) => s.showComplement);
  const showTranslation = useViewStore((s) => s.showTranslation);
  const { range, cursorPosition } = useSelectionStore();
  const setRange = useSelectionStore((s) => s.setRange);
  const selectFeature = useSelectionStore((s) => s.selectFeature);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);

  const totalRows = Math.ceil(sequence.length / basesPerRow);

  const rowHeight = useMemo(() => {
    let h = ROW_HEIGHT;
    if (showComplement) h += 18;
    if (showTranslation) h += 18;
    return h;
  }, [showComplement, showTranslation]);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Build a lookup: position -> [features covering this position]
  const featureIndex = useMemo(() => {
    const idx: Map<number, FeatureDto[]> = new Map();
    for (const feat of sequence.features) {
      for (let i = feat.start; i < feat.end; i++) {
        const existing = idx.get(i);
        if (existing) {
          existing.push(feat);
        } else {
          idx.set(i, [feat]);
        }
      }
    }
    return idx;
  }, [sequence.features]);

  const isInSelection = useCallback(
    (pos: number) => {
      if (!range) return false;
      if (range.start <= range.end) {
        return pos >= range.start && pos < range.end;
      }
      // Circular wrap
      return pos >= range.start || pos < range.end;
    },
    [range]
  );

  const getBasePosition = useCallback(
    (rowIndex: number, charIndex: number) => {
      return rowIndex * basesPerRow + charIndex;
    },
    [basesPerRow]
  );

  const handleMouseDown = useCallback(
    (pos: number) => {
      setIsDragging(true);
      setDragStart(pos);
      setRange({ start: pos, end: pos + 1 });

      // Check if this position is inside a feature
      const feats = featureIndex.get(pos);
      if (feats && feats.length > 0) {
        selectFeature(feats[0].id);
      }
    },
    [setRange, selectFeature, featureIndex]
  );

  const handleMouseMove = useCallback(
    (pos: number) => {
      if (isDragging && dragStart !== null) {
        const start = Math.min(dragStart, pos);
        const end = Math.max(dragStart, pos) + 1;
        setRange({ start, end });
      }
    },
    [isDragging, dragStart, setRange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const complement = useCallback((base: string) => {
    const map: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
    return map[base] ?? 'N';
  }, []);

  return (
    <div
      ref={parentRef}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontFamily: tokens.font.mono,
        fontSize: 13,
        userSelect: 'none',
        cursor: 'text',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStart = virtualRow.index * basesPerRow;
          const rowEnd = Math.min(rowStart + basesPerRow, sequence.length);
          const rowBases = sequence.sequence.slice(rowStart, rowEnd);

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                padding: '0 20px',
              }}
            >
              {/* Position ruler */}
              <div
                style={{
                  color: tokens.text.tertiary,
                  fontSize: 10,
                  fontFamily: tokens.font.mono,
                  height: 16,
                  lineHeight: '16px',
                }}
              >
                {rowStart + 1}
              </div>

              {/* Forward strand bases */}
              <div style={{ height: 20, lineHeight: '20px', whiteSpace: 'pre' }}>
                {rowBases.split('').map((base, i) => {
                  const pos = rowStart + i;
                  const inSel = isInSelection(pos);
                  const feats = featureIndex.get(pos);
                  const featColor = feats?.[0]?.color;

                  return (
                    <span
                      key={i}
                      onMouseDown={() => handleMouseDown(pos)}
                      onMouseMove={() => handleMouseMove(pos)}
                      style={{
                        color: baseColors[base] ?? tokens.text.secondary,
                        backgroundColor: inSel
                          ? 'rgba(45,212,168,0.2)'
                          : featColor
                            ? `${featColor}18`
                            : 'transparent',
                        fontWeight: 400,
                        letterSpacing: '0.08em',
                        borderBottom: featColor ? `2px solid ${featColor}40` : 'none',
                      }}
                    >
                      {base}
                    </span>
                  );
                })}
              </div>

              {/* Complement strand */}
              {showComplement && (
                <div
                  style={{
                    height: 18,
                    lineHeight: '18px',
                    whiteSpace: 'pre',
                    opacity: 0.4,
                  }}
                >
                  {rowBases
                    .split('')
                    .map((base) => complement(base))
                    .map((base, i) => (
                      <span
                        key={i}
                        style={{
                          color: baseColors[base] ?? tokens.text.tertiary,
                          letterSpacing: '0.08em',
                        }}
                      >
                        {base}
                      </span>
                    ))}
                </div>
              )}

              {/* Translation row */}
              {showTranslation && (
                <div
                  style={{
                    height: 18,
                    lineHeight: '18px',
                    fontSize: 11,
                    color: tokens.text.tertiary,
                    letterSpacing: '0.24em',
                    whiteSpace: 'pre',
                  }}
                >
                  {translateRow(rowBases)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Simple codon translation for display */
function translateRow(bases: string): string {
  const codonTable: Record<string, string> = {
    TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
    CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
    ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
    GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
    TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
    CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
    ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
    GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
    TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
    CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
    AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
    GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
    TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
    CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
    AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
    GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
  };

  let result = '';
  for (let i = 0; i + 2 < bases.length; i += 3) {
    const codon = bases.slice(i, i + 3).toUpperCase();
    const aa = codonTable[codon] ?? '?';
    result += aa + '  ';
  }
  return result;
}
