use helix_core::{
    feature::{Feature, FeatureType, Location, Qualifier, Strand},
    sequence::{Reference, Sequence, SequenceMetadata, Topology},
};
// nom imported for future use in more robust parsing
#[allow(unused_imports)]
use nom::IResult;
use uuid::Uuid;

use crate::ParseError;

/// Parse a GenBank format string into a Sequence
pub fn parse(input: &str) -> Result<Sequence, ParseError> {
    let mut seq = Sequence::new("", "", Topology::Linear);
    seq.metadata = SequenceMetadata::default();

    let lines: Vec<&str> = input.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];

        if line.starts_with("LOCUS") {
            parse_locus_line(line, &mut seq);
        } else if line.starts_with("DEFINITION") {
            let mut def = line[12..].trim().to_string();
            i += 1;
            while i < lines.len() && lines[i].starts_with("            ") {
                def.push(' ');
                def.push_str(lines[i].trim());
                i += 1;
            }
            seq.metadata.definition = Some(def.trim_end_matches('.').to_string());
            seq.description = seq.metadata.definition.clone().unwrap_or_default();
            continue;
        } else if line.starts_with("ACCESSION") {
            seq.metadata.accession = Some(line[12..].trim().to_string());
        } else if line.starts_with("KEYWORDS") {
            seq.metadata.keywords = Some(line[12..].trim().to_string());
        } else if line.starts_with("SOURCE") {
            seq.metadata.source = Some(line[12..].trim().to_string());
            i += 1;
            // Read ORGANISM line if present
            if i < lines.len() && lines[i].trim_start().starts_with("ORGANISM") {
                seq.metadata.organism = Some(lines[i].trim_start()[8..].trim().to_string());
            }
            i += 1;
            // Skip taxonomy lines
            while i < lines.len()
                && !lines[i].starts_with(char::is_alphabetic)
                && !lines[i].starts_with("FEATURES")
                && !lines[i].starts_with("ORIGIN")
            {
                i += 1;
            }
            continue;
        } else if line.starts_with("COMMENT") {
            let mut comment = line[12..].trim().to_string();
            i += 1;
            while i < lines.len()
                && (lines[i].starts_with("            ") || lines[i].trim().is_empty())
                && !lines[i].starts_with("FEATURES")
            {
                if lines[i].trim().is_empty() {
                    comment.push('\n');
                } else {
                    comment.push(' ');
                    comment.push_str(lines[i].trim());
                }
                i += 1;
            }
            seq.metadata.comments.push(comment.trim().to_string());
            continue;
        } else if line.starts_with("REFERENCE") {
            let ref_result = parse_reference(&lines, &mut i);
            seq.metadata.references.push(ref_result);
            continue;
        } else if line.starts_with("FEATURES") {
            i += 1;
            parse_features(&lines, &mut i, &mut seq.features);
            continue;
        } else if line.starts_with("ORIGIN") {
            i += 1;
            seq.sequence = parse_origin(&lines, &mut i);
            continue;
        }

        i += 1;
    }

    Ok(seq)
}

fn parse_locus_line(line: &str, seq: &mut Sequence) {
    // LOCUS       name    length bp    type    topology    division    date
    let parts: Vec<&str> = line.split_whitespace().collect();

    if parts.len() >= 2 {
        seq.name = parts[1].to_string();
    }

    // Find topology
    for part in &parts {
        match *part {
            "circular" => seq.topology = Topology::Circular,
            "linear" => seq.topology = Topology::Linear,
            _ => {}
        }
    }

    // Find molecule type
    for part in &parts {
        let lower = part.to_lowercase();
        if lower.contains("dna") || lower.contains("rna") {
            seq.metadata.molecule_type = Some(part.to_string());
            break;
        }
    }

    // Find division (typically 3 letters after topology)
    if parts.len() >= 6 {
        for part in &parts[4..] {
            if part.len() == 3 && part.chars().all(|c| c.is_ascii_uppercase()) {
                seq.metadata.division = Some(part.to_string());
                break;
            }
        }
    }

    // Find date (last element, typically DD-MMM-YYYY)
    if let Some(last) = parts.last() {
        if last.contains('-') && last.len() >= 9 {
            seq.metadata.date = Some(last.to_string());
        }
    }
}

