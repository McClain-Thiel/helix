use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::feature::Feature;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Topology {
    Linear,
    Circular,
}

impl std::fmt::Display for Topology {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Topology::Linear => write!(f, "linear"),
            Topology::Circular => write!(f, "circular"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceMetadata {
    #[serde(default)]
    pub accession: Option<String>,
    #[serde(default)]
    pub organism: Option<String>,
    #[serde(default)]
    pub molecule_type: Option<String>,
    #[serde(default)]
    pub division: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub definition: Option<String>,
    #[serde(default)]
    pub keywords: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub references: Vec<Reference>,
    #[serde(default)]
    pub comments: Vec<String>,
}

impl Default for SequenceMetadata {
    fn default() -> Self {
        Self {
            accession: None,
            organism: None,
            molecule_type: None,
            division: None,
            date: None,
            definition: None,
            keywords: None,
            source: None,
            references: Vec::new(),
            comments: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub number: u32,
    pub authors: Option<String>,
    pub title: Option<String>,
    pub journal: Option<String>,
    pub pubmed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sequence {
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub topology: Topology,
    pub sequence: String,
    #[serde(default)]
    pub features: Vec<Feature>,
    #[serde(default)]
    pub metadata: SequenceMetadata,
}

impl Sequence {
    pub fn new(name: impl Into<String>, sequence: impl Into<String>, topology: Topology) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            description: String::new(),
            topology,
            sequence: sequence.into().to_uppercase(),
            features: Vec::new(),
            metadata: SequenceMetadata::default(),
        }
    }

    pub fn len(&self) -> usize {
        self.sequence.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sequence.is_empty()
    }

    pub fn is_circular(&self) -> bool {
        self.topology == Topology::Circular
    }

    /// Get a subsequence, handling circular wrapping
    pub fn subsequence(&self, start: usize, end: usize) -> String {
        if start <= end {
            self.sequence[start..end].to_string()
        } else if self.is_circular() {
            // Wraps around origin
            let mut result = self.sequence[start..].to_string();
            result.push_str(&self.sequence[..end]);
            result
        } else {
            String::new()
        }
    }

    pub fn add_feature(&mut self, feature: Feature) {
        self.features.push(feature);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_sequence() {
        let seq = Sequence::new("test", "ATCGATCG", Topology::Linear);
        assert_eq!(seq.name, "test");
        assert_eq!(seq.len(), 8);
        assert!(!seq.is_circular());
    }

    #[test]
    fn test_circular_subsequence() {
        let seq = Sequence::new("circ", "AABBCCDD", Topology::Circular);
        // Normal range
        assert_eq!(seq.subsequence(2, 6), "BBCC");
        // Wrapping range
        assert_eq!(seq.subsequence(6, 2), "DDAA");
    }

    #[test]
    fn test_linear_no_wrap() {
        let seq = Sequence::new("lin", "AABBCCDD", Topology::Linear);
        assert_eq!(seq.subsequence(6, 2), ""); // no wrap for linear
    }
}
