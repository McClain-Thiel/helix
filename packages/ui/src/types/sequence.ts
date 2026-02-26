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
  filePath?: string;
  fileFormat?: string;
}

export interface OpenFileResult {
  sequences: SequenceDto[];
  filePath: string;
  format: string;
}

export interface EnzymeDto {
  name: string;
  position: number;
  overhang: string;
}

export interface ComponentDto {
  id: number;
  name: string;
  category: string;
  length: number;
  description?: string;
  organism?: string;
  isBuiltin: boolean;
}

export interface AnnotationHitDto {
  componentName: string;
  componentId: number;
  category: string;
  targetStart: number;
  targetEnd: number;
  strand: -1 | 1;
  percentIdentity: number;
  queryCoverage: number;
  alignmentScore: number;
  color: string;
}
