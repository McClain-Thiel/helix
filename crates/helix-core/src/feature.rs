use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeatureType {
    Promoter,
    Cds,
    Terminator,
    Ori,
    Resistance,
    Tag,
    Rbs,
    Enhancer,
    Gene,
    Mrna,
    Misc,
    Source,
    RepOrigin,
    Primer,
    Regulatory,
    Signal,
    #[serde(other)]
    Other,
}

impl FeatureType {
    pub fn from_genbank_key(key: &str) -> Self {
        match key.to_lowercase().as_str() {
            "promoter" => FeatureType::Promoter,
            "cds" => FeatureType::Cds,
            "terminator" => FeatureType::Terminator,
            "rep_origin" => FeatureType::RepOrigin,
            "ori" | "origin" => FeatureType::Ori,
            "gene" => FeatureType::Gene,
            "mrna" => FeatureType::Mrna,
            "rbs" | "ribosome_binding_site" => FeatureType::Rbs,
            "enhancer" => FeatureType::Enhancer,
            "source" => FeatureType::Source,
            "primer_bind" | "primer" => FeatureType::Primer,
            "regulatory" => FeatureType::Regulatory,
            "sig_peptide" | "signal_peptide" | "transit_peptide" => FeatureType::Signal,
            "misc_feature" | "misc_binding" | "misc_difference" | "misc_recomb"
            | "misc_structure" | "misc_signal" => FeatureType::Misc,
            _ => FeatureType::Other,
        }
    }

    pub fn to_genbank_key(&self) -> &'static str {
        match self {
            FeatureType::Promoter => "promoter",
            FeatureType::Cds => "CDS",
            FeatureType::Terminator => "terminator",
            FeatureType::Ori => "rep_origin",
            FeatureType::RepOrigin => "rep_origin",
            FeatureType::Resistance => "CDS",
            FeatureType::Tag => "misc_feature",
            FeatureType::Rbs => "RBS",
            FeatureType::Enhancer => "enhancer",
            FeatureType::Gene => "gene",
            FeatureType::Mrna => "mRNA",
            FeatureType::Misc => "misc_feature",
            FeatureType::Source => "source",
            FeatureType::Primer => "primer_bind",
            FeatureType::Regulatory => "regulatory",
            FeatureType::Signal => "sig_peptide",
            FeatureType::Other => "misc_feature",
        }
    }

    pub fn default_color(&self) -> &'static str {
        match self {
            FeatureType::Promoter => "#2dd4a8",
            FeatureType::Cds => "#5b9cf5",
            FeatureType::Terminator => "#ef6b6b",
            FeatureType::Ori | FeatureType::RepOrigin => "#f0b429",
            FeatureType::Resistance => "#a78bfa",
            FeatureType::Tag => "#f472b6",
            FeatureType::Rbs => "#67e8f9",
            FeatureType::Gene => "#60a5fa",
            _ => "#9a9ba3",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Strand {
    Forward,
    Reverse,
    None,
}

impl Strand {
    pub fn as_i8(&self) -> i8 {
        match self {
            Strand::Forward => 1,
            Strand::Reverse => -1,
            Strand::None => 0,
        }
    }

    pub fn from_i8(v: i8) -> Self {
        match v {
            1 => Strand::Forward,
            -1 => Strand::Reverse,
            _ => Strand::None,
        }
    }
}

/// Represents the location of a feature on the sequence
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Location {
    /// Simple range: start..end
    Simple { start: usize, end: usize },
    /// Join of multiple ranges: join(1..100, 200..300)
    Join { ranges: Vec<(usize, usize)> },
    /// Complement of a location
    Complement { inner: Box<Location> },
}

impl Location {
    pub fn simple(start: usize, end: usize) -> Self {
        Location::Simple { start, end }
    }

    pub fn start(&self) -> usize {
        match self {
            Location::Simple { start, .. } => *start,
            Location::Join { ranges } => ranges.first().map(|r| r.0).unwrap_or(0),
            Location::Complement { inner } => inner.start(),
        }
    }

    pub fn end(&self) -> usize {
        match self {
            Location::Simple { end, .. } => *end,
            Location::Join { ranges } => ranges.last().map(|r| r.1).unwrap_or(0),
            Location::Complement { inner } => inner.end(),
        }
    }

    pub fn len(&self) -> usize {
        match self {
            Location::Simple { start, end } => end.saturating_sub(*start),
            Location::Join { ranges } => ranges.iter().map(|(s, e)| e.saturating_sub(*s)).sum(),
            Location::Complement { inner } => inner.len(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Qualifier {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub id: Uuid,
    pub name: String,
    pub feature_type: FeatureType,
    pub location: Location,
    pub strand: Strand,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub qualifiers: Vec<Qualifier>,
}

impl Feature {
    pub fn new(
        name: impl Into<String>,
        feature_type: FeatureType,
        start: usize,
        end: usize,
        strand: Strand,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            feature_type,
            location: Location::simple(start, end),
            strand,
            color: None,
            qualifiers: Vec::new(),
        }
    }

    pub fn start(&self) -> usize {
        self.location.start()
    }

    pub fn end(&self) -> usize {
        self.location.end()
    }

    pub fn effective_color(&self) -> &str {
        self.color
            .as_deref()
            .unwrap_or_else(|| self.feature_type.default_color())
    }

    pub fn get_qualifier(&self, key: &str) -> Option<&str> {
        self.qualifiers
            .iter()
            .find(|q| q.key == key)
            .map(|q| q.value.as_str())
    }

    pub fn add_qualifier(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.qualifiers.push(Qualifier {
            key: key.into(),
            value: value.into(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_type_from_genbank() {
        assert_eq!(FeatureType::from_genbank_key("CDS"), FeatureType::Cds);
        assert_eq!(
            FeatureType::from_genbank_key("promoter"),
            FeatureType::Promoter
        );
        assert_eq!(
            FeatureType::from_genbank_key("rep_origin"),
            FeatureType::RepOrigin
        );
        assert_eq!(
            FeatureType::from_genbank_key("unknown_type"),
            FeatureType::Other
        );
    }

    #[test]
    fn test_location_simple() {
        let loc = Location::simple(100, 500);
        assert_eq!(loc.start(), 100);
        assert_eq!(loc.end(), 500);
        assert_eq!(loc.len(), 400);
    }

    #[test]
    fn test_location_join() {
        let loc = Location::Join {
            ranges: vec![(100, 200), (300, 400)],
        };
        assert_eq!(loc.start(), 100);
        assert_eq!(loc.end(), 400);
        assert_eq!(loc.len(), 200);
    }

    #[test]
    fn test_feature_creation() {
        let f = Feature::new("GFP", FeatureType::Cds, 100, 800, Strand::Forward);
        assert_eq!(f.name, "GFP");
        assert_eq!(f.start(), 100);
        assert_eq!(f.end(), 800);
        assert_eq!(f.effective_color(), "#5b9cf5");
    }
}