fn parse_reference(lines: &[&str], i: &mut usize) -> Reference {
    let line = lines[*i];
    let num_str = line[9..].trim().split_whitespace().next().unwrap_or("0");
    let number = num_str.parse().unwrap_or(0);

    let mut reference = Reference {
        number,
        authors: None,
        title: None,
        journal: None,
        pubmed: None,
    };

    *i += 1;
    while *i < lines.len() {
        let l = lines[*i];
        if l.starts_with("REFERENCE") || l.starts_with("FEATURES") || l.starts_with("COMMENT") || l.starts_with("ORIGIN") {
            break;
        }

        if l.starts_with("  AUTHORS") {
            let mut val = l[12..].trim().to_string();
            *i += 1;
            while *i < lines.len() && lines[*i].starts_with("            ") {
                val.push(' ');
                val.push_str(lines[*i].trim());
                *i += 1;
            }
            reference.authors = Some(val);
            continue;
        } else if l.starts_with("  TITLE") {
            let mut val = l[12..].trim().to_string();
            *i += 1;
            while *i < lines.len() && lines[*i].starts_with("            ") {
                val.push(' ');
                val.push_str(lines[*i].trim());
                *i += 1;
            }
            reference.title = Some(val);
            continue;
        } else if l.starts_with("  JOURNAL") {
            let mut val = l[12..].trim().to_string();
            *i += 1;
            while *i < lines.len() && lines[*i].starts_with("            ") {
                val.push(' ');
                val.push_str(lines[*i].trim());
                *i += 1;
            }
            reference.journal = Some(val);
            continue;
        } else if l.starts_with("   PUBMED") {
            reference.pubmed = Some(l[12..].trim().to_string());
        }

        *i += 1;
    }

    reference
}

fn parse_features(lines: &[&str], i: &mut usize, features: &mut Vec<Feature>) {
    while *i < lines.len() {
        let line = lines[*i];

        // End of features section
        if line.starts_with("ORIGIN") || line.starts_with("//") || line.starts_with("CONTIG") {
            break;
        }

        // Feature key line: starts at column 5 with feature key, location at column 21
        if line.len() > 5 && !line[..5].trim().is_empty() && !line.starts_with("FEATURES") {
            // Not a feature line (probably a header or other section)
            if line.starts_with(char::is_alphabetic)
                && !line.starts_with("     ")
            {
                break;
            }
        }

        if line.len() >= 21 && line.starts_with("     ") && !line[5..].starts_with(' ') {
            // This is a feature key line
            let key = line[5..21].trim();
            let mut location_str = line[21..].trim().to_string();

            // Read continuation lines for location
            *i += 1;
            while *i < lines.len()
                && lines[*i].starts_with("                     ")
                && !lines[*i][21..].trim_start().starts_with('/')
            {
                location_str.push_str(lines[*i][21..].trim());
                *i += 1;
            }

            // Parse qualifiers
            let mut qualifiers = Vec::new();
            while *i < lines.len()
                && lines[*i].starts_with("                     ")
                && lines[*i][21..].trim_start().starts_with('/')
            {
                let qual_line = lines[*i][21..].trim();
                let qual_content = &qual_line[1..]; // skip the /

                if let Some(eq_pos) = qual_content.find('=') {
                    let qkey = qual_content[..eq_pos].to_string();
                    let mut qval = qual_content[eq_pos + 1..].to_string();

                    // Read continuation lines
                    *i += 1;
                    while *i < lines.len()
                        && lines[*i].starts_with("                     ")
                        && !lines[*i][21..].trim_start().starts_with('/')
                    {
                        qval.push(' ');
                        qval.push_str(lines[*i][21..].trim());
                        *i += 1;
                    }

                    // Strip surrounding quotes
                    let qval = qval.trim_matches('"').to_string();
                    qualifiers.push(Qualifier {
                        key: qkey,
                        value: qval,
                    });
                } else {
                    // Flag qualifier (no value)
                    qualifiers.push(Qualifier {
                        key: qual_content.to_string(),
                        value: String::new(),
                    });
                    *i += 1;
                }
            }

            // Build the feature
            let (location, strand) = parse_location(&location_str);
            let feature_type = FeatureType::from_genbank_key(key);

            // Get name from qualifiers (prefer label, then gene, then product)
            let name = qualifiers
                .iter()
                .find(|q| q.key == "label")
                .or_else(|| qualifiers.iter().find(|q| q.key == "gene"))
                .or_else(|| qualifiers.iter().find(|q| q.key == "product"))
                .or_else(|| qualifiers.iter().find(|q| q.key == "note"))
                .map(|q| q.value.clone())
                .unwrap_or_else(|| key.to_string());

            // Get color from qualifiers
            let color = qualifiers
                .iter()
                .find(|q| q.key == "ApEinfo_fwdcolor" || q.key == "color")
                .map(|q| q.value.clone());

            features.push(Feature {
                id: Uuid::new_v4(),
                name,
                feature_type,
                location,
                strand,
                color,
                qualifiers,
            });
        } else {
            *i += 1;
        }
    }
}

