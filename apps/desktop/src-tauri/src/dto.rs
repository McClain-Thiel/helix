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

// ── Annotation DTOs ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnnotationHitDto {
    pub component_name: String,
    pub component_id: i64,
    pub category: String,
    pub target_start: usize,
    pub target_end: usize,
    pub strand: i8,
    pub percent_identity: f64,
    pub query_coverage: f64,
    pub alignment_score: i32,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentDto {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub length: usize,
    pub description: Option<String>,
    pub organism: Option<String>,
    pub is_builtin: bool,
}

// ── Reverse conversion: SequenceDto -> core::Sequence (for export) ──

impl SequenceDto {
    pub fn to_core_sequence(&self) -> helix_core::Sequence {
        use helix_core::feature::{Feature, FeatureType, Location, Qualifier, Strand};
        use helix_core::sequence::Topology;

        let topology = match self.topology.as_str() {
            "circular" => Topology::Circular,
            _ => Topology::Linear,
        };

        let id = uuid::Uuid::parse_str(&self.id)
            .unwrap_or_else(|_| uuid::Uuid::new_v4());

        let features = self.features.iter().map(|f| {
            let feature_type = FeatureType::from_genbank_key(&f.feature_type);
            let strand = Strand::from_i8(f.strand);
            let location = Location::simple(f.start, f.end);
            let qualifiers = f.qualifiers.iter().map(|q| Qualifier {
                key: q.key.clone(),
                value: q.value.clone(),
            }).collect();

            let feat_id = uuid::Uuid::parse_str(&f.id)
                .unwrap_or_else(|_| uuid::Uuid::new_v4());

            Feature {
                id: feat_id,
                name: f.name.clone(),
                feature_type,
                location,
                strand,
                color: Some(f.color.clone()),
                qualifiers,
            }
        }).collect();

        helix_core::Sequence {
            id,
            name: self.name.clone(),
            description: self.description.clone(),
            topology,
            sequence: self.sequence.clone(),
            features,
            metadata: helix_core::sequence::SequenceMetadata::default(),
        }
    }
}
