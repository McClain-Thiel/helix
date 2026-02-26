use helix_core::alignment::{align_both_strands, ScoringParams};

use crate::component::Component;

/// Configuration for the auto-annotation engine.
#[derive(Debug, Clone)]
pub struct AnnotationConfig {
    /// Minimum percent identity to report a hit (0-100).
    pub min_identity: f64,
    /// Minimum query coverage to report a hit (0-100).
    pub min_coverage: f64,
    /// Smith-Waterman scoring parameters.
    pub scoring: ScoringParams,
    /// Band width for banded alignment (None = full matrix).
    pub band_width: Option<usize>,
    /// Minimum alignment score to even consider a hit.
    pub min_score: i32,
}

impl Default for AnnotationConfig {
    fn default() -> Self {
        Self {
            min_identity: 80.0,
            min_coverage: 80.0,
            scoring: ScoringParams::default(),
            band_width: Some(50),
            min_score: 20,
        }
    }
}

/// A single annotation hit: a known component found in the target sequence.
#[derive(Debug, Clone)]
pub struct AnnotationHit {
    /// Name of the matched component.
    pub component_name: String,
    /// Database ID of the component.
    pub component_id: i64,
    /// Category (promoter, ori, cds, etc.).
    pub category: String,
    /// Start position in the target (0-based, inclusive).
    pub target_start: usize,
    /// End position in the target (0-based, exclusive).
    pub target_end: usize,
    /// Whether the hit is on the reverse complement strand.
    pub is_reverse_complement: bool,
    /// Percent identity of the alignment.
    pub percent_identity: f64,
    /// Query coverage of the alignment.
    pub query_coverage: f64,
    /// Raw alignment score.
    pub alignment_score: i32,
    /// Display color from the component database.
    pub color: Option<String>,
}

/// Annotate a target sequence against a set of known components.
///
/// Runs Smith-Waterman alignment of each component's sequence against the
/// target (both strands), filters by identity/coverage thresholds, and
/// resolves overlapping hits (keeping the best score per region).
///
/// Only DNA components are aligned (protein components are skipped).
pub fn annotate(
    target: &str,
    _is_circular: bool,
    components: &[Component],
    config: &AnnotationConfig,
) -> Vec<AnnotationHit> {
    let target_bytes = target.as_bytes();
    let mut hits = Vec::new();

    for component in components {
        // Skip protein sequences — we only do DNA alignment here
        if !is_dna_sequence(&component.sequence) {
            continue;
        }

        let query = component.sequence.as_bytes();

        let result = align_both_strands(
            query,
            target_bytes,
            &config.scoring,
            config.band_width,
            config.min_score,
        );

        if let Some((alignment, is_rc)) = result {
            let identity = alignment.percent_identity();
            let coverage = alignment.query_coverage(query.len());

            if identity >= config.min_identity && coverage >= config.min_coverage {
                let (start, end) = if is_rc {
                    // For reverse complement hits, convert coordinates back
                    let target_len = target_bytes.len();
                    let rc_start = target_len - alignment.target_end;
                    let rc_end = target_len - alignment.target_start;
                    (rc_start, rc_end)
                } else {
                    (alignment.target_start, alignment.target_end)
                };

                hits.push(AnnotationHit {
                    component_name: component.name.clone(),
                    component_id: component.id,
                    category: component.category.clone(),
                    target_start: start,
                    target_end: end,
                    is_reverse_complement: is_rc,
                    percent_identity: identity,
                    query_coverage: coverage,
                    alignment_score: alignment.score,
                    color: component.color.clone(),
                });
            }
        }
    }

    // Sort by score descending, then resolve overlaps
    hits.sort_by(|a, b| b.alignment_score.cmp(&a.alignment_score));
    resolve_overlaps(hits)
}

/// Check if a sequence is DNA (contains only ACGT characters).
fn is_dna_sequence(seq: &str) -> bool {
    seq.chars()
        .all(|c| matches!(c.to_ascii_uppercase(), 'A' | 'C' | 'G' | 'T'))
}

/// Resolve overlapping hits by keeping the best-scoring hit for each region.
///
/// Uses a greedy interval scheduling approach: iterate hits by descending
/// score, and only keep a hit if it doesn't overlap significantly (>50%)
/// with any already-accepted hit.
fn resolve_overlaps(hits: Vec<AnnotationHit>) -> Vec<AnnotationHit> {
    let mut accepted: Vec<AnnotationHit> = Vec::new();

    for hit in hits {
        let dominated = accepted.iter().any(|existing| {
            let overlap = overlap_fraction(&hit, existing);
            overlap > 0.5
        });

        if !dominated {
            accepted.push(hit);
        }
    }

    // Sort final result by position
    accepted.sort_by_key(|h| h.target_start);
    accepted
}

/// Calculate the fraction of `a` that overlaps with `b`.
fn overlap_fraction(a: &AnnotationHit, b: &AnnotationHit) -> f64 {
    let start = a.target_start.max(b.target_start);
    let end = a.target_end.min(b.target_end);

    if start >= end {
        return 0.0;
    }

    let overlap_len = end - start;
    let a_len = a.target_end - a.target_start;

    if a_len == 0 {
        return 0.0;
    }

    overlap_len as f64 / a_len as f64
}

