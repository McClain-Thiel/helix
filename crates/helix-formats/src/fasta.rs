use helix_core::sequence::{Sequence, Topology};

use crate::ParseError;

/// Parse a FASTA format string into one or more Sequences
pub fn parse(input: &str) -> Result<Vec<Sequence>, ParseError> {
    let mut sequences = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_desc: Option<String> = None;
    let mut current_seq = String::new();

    for line in input.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with('>') {
            // Save previous sequence if exists
            if let Some(name) = current_name.take() {
                if !current_seq.is_empty() {
                    let mut seq = Sequence::new(
                        name,
                        std::mem::take(&mut current_seq),
                        Topology::Linear,
                    );
                    if let Some(desc) = current_desc.take() {
                        seq.description = desc;
                    }
                    sequences.push(seq);
                }
            }

            // Parse header
            let header = &trimmed[1..];
            let parts: Vec<&str> = header.splitn(2, |c: char| c.is_whitespace()).collect();
            current_name = Some(parts[0].to_string());
            current_desc = parts.get(1).map(|s| s.to_string());
            current_seq = String::new();
        } else if trimmed.starts_with(';') {
            // Comment line, skip
            continue;
        } else {
            // Sequence line
            current_seq.push_str(
                &trimmed
                    .chars()
                    .filter(|c| c.is_ascii_alphabetic())
                    .collect::<String>()
                    .to_uppercase(),
            );
        }
    }

    // Don't forget the last sequence
    if let Some(name) = current_name {
        if !current_seq.is_empty() {
            let mut seq = Sequence::new(name, current_seq, Topology::Linear);
            if let Some(desc) = current_desc {
                seq.description = desc;
            }
            sequences.push(seq);
        }
    }

    if sequences.is_empty() {
        return Err(ParseError::InvalidFormat(
            "No sequences found in FASTA input".to_string(),
        ));
    }

    Ok(sequences)
}

/// Serialize sequences to FASTA format
pub fn serialize(sequences: &[Sequence]) -> String {
    let mut out = String::new();

    for seq in sequences {
        // Header
        out.push('>');
        out.push_str(&seq.name);
        if !seq.description.is_empty() {
            out.push(' ');
            out.push_str(&seq.description);
        }
        out.push('\n');

        // Sequence in 80-character lines
        for chunk in seq.sequence.as_bytes().chunks(80) {
            out.push_str(&String::from_utf8_lossy(chunk));
            out.push('\n');
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_single_sequence() {
        let input = ">seq1 A test sequence\nATCGATCG\nGGCCTTAA\n";
        let seqs = parse(input).unwrap();
        assert_eq!(seqs.len(), 1);
        assert_eq!(seqs[0].name, "seq1");
        assert_eq!(seqs[0].description, "A test sequence");
        assert_eq!(seqs[0].sequence, "ATCGATCGGGCCTTAA");
    }

    #[test]
    fn test_parse_multi_sequence() {
        let input = ">seq1\nATCG\n>seq2\nGGCC\n>seq3\nTTAA\n";
        let seqs = parse(input).unwrap();
        assert_eq!(seqs.len(), 3);
        assert_eq!(seqs[0].sequence, "ATCG");
        assert_eq!(seqs[1].sequence, "GGCC");
        assert_eq!(seqs[2].sequence, "TTAA");
    }

    #[test]
    fn test_roundtrip() {
        let input = ">test A test\nATCGATCGATCGATCG\n";
        let seqs = parse(input).unwrap();
        let serialized = serialize(&seqs);
        let reparsed = parse(&serialized).unwrap();
        assert_eq!(seqs[0].sequence, reparsed[0].sequence);
    }

    #[test]
    fn test_empty_input() {
        assert!(parse("").is_err());
        assert!(parse("> \n").is_err());
    }
}
