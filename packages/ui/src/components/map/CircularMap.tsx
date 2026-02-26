import React, { useRef, useEffect, useCallback, useState } from 'react';
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
 * Uses a container div so each mount gets a fresh canvas + WebGL context,
 * avoiding the StrictMode double-mount WebGL context conflict.
 */
export function CircularMap({
  sequence,
  enzymes = [],
  width = 500,
  height = 500,
}: CircularMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CircularMapRenderer | null>(null);
  const selectedFeatureId = useSelectionStore((s) => s.selectedFeatureId);
  const selection = useSelectionStore((s) => s.range);
  const selectFeature = useSelectionStore((s) => s.selectFeature);
  const [error, setError] = useState<string | null>(null);

  // Initialize renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    // Create a fresh canvas for each mount — avoids stale WebGL context
    const canvas = document.createElement('canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.cursor = 'crosshair';
    container.appendChild(canvas);

    const renderer = new CircularMapRenderer();
    rendererRef.current = renderer;

    renderer
      .init(canvas, width, height)
      .then(() => {
        if (cancelled) {
          renderer.destroy();
          return;
        }
        renderer.update({
          sequence,
          enzymes,
          selectedFeatureId,
          selection,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Pixi.js init failed:', err);
        setError(String(err));
      });

    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
      // Remove the canvas from DOM
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
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
    (e: React.MouseEvent<HTMLDivElement>) => {
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

  if (error) {
    return (
      <div style={{ color: '#ef6b6b', padding: 20, textAlign: 'center' }}>
        <p>Map renderer error: {error}</p>
        <p style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
          WebGL may not be available. Try reloading.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width,
        height,
        cursor: 'crosshair',
      }}
    />
  );
}
