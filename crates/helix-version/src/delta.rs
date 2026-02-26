use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A sequence operation in a delta
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum SequenceOp {
    Insert { position: usize, bases: String },
    Delete { position: usize, length: usize },
    Replace { position: usize, length: usize, bases: String },
}

/// An annotation operation in a delta
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum AnnotationOp {
    Add { feature_json: String },
    Remove { feature_id: Uuid },
    Modify { feature_id: Uuid, changes_json: String },
}

/// A metadata operation in a delta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataOp {
    pub key: String,
    pub value: String,
}

/// A delta representing changes between two versions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delta {
    #[serde(default)]
    pub sequence_ops: Vec<SequenceOp>,
    #[serde(default)]
    pub annotation_ops: Vec<AnnotationOp>,
    #[serde(default)]
    pub metadata_ops: Vec<MetadataOp>,
}

impl Delta {
    pub fn new() -> Self {
        Self {
            sequence_ops: Vec::new(),
            annotation_ops: Vec::new(),
            metadata_ops: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.sequence_ops.is_empty()
            && self.annotation_ops.is_empty()
            && self.metadata_ops.is_empty()
    }
}

impl Default for Delta {
    fn default() -> Self {
        Self::new()
    }
}

/// A version in the timeline
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Version {
    pub id: Uuid,
    pub sequence_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub branch: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub author: String,
    pub description: String,
    pub delta: Delta,
}
