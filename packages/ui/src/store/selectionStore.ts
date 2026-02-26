import { create } from 'zustand';

export interface SelectionRange {
  start: number;
  end: number;
}

interface SelectionState {
  range: SelectionRange | null;
  selectedFeatureId: string | null;
  cursorPosition: number | null;

  // Actions
  setRange: (range: SelectionRange | null) => void;
  setCursorPosition: (pos: number | null) => void;
  selectFeature: (featureId: string | null) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  range: null,
  selectedFeatureId: null,
  cursorPosition: null,

  setRange: (range) =>
    set({
      range,
      cursorPosition: range?.start ?? null,
    }),

  setCursorPosition: (pos) =>
    set({
      cursorPosition: pos,
      range: null,
    }),

  selectFeature: (featureId) =>
    set({ selectedFeatureId: featureId }),

  clearSelection: () =>
    set({
      range: null,
      selectedFeatureId: null,
      cursorPosition: null,
    }),
}));
