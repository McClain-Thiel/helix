use crate::component::Component;

/// The component database, pre-parsed from the ApE default features file into CSV.
const COMPONENTS_CSV: &str = include_str!("../data/components.csv");

/// Parse the embedded CSV and return Components.
///
/// CSV columns: name, sequence, category, color, seq_type
/// seq_type is either "dna" or "protein".
pub fn builtin_components() -> Vec<Component> {
    let mut components = Vec::new();

    for line in COMPONENTS_CSV.lines().skip(1) {
        // skip header
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let fields = parse_csv_line(line);
        if fields.len() < 5 {
            continue;
        }

        let name = &fields[0];
        let sequence = &fields[1];
        let category = &fields[2];
        let color = &fields[3];
        let seq_type = &fields[4];

        if name.is_empty() || sequence.is_empty() {
            continue;
        }

        let description = format!("ApE default feature ({})", seq_type);

        components.push(Component {
            id: 0,
            name: name.to_string(),
            category: category.to_string(),
            sequence: sequence.to_string(),
            length: sequence.len(),
            description: Some(description),
            organism: None,
            is_builtin: true,
            accession: None,
            color: if color.is_empty() {
                None
            } else {
                Some(color.to_string())
            },
        });
    }

    components
}

/// Return only DNA components (for sequence alignment).
pub fn builtin_dna_components() -> Vec<Component> {
    let mut components = Vec::new();

    for line in COMPONENTS_CSV.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let fields = parse_csv_line(line);
        if fields.len() < 5 {
            continue;
        }

        if fields[4] != "dna" {
            continue;
        }

        let name = &fields[0];
        let sequence = &fields[1];
        let category = &fields[2];
        let color = &fields[3];

        if name.is_empty() || sequence.is_empty() {
            continue;
        }

        components.push(Component {
            id: 0,
            name: name.to_string(),
            category: category.to_string(),
            sequence: sequence.to_string(),
            length: sequence.len(),
            description: Some("ApE default feature (dna)".to_string()),
            organism: None,
            is_builtin: true,
            accession: None,
            color: if color.is_empty() {
                None
            } else {
                Some(color.to_string())
            },
        });
    }

    components
}

/// Simple CSV line parser that handles quoted fields.
fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    // Escaped quote
                    chars.next();
                    current.push('"');
                } else {
                    in_quotes = false;
                }
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == ',' {
            fields.push(current.clone());
            current.clear();
        } else {
            current.push(ch);
        }
    }
    fields.push(current);
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_components_parsed() {
        let components = builtin_components();
        assert!(
            components.len() >= 100,
            "Expected at least 100 components from CSV, got {}",
            components.len()
        );
        eprintln!("Parsed {} components from CSV", components.len());
    }

    #[test]
    fn test_dna_components_subset() {
        let all = builtin_components();
        let dna = builtin_dna_components();
        assert!(dna.len() < all.len(), "DNA subset should be smaller than all");
        assert!(
            dna.len() >= 30,
            "Expected at least 30 DNA components, got {}",
            dna.len()
        );
        eprintln!("DNA components: {}, total: {}", dna.len(), all.len());
    }

    #[test]
    fn test_sequences_non_empty() {
        for c in builtin_components() {
            assert!(!c.sequence.is_empty(), "Component {} has empty sequence", c.name);
            assert_eq!(c.length, c.sequence.len(), "Length mismatch for {}", c.name);
        }
    }

    #[test]
    fn test_dna_sequences_are_clean() {
        for c in builtin_dna_components() {
            for ch in c.sequence.chars() {
                assert!(
                    "ACGT".contains(ch),
                    "DNA component {} has non-ACGT character '{}' after cleaning",
                    c.name,
                    ch
                );
            }
        }
    }

    #[test]
    fn test_no_duplicate_names() {
        let components = builtin_components();
        let mut names: Vec<&str> = components.iter().map(|c| c.name.as_str()).collect();
        let total = names.len();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), total, "Found duplicate component names");
    }

    #[test]
    fn test_known_components_present() {
        let components = builtin_components();
        let names: Vec<&str> = components.iter().map(|c| c.name.as_str()).collect();

        assert!(names.contains(&"ColE1 origin"), "Missing ColE1 origin");
        assert!(names.contains(&"T7"), "Missing T7 primer");
        assert!(names.contains(&"AmpR"), "Missing AmpR");
        assert!(names.contains(&"EGFP"), "Missing EGFP");
    }

    #[test]
    fn test_csv_parser() {
        let line = r#"hello,world,"quoted,field",simple"#;
        let fields = parse_csv_line(line);
        assert_eq!(fields, vec!["hello", "world", "quoted,field", "simple"]);
    }
}
