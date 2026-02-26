import React, { useRef, useEffect, useCallback, useState } from 'react';
import { CircularMapRenderer } from './CircularMapRenderer';
import type { CircularMapEvent } from './CircularMapRenderer';
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
 * Uses a container div so each mount gets a fresh canvas + WebGL context.
 * Wires renderer events to Zustand selection store.
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
  const setRange = useSelectionStore((s) => s.setRange);
  const setCursorPosition = useSelectionStore((s) => s.setCursorPosition);
  const [error, setError] = useState<string | null>(null);

  // Stable event handler ref so we don't re-attach on every render
  const handleEventRef = useRef<(event: CircularMapEvent) => void>(() => {});
  handleEventRef.current = (event: CircularMapEvent) => {
    switch (event.type) {
      case 'featureClick':
        selectFeature(event.featureId ?? null);
        break;
      case 'backboneClick':
        if (event.position !== undefined) {
          setCursorPosition(event.position);
        }
        break;
      case 'selectionDrag':
        if (event.selection) {
          setRange(event.selection);
        }
        break;
    }
  };

  // Initialize renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    // Create a fresh canvas for each mount
    const canvas = document.createElement('canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.cursor = 'crosshair';
    container.appendChild(canvas);

    const renderer = new CircularMapRenderer();
    rendererRef.current = renderer;

    // Wire events through stable ref
    const eventHandler = (event: CircularMapEvent) => handleEventRef.current(event);
    renderer.on(eventHandler);

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
      renderer.off(eventHandler);
      renderer.destroy();
      rendererRef.current = null;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
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

  // Handle resize — update both the Pixi renderer and the canvas CSS
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    }
    rendererRef.current?.resize(width, height);
  }, [width, height]);

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
      style={{
        width,
        height,
      }}
    />
  );
}
