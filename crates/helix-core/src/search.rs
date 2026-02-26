use regex::Regex;

/// A match in the sequence
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SequenceMatch {
    pub start: usize,
    pub end: usize,
    pub matched: String,
    pub is_complement: bool,
}

/// Find exact pattern matches in a sequence (case-insensitive)
/// Handles circular sequences by doubling the search space
pub fn find_pattern(
    sequence: &str,
    pattern: &str,
    is_circular: bool,
) -> Vec<SequenceMatch> {
    let upper_seq = sequence.to_uppercase();
    let upper_pat = pattern.to_uppercase();
    let seq_len = upper_seq.len();

    if upper_pat.is_empty() || seq_len == 0 {
        return Vec::new();
    }

    let search_seq = if is_circular {
        format!("{}{}", upper_seq, &upper_seq[..upper_pat.len().min(seq_len).saturating_sub(1)])
    } else {
        upper_seq.clone()
    };

    let mut matches = Vec::new();

    // Forward strand
    let mut pos = 0;
    while let Some(idx) = search_seq[pos..].find(&upper_pat) {
        let abs_pos = pos + idx;
        if abs_pos < seq_len {
            matches.push(SequenceMatch {
                start: abs_pos,
                end: (abs_pos + upper_pat.len()) % seq_len,
                matched: upper_pat.clone(),
                is_complement: false,
            });
        }
        pos = abs_pos + 1;
    }

    // Reverse complement strand
    let rc_pat = crate::operations::reverse_complement(&upper_pat);
    if rc_pat != upper_pat {
        pos = 0;
        while let Some(idx) = search_seq[pos..].find(&rc_pat) {
            let abs_pos = pos + idx;
            if abs_pos < seq_len {
                matches.push(SequenceMatch {
                    start: abs_pos,
                    end: (abs_pos + rc_pat.len()) % seq_len,
                    matched: rc_pat.clone(),
                    is_complement: true,
                });
            }
            pos = abs_pos + 1;
        }
    }

    matches.sort_by_key(|m| m.start);
    matches
}

/// Find regex pattern matches in a sequence
pub fn find_regex(
    sequence: &str,
    pattern: &str,
    is_circular: bool,
) -> Result<Vec<SequenceMatch>, regex::Error> {
    let re = Regex::new(&format!("(?i){}", pattern))?;
    let seq_len = sequence.len();

    let search_seq = if is_circular {
        let extend_len = pattern.len().min(seq_len).saturating_sub(1);
        format!("{}{}", sequence.to_uppercase(), &sequence.to_uppercase()[..extend_len])
    } else {
        sequence.to_uppercase()
    };

    let mut matches = Vec::new();
    for m in re.find_iter(&search_seq) {
        if m.start() < seq_len {
            matches.push(SequenceMatch {
                start: m.start(),
                end: m.end() % seq_len,
                matched: m.as_str().to_string(),
                is_complement: false,
            });
        }
    }

    Ok(matches)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_pattern() {
        let matches = find_pattern("ATCGATCGATCG", "ATCG", false);
        // fwd: ATCG at pos 0, 4, 8 (3 matches)
        // RC:  CGAT at pos 2, 6 (2 matches)
        assert_eq!(matches.len(), 5);
        let fwd_count = matches.iter().filter(|m| !m.is_complement).count();
        let rc_count = matches.iter().filter(|m| m.is_complement).count();
        assert_eq!(fwd_count, 3);
        assert_eq!(rc_count, 2);
    }

    #[test]
    fn test_find_pattern_circular() {
        // Pattern wrapping around origin
        let matches = find_pattern("GGATCC", "CCGG", true);
        // "GGATCC" + "GGAT" (circular extension) = "GGATCCGGAT"
        // CCGG appears at position 4 wrapping
        assert!(matches.iter().any(|m| m.start == 4));
    }

    #[test]
    fn test_find_pattern_complement() {
        let matches = find_pattern("ATCGATCG", "CGAT", false);
        // CGAT appears at pos 2 and 6 (forward)
        // RC of CGAT = ATCG appears at pos 0 and 4 (complement)
        assert!(matches.len() >= 2);
    }

    #[test]
    fn test_find_regex() {
        let matches = find_regex("ATGAAAGGG", "ATG[A-Z]{3}G", false).unwrap();
        assert!(!matches.is_empty());
    }
}
