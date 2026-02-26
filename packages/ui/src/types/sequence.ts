/** DTO types mirroring Rust backend structures */

export interface SequenceDto {
  id: string;
  name: string;
  description: string;
  topology: 'linear' | 'circular';
  sequence: string;
  length: number;
  features: FeatureDto[];
}

export interface FeatureDto {
  id: string;
  name: string;
  featureType: string;
  start: number;
  end: number;
  strand: -1 | 0 | 1;
  color: string;
  qualifiers: QualifierDto[];
}

export interface QualifierDto {
  key: string;
  value: string;
}

export interface MatchDto {
  start: number;
  end: number;
  matched: string;
  isComplement: boolean;
}

export interface OrfDto {
  start: number;
  end: number;
  frame: number;
  lengthAa: number;
  protein: string;
}

export interface EditorTab {
  id: string;
  sequenceId: string;
  name: string;
  isDirty: boolean;
}

export interface EnzymeDto {
  name: string;
  position: number;
  overhang: string;
}
