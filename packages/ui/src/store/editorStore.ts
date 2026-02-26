import { create } from 'zustand';
import type { SequenceDto, FeatureDto, EditorTab } from '../types/sequence';

interface EditorState {
  sequences: Record<string, SequenceDto>;
  tabs: EditorTab[];
  activeTabId: string | null;

  // Actions
  openSequence: (seq: SequenceDto) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateFeature: (sequenceId: string, feature: FeatureDto) => void;
  addFeature: (sequenceId: string, feature: FeatureDto) => void;
  removeFeature: (sequenceId: string, featureId: string) => void;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  sequences: {},
  tabs: [],
  activeTabId: null,

  openSequence: (seq) =>
    set((state) => {
      // Check if already open
      const existingTab = state.tabs.find((t) => t.sequenceId === seq.id);
      if (existingTab) {
        return { activeTabId: existingTab.id };
      }

      const tab: EditorTab = {
        id: `tab-${seq.id}`,
        sequenceId: seq.id,
        name: seq.name,
        isDirty: false,
      };

      return {
        sequences: { ...state.sequences, [seq.id]: seq },
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }),

  closeTab: (tabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      const newActiveId =
        state.activeTabId === tabId
          ? newTabs[newTabs.length - 1]?.id ?? null
          : state.activeTabId;
      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateFeature: (sequenceId, feature) =>
    set((state) => {
      const seq = state.sequences[sequenceId];
      if (!seq) return state;
      const features = seq.features.map((f) =>
        f.id === feature.id ? feature : f
      );
      return {
        sequences: {
          ...state.sequences,
          [sequenceId]: { ...seq, features },
        },
      };
    }),

  addFeature: (sequenceId, feature) =>
    set((state) => {
      const seq = state.sequences[sequenceId];
      if (!seq) return state;
      return {
        sequences: {
          ...state.sequences,
          [sequenceId]: { ...seq, features: [...seq.features, feature] },
        },
      };
    }),

  removeFeature: (sequenceId, featureId) =>
    set((state) => {
      const seq = state.sequences[sequenceId];
      if (!seq) return state;
      return {
        sequences: {
          ...state.sequences,
          [sequenceId]: {
            ...seq,
            features: seq.features.filter((f) => f.id !== featureId),
          },
        },
      };
    }),
}));

/** Get the active sequence from the store */
export function useActiveSequence(): SequenceDto | null {
  return useEditorStore((state) => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) return null;
    return state.sequences[activeTab.sequenceId] ?? null;
  });
}