fn parse_location(loc_str: &str) -> (Location, Strand) {
    let trimmed = loc_str.trim();

    // complement(...)
    if trimmed.starts_with("complement(") && trimmed.ends_with(')') {
        let inner = &trimmed[11..trimmed.len() - 1];
        let (loc, _) = parse_location(inner);
        return (loc, Strand::Reverse);
    }

    // join(...)
    if trimmed.starts_with("join(") && trimmed.ends_with(')') {
        let inner = &trimmed[5..trimmed.len() - 1];
        let ranges: Vec<(usize, usize)> = inner
            .split(',')
            .filter_map(|part| parse_simple_range(part.trim()))
            .collect();
        if ranges.is_empty() {
            return (Location::simple(0, 0), Strand::Forward);
        }
        return (Location::Join { ranges }, Strand::Forward);
    }

    // order(...)
    if trimmed.starts_with("order(") && trimmed.ends_with(')') {
        let inner = &trimmed[6..trimmed.len() - 1];
        let ranges: Vec<(usize, usize)> = inner
            .split(',')
            .filter_map(|part| parse_simple_range(part.trim()))
            .collect();
        return (Location::Join { ranges }, Strand::Forward);
    }

    // Simple range: start..end
    if let Some((start, end)) = parse_simple_range(trimmed) {
        return (Location::simple(start, end), Strand::Forward);
    }

    // Single position
    if let Ok(pos) = trimmed.replace(['<', '>'], "").parse::<usize>() {
        let pos = pos.saturating_sub(1); // GenBank is 1-based
        return (Location::simple(pos, pos + 1), Strand::Forward);
    }

    (Location::simple(0, 0), Strand::Forward)
}

fn parse_simple_range(s: &str) -> Option<(usize, usize)> {
    // Handle formats like: 100..200, <100..>200, 100..200
    let cleaned = s.replace(['<', '>'], "");
    let parts: Vec<&str> = cleaned.split("..").collect();
    if parts.len() == 2 {
        let start = parts[0].trim().parse::<usize>().ok()?;
        let end = parts[1].trim().parse::<usize>().ok()?;
        // Convert from 1-based inclusive to 0-based exclusive
        Some((start.saturating_sub(1), end))
    } else {
        None
    }
}

