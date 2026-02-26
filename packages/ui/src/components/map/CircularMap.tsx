import React, { useRef, useEffect, useCallback } from 'react';
import { CircularMapRenderer } from './CircularMapRenderer';
import { useSelectionStore } from '../../store/selectionStore';
import type { SequenceDto, EnzymeDto } from '../../types/sequence';

interface CircularMapProps {
  sequence: SequenceDto;
  enzymes?: EnzymeDto[];
  width?: number;
  height?: number;
}

/**
 * React wrapper for the imperative CircularMapRenderer.
 * Creates renderer on mount, syncs data from props/stores via useEffect.
 */
export function CircularMap({
  sequence,
  enzymes = [],
  width = 500,
  height = 500,
}: CircularMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CircularMapRenderer | null>(null);
  const selectedFeatureId = useSelectionStore((s) => s.selectedFeatureId);
  const selection = useSelectionStore((s) => s.range);
  const selectFeature = useSelectionStore((s) => s.selectFeature);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CircularMapRenderer();
    rendererRef.current = renderer;

    renderer.init(canvas, width, height).then(() => {
      renderer.update({
        sequence,
        enzymes,
        selectedFeatureId,
        selection,
      });
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
    // Only re-create on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync data changes to renderer
  useEffect(() => {
    rendererRef.current?.update({
      sequence,
      enzymes,
      selectedFeatureId,
      selection,
    });
  }, [sequence, enzymes, selectedFeatureId, selection]);

  // Handle resize
  useEffect(() => {
    rendererRef.current?.resize(width, height);
  }, [width, height]);

  // Handle click for feature selection
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const featureId = renderer.hitTest(x, y);
      selectFeature(featureId);
    },
    [selectFeature]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width,
        height,
        cursor: 'crosshair',
      }}
    />
  );
}
