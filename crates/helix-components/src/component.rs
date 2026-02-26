use serde::{Deserialize, Serialize};

/// A biological component (part) that can be identified in sequences via alignment.
///
/// Components represent well-characterized DNA elements such as origins of
/// replication, antibiotic resistance genes, promoters, terminators,
/// fluorescent protein coding sequences, and purification tags.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Component {
    /// Database primary key (auto-assigned on insert).
    pub id: i64,
    /// Human-readable name (e.g. "AmpR", "EGFP", "T7 promoter").
    pub name: String,
    /// Category string matching feature types: "cds", "promoter", "terminator",
    /// "ori", "resistance", "tag", etc.
    pub category: String,
    /// Uppercase DNA sequence of this component.
    pub sequence: String,
    /// Length of the sequence in base pairs.
    pub length: usize,
    /// Optional free-text description.
    pub description: Option<String>,
    /// Source organism, if applicable.
    pub organism: Option<String>,
    /// Whether this component ships with the application (true) or was added by
    /// the user (false).
    pub is_builtin: bool,
    /// GenBank / AddGene accession, if known.
    pub accession: Option<String>,
    /// Hex colour used when rendering this component on a map.
    pub color: Option<String>,
}

impl Component {
    /// Convenience constructor for seed / test data.
    pub fn new_builtin(
        name: impl Into<String>,
        category: impl Into<String>,
        sequence: impl Into<String>,
        description: Option<&str>,
        organism: Option<&str>,
        accession: Option<&str>,
        color: Option<&str>,
    ) -> Self {
        let seq: String = sequence.into().to_uppercase();
        let len = seq.len();
        Self {
            id: 0, // assigned by DB
            name: name.into(),
            category: category.into(),
            sequence: seq,
            length: len,
            description: description.map(String::from),
            organism: organism.map(String::from),
            is_builtin: true,
            accession: accession.map(String::from),
            color: color.map(String::from),
        }
    }
}