fn parse_origin(lines: &[&str], i: &mut usize) -> String {
    let mut seq = String::new();

    while *i < lines.len() {
        let line = lines[*i];
        if line.starts_with("//") {
            break;
        }

        // Origin lines: "        1 atcgatcg atcgatcg ..."
        for ch in line.chars() {
            if ch.is_ascii_alphabetic() {
                seq.push(ch.to_ascii_uppercase());
            }
        }

        *i += 1;
    }

    seq
}

/// Serialize a Sequence back to GenBank format
pub fn serialize(seq: &Sequence) -> String {
    let mut out = String::new();

    // LOCUS line
    let mol_type = seq
        .metadata
        .molecule_type
        .as_deref()
        .unwrap_or("DNA");
    let topology = seq.topology.to_string();
    let division = seq.metadata.division.as_deref().unwrap_or("SYN");
    let date = seq
        .metadata
        .date
        .as_deref()
        .unwrap_or("01-JAN-2026");

    out.push_str(&format!(
        "LOCUS       {:<16} {} bp    {}     {}       {} {}\n",
        seq.name,
        seq.len(),
        mol_type,
        topology,
        division,
        date
    ));

    // DEFINITION
    if !seq.description.is_empty() {
        out.push_str(&format!("DEFINITION  {}.\n", seq.description));
    }

    // ACCESSION
    if let Some(acc) = &seq.metadata.accession {
        out.push_str(&format!("ACCESSION   {}\n", acc));
    }

    // KEYWORDS
    if let Some(kw) = &seq.metadata.keywords {
        out.push_str(&format!("KEYWORDS    {}\n", kw));
    }

    // SOURCE
    if let Some(src) = &seq.metadata.source {
        out.push_str(&format!("SOURCE      {}\n", src));
        if let Some(org) = &seq.metadata.organism {
            out.push_str(&format!("  ORGANISM  {}\n", org));
        }
    }

    // REFERENCES
    for r in &seq.metadata.references {
        out.push_str(&format!("REFERENCE   {}\n", r.number));
        if let Some(authors) = &r.authors {
            out.push_str(&format!("  AUTHORS   {}\n", authors));
        }
        if let Some(title) = &r.title {
            out.push_str(&format!("  TITLE     {}\n", title));
        }
        if let Some(journal) = &r.journal {
            out.push_str(&format!("  JOURNAL   {}\n", journal));
        }
        if let Some(pubmed) = &r.pubmed {
            out.push_str(&format!("   PUBMED   {}\n", pubmed));
        }
    }

    // COMMENTS
    for comment in &seq.metadata.comments {
        out.push_str(&format!("COMMENT     {}\n", comment));
    }

    // FEATURES
    if !seq.features.is_empty() {
        out.push_str("FEATURES             Location/Qualifiers\n");

        for feat in &seq.features {
            let key = feat.feature_type.to_genbank_key();
            let loc_str = serialize_location(&feat.location, &feat.strand);
            out.push_str(&format!("     {:<16}{}\n", key, loc_str));

            for q in &feat.qualifiers {
                if q.value.is_empty() {
                    out.push_str(&format!("                     /{}\n", q.key));
                } else if q.key == "codon_start"
                    || q.key == "transl_table"
                    || q.value.parse::<f64>().is_ok()
                {
                    out.push_str(&format!("                     /{}={}\n", q.key, q.value));
                } else {
                    out.push_str(&format!("                     /{}=\"{}\"\n", q.key, q.value));
                }
            }
        }
    }

    // ORIGIN
    out.push_str("ORIGIN\n");
    let bases: Vec<char> = seq.sequence.to_lowercase().chars().collect();
    for (chunk_idx, chunk) in bases.chunks(60).enumerate() {
        let pos = chunk_idx * 60 + 1;
        out.push_str(&format!("{:>9}", pos));

        for (_sub_idx, sub_chunk) in chunk.chunks(10).enumerate() {
            out.push(' ');
            let s: String = sub_chunk.iter().collect();
            out.push_str(&s);
        }
        out.push('\n');
    }

    out.push_str("//\n");
    out
}

