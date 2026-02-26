import React, { useRef, useEffect, useState } from 'react';
import { LinearMapRenderer } from './LinearMapRenderer';
import type { LinearMapEvent } from './LinearMapRenderer';
import { useSelectionStore } from '../../store/selectionStore';
import type { SequenceDto, EnzymeDto } from '../../types/sequence';

interface LinearMapProps {
  sequence: SequenceDto;
  enzymes?: EnzymeDto[];
  width?: number;
  height?: number;
}

/**
 * React wrapper for the imperative LinearMapRenderer.
 * Uses the same container div pattern as CircularMap.
 */
export function LinearMap({
  sequence,
  enzymes = [],
  width = 800,
  height = 300,
}: LinearMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LinearMapRenderer | null>(null);
  const selectedFeatureId = useSelectionStore((s) => s.selectedFeatureId);
  const selection = useSelectionStore((s) => s.range);
  const selectFeature = useSelectionStore((s) => s.selectFeature);
  const setRange = useSelectionStore((s) => s.setRange);
  const setCursorPosition = useSelectionStore((s) => s.setCursorPosition);
  const [error, setError] = useState<string | null>(null);

  // Stable event handler ref
  const handleEventRef = useRef<(event: LinearMapEvent) => void>(() => {});
  handleEventRef.current = (event: LinearMapEvent) => {
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

    const canvas = document.createElement('canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.cursor = 'crosshair';
    container.appendChild(canvas);

    const renderer = new LinearMapRenderer();
    rendererRef.current = renderer;

    const eventHandler = (event: LinearMapEvent) => handleEventRef.current(event);
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
        console.error('Linear map init failed:', err);
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

  // Sync data
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
        <p>Linear map renderer error: {error}</p>
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
