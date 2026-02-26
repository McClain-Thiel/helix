import { create } from 'zustand';

type MapMode = 'circular' | 'linear';
type SequenceColorMode = 'base' | 'feature' | 'frame';

interface ViewState {
  mapMode: MapMode;
  zoom: number;
  panX: number;
  panY: number;
  showEnzymes: boolean;
  showLabels: boolean;
  showComplement: boolean;
  showTranslation: boolean;
  translationFrames: number[];
  sequenceColorMode: SequenceColorMode;
  basesPerRow: number;

  // Actions
  setMapMode: (mode: MapMode) => void;
  toggleMapMode: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleEnzymes: () => void;
  toggleLabels: () => void;
  toggleComplement: () => void;
  toggleTranslation: () => void;
  setTranslationFrames: (frames: number[]) => void;
  setSequenceColorMode: (mode: SequenceColorMode) => void;
  setBasesPerRow: (n: number) => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  mapMode: 'circular',
  zoom: 1,
  panX: 0,
  panY: 0,
  showEnzymes: true,
  showLabels: true,
  showComplement: false,
  showTranslation: false,
  translationFrames: [1],
  sequenceColorMode: 'base',
  basesPerRow: 80,

  setMapMode: (mode) => set({ mapMode: mode }),
  toggleMapMode: () =>
    set((s) => ({ mapMode: s.mapMode === 'circular' ? 'linear' : 'circular' })),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(10, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  toggleEnzymes: () => set((s) => ({ showEnzymes: !s.showEnzymes })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleComplement: () => set((s) => ({ showComplement: !s.showComplement })),
  toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),
  setTranslationFrames: (frames) => set({ translationFrames: frames }),
  setSequenceColorMode: (mode) => set({ sequenceColorMode: mode }),
  setBasesPerRow: (n) => set({ basesPerRow: n }),
}));