fn serialize_location(loc: &Location, strand: &Strand) -> String {
    let loc_str = match loc {
        Location::Simple { start, end } => {
            format!("{}..{}", start + 1, end) // back to 1-based
        }
        Location::Join { ranges } => {
            let parts: Vec<String> = ranges
                .iter()
                .map(|(s, e)| format!("{}..{}", s + 1, e))
                .collect();
            format!("join({})", parts.join(","))
        }
        Location::Complement { inner } => {
            return format!("complement({})", serialize_location(inner, &Strand::Forward));
        }
    };

    match strand {
        Strand::Reverse => format!("complement({})", loc_str),
        _ => loc_str,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINI_GENBANK: &str = r#"LOCUS       pTest           100 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Test plasmid.
ACCESSION   .
KEYWORDS    .
SOURCE      synthetic construct
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     promoter        1..20
                     /label="test promoter"
     CDS             complement(30..90)
                     /label="GFP"
                     /gene="gfp"
                     /codon_start=1
ORIGIN
        1 atcgatcgat cgatcgatcg atcgatcgat cgatcgatcg atcgatcgat
       51 cgatcgatcg atcgatcgat cgatcgatcg atcgatcgat cgatcgatcg
//
"#;

    #[test]
    fn test_parse_mini_genbank() {
        let seq = parse(MINI_GENBANK).unwrap();
        assert_eq!(seq.name, "pTest");
        assert_eq!(seq.topology, Topology::Circular);
        assert_eq!(seq.len(), 100);
        assert_eq!(seq.features.len(), 2);
    }

    #[test]
    fn test_parse_features() {
        let seq = parse(MINI_GENBANK).unwrap();

        let promoter = &seq.features[0];
        assert_eq!(promoter.name, "test promoter");
        assert_eq!(promoter.feature_type, FeatureType::Promoter);
        assert_eq!(promoter.start(), 0);
        assert_eq!(promoter.end(), 20);
        assert_eq!(promoter.strand, Strand::Forward);

        let cds = &seq.features[1];
        assert_eq!(cds.name, "GFP");
        assert_eq!(cds.feature_type, FeatureType::Cds);
        assert_eq!(cds.start(), 29);
        assert_eq!(cds.end(), 90);
        assert_eq!(cds.strand, Strand::Reverse);
    }

    #[test]
    fn test_parse_origin() {
        let seq = parse(MINI_GENBANK).unwrap();
        assert!(seq.sequence.starts_with("ATCGATCG"));
        assert_eq!(seq.len(), 100);
    }

    #[test]
    fn test_roundtrip() {
        let seq = parse(MINI_GENBANK).unwrap();
        let serialized = serialize(&seq);
        let reparsed = parse(&serialized).unwrap();

        assert_eq!(reparsed.name, seq.name);
        assert_eq!(reparsed.topology, seq.topology);
        assert_eq!(reparsed.sequence, seq.sequence);
        assert_eq!(reparsed.features.len(), seq.features.len());
    }

    #[test]
    fn test_parse_location_simple() {
        let (loc, strand) = parse_location("100..200");
        assert_eq!(loc.start(), 99);
        assert_eq!(loc.end(), 200);
        assert_eq!(strand, Strand::Forward);
    }

    #[test]
    fn test_parse_location_complement() {
        let (loc, strand) = parse_location("complement(100..200)");
        assert_eq!(loc.start(), 99);
        assert_eq!(loc.end(), 200);
        assert_eq!(strand, Strand::Reverse);
    }

    #[test]
    fn test_parse_location_join() {
        let (loc, strand) = parse_location("join(100..200,300..400)");
        assert_eq!(strand, Strand::Forward);
        if let Location::Join { ranges } = loc {
            assert_eq!(ranges.len(), 2);
            assert_eq!(ranges[0], (99, 200));
            assert_eq!(ranges[1], (299, 400));
        } else {
            panic!("Expected Join location");
        }
    }
}
