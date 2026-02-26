// @helix/plugin-api - Stub for Phase 2 plugin system
export interface HelixPlugin {
  name: string;
  version: string;
  onActivate?: (context: PluginContext) => void;
  onDeactivate?: () => void;
}

export interface PluginContext {
  registerPrediction: (card: PredictionCard) => void;
  registerCommand: (command: PluginCommand) => void;
}

export interface PredictionCard {
  id: string;
  name: string;
  compute: (sequence: string) => Promise<PredictionResult>;
}

export interface PredictionResult {
  title: string;
  score?: number;
  details: string;
}

export interface PluginCommand {
  id: string;
  label: string;
  execute: () => Promise<void>;
}
