//! Flat, JSON-friendly DTOs for frontend communication.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub topology: String,
    pub sequence: String,
    pub length: usize,
    pub features: Vec<FeatureDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureDto {
    pub id: String,
    pub name: String,
    pub feature_type: String,
    pub start: usize,
    pub end: usize,
    pub strand: i8,
    pub color: String,
    pub qualifiers: Vec<QualifierDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualifierDto {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchDto {
    pub start: usize,
    pub end: usize,
    pub matched: String,
    pub is_complement: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrfDto {
    pub start: usize,
    pub end: usize,
    pub frame: i8,
    pub length_aa: usize,
    pub protein: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFileResult {
    pub sequences: Vec<SequenceDto>,
    pub file_path: String,
    pub format: String,
}

// Conversion from core types to DTOs
impl From<&helix_core::Sequence> for SequenceDto {
    fn from(seq: &helix_core::Sequence) -> Self {
        SequenceDto {
            id: seq.id.to_string(),
            name: seq.name.clone(),
            description: seq.description.clone(),
            topology: seq.topology.to_string(),
            sequence: seq.sequence.clone(),
            length: seq.len(),
            features: seq.features.iter().map(FeatureDto::from).collect(),
        }
    }
}

impl From<&helix_core::Feature> for FeatureDto {
    fn from(f: &helix_core::Feature) -> Self {
        FeatureDto {
            id: f.id.to_string(),
            name: f.name.clone(),
            feature_type: format!("{:?}", f.feature_type).to_lowercase(),
            start: f.start(),
            end: f.end(),
            strand: f.strand.as_i8(),
            color: f.effective_color().to_string(),
            qualifiers: f
                .qualifiers
                .iter()
                .map(|q| QualifierDto {
                    key: q.key.clone(),
                    value: q.value.clone(),
                })
                .collect(),
        }
    }
}

impl From<&helix_core::search::SequenceMatch> for MatchDto {
    fn from(m: &helix_core::search::SequenceMatch) -> Self {
        MatchDto {
            start: m.start,
            end: m.end,
            matched: m.matched.clone(),
            is_complement: m.is_complement,
        }
    }
}

impl From<&helix_core::operations::Orf> for OrfDto {
    fn from(o: &helix_core::operations::Orf) -> Self {
        OrfDto {
            start: o.start,
            end: o.end,
            frame: o.frame,
            length_aa: o.length_aa,
            protein: o.protein.clone(),
        }
    }
}