/// Convert annotation hits to helix-core Features for integration into a Sequence.
pub fn hits_to_features(
    hits: &[AnnotationHit],
) -> Vec<(String, String, usize, usize, bool, Option<String>)> {
    hits.iter()
        .map(|h| {
            (
                h.component_name.clone(),
                h.category.clone(),
                h.target_start,
                h.target_end,
                h.is_reverse_complement,
                h.color.clone(),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_component(name: &str, category: &str, sequence: &str) -> Component {
        Component {
            id: 1,
            name: name.to_string(),
            category: category.to_string(),
            sequence: sequence.to_string(),
            length: sequence.len(),
            description: None,
            organism: None,
            is_builtin: true,
            accession: None,
            color: Some("#ff0000".to_string()),
        }
    }

    #[test]
    fn test_annotate_exact_match() {
        let component_seq = "ACGTACGTACGTACGTACGT";
        let target = format!("TTTTTTTTTT{}TTTTTTTTTT", component_seq);

        let components = vec![make_component("TestPart", "cds", component_seq)];
        let config = AnnotationConfig {
            min_identity: 90.0,
            min_coverage: 90.0,
            ..Default::default()
        };

        let hits = annotate(&target, false, &components, &config);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].component_name, "TestPart");
        assert_eq!(hits[0].target_start, 10);
        assert_eq!(hits[0].target_end, 30);
        assert!(!hits[0].is_reverse_complement);
        assert!((hits[0].percent_identity - 100.0).abs() < 0.1);
    }

    #[test]
    fn test_annotate_no_match() {
        let target = "AAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        let components = vec![make_component("TestPart", "cds", "CCCCCCCCCCCCCCCCCCCC")];
        let config = AnnotationConfig::default();

        let hits = annotate(target, false, &components, &config);
        assert!(hits.is_empty());
    }

    #[test]
    fn test_annotate_reverse_complement() {
        // Component is ACGTACGTACGTACGT
        // RC is ACGTACGTACGTACGT (palindromic — use non-palindromic)
        let component_seq = "AAACCCGGGAAACCCGGGAAA";
        // RC = TTTCCCGGGTTTCCCGGGTTT
        let rc_seq = "TTTCCCGGGTTTCCCGGGTTT";
        let target = format!("TTTTTTTTTT{}TTTTTTTTTT", rc_seq);

        let components = vec![make_component("TestRC", "cds", component_seq)];
        let config = AnnotationConfig {
            min_identity: 90.0,
            min_coverage: 90.0,
            ..Default::default()
        };

        let hits = annotate(&target, false, &components, &config);
        assert_eq!(hits.len(), 1);
        assert!(hits[0].is_reverse_complement);
    }

    #[test]
    fn test_annotate_skips_protein() {
        let target = "ACGTACGTACGTACGTACGT";
        let components = vec![make_component("ProteinPart", "cds", "MFCTFFEKHHRKWDIL")];
        let config = AnnotationConfig::default();

        let hits = annotate(target, false, &components, &config);
        assert!(hits.is_empty(), "Protein components should be skipped");
    }

    #[test]
    fn test_is_dna_sequence() {
        assert!(is_dna_sequence("ACGTACGT"));
        assert!(is_dna_sequence("acgtACGT"));
        assert!(!is_dna_sequence("MFCTFFEK"));
        assert!(!is_dna_sequence("ACGTXACGT"));
    }

    #[test]
    fn test_overlap_resolution() {
        // Two overlapping hits — the higher-scoring one should win
        let hit_a = AnnotationHit {
            component_name: "PartA".to_string(),
            component_id: 1,
            category: "cds".to_string(),
            target_start: 10,
            target_end: 50,
            is_reverse_complement: false,
            percent_identity: 95.0,
            query_coverage: 100.0,
            alignment_score: 80,
            color: None,
        };
        let hit_b = AnnotationHit {
            component_name: "PartB".to_string(),
            component_id: 2,
            category: "cds".to_string(),
            target_start: 15,
            target_end: 55,
            is_reverse_complement: false,
            percent_identity: 90.0,
            query_coverage: 100.0,
            alignment_score: 60,
            color: None,
        };

        let resolved = resolve_overlaps(vec![hit_a, hit_b]);
        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved[0].component_name, "PartA");
    }

    #[test]
    fn test_non_overlapping_hits_kept() {
        let hit_a = AnnotationHit {
            component_name: "PartA".to_string(),
            component_id: 1,
            category: "cds".to_string(),
            target_start: 0,
            target_end: 20,
            is_reverse_complement: false,
            percent_identity: 95.0,
            query_coverage: 100.0,
            alignment_score: 40,
            color: None,
        };
        let hit_b = AnnotationHit {
            component_name: "PartB".to_string(),
            component_id: 2,
            category: "ori".to_string(),
            target_start: 100,
            target_end: 150,
            is_reverse_complement: false,
            percent_identity: 90.0,
            query_coverage: 100.0,
            alignment_score: 50,
            color: None,
        };

        let resolved = resolve_overlaps(vec![hit_b, hit_a]);
        assert_eq!(resolved.len(), 2);
    }
}
