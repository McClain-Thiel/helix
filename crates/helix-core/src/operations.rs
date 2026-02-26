use crate::codon::CodonTable;

/// Complement a single DNA base
pub fn complement_base(base: char) -> char {
    match base.to_ascii_uppercase() {
        'A' => 'T',
        'T' => 'A',
        'G' => 'C',
        'C' => 'G',
        'R' => 'Y',
        'Y' => 'R',
        'S' => 'S',
        'W' => 'W',
        'K' => 'M',
        'M' => 'K',
        'B' => 'V',
        'V' => 'B',
        'D' => 'H',
        'H' => 'D',
        'N' => 'N',
        other => other,
    }
}

/// Reverse complement of a DNA sequence
pub fn reverse_complement(seq: &str) -> String {
    seq.chars().rev().map(complement_base).collect()
}

/// Translate a DNA sequence to amino acids using the given codon table
pub fn translate(seq: &str, table: &CodonTable) -> String {
    let bases: Vec<char> = seq.to_uppercase().chars().collect();
    let mut protein = String::with_capacity(bases.len() / 3);

    for chunk in bases.chunks(3) {
        if chunk.len() == 3 {
            let codon: String = chunk.iter().collect();
            protein.push(table.translate_codon(&codon));
        }
    }

    protein
}

/// Calculate GC content as a fraction (0.0 to 1.0)
pub fn gc_content(seq: &str) -> f64 {
    if seq.is_empty() {
        return 0.0;
    }
    let gc_count = seq
        .chars()
        .filter(|c| matches!(c.to_ascii_uppercase(), 'G' | 'C'))
        .count();
    gc_count as f64 / seq.len() as f64
}

/// Calculate windowed GC content
pub fn gc_content_windowed(seq: &str, window_size: usize, step: usize) -> Vec<(usize, f64)> {
    if seq.len() < window_size || window_size == 0 || step == 0 {
        return Vec::new();
    }

    let mut results = Vec::new();
    let mut pos = 0;

    while pos + window_size <= seq.len() {
        let window = &seq[pos..pos + window_size];
        results.push((pos, gc_content(window)));
        pos += step;
    }

    results
}

/// Open reading frame result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Orf {
    pub start: usize,
    pub end: usize,
    pub frame: i8,
    pub length_aa: usize,
    pub protein: String,
}

/// Find open reading frames in a sequence
pub fn find_orfs(seq: &str, min_length_aa: usize) -> Vec<Orf> {
    let table = CodonTable::standard();
    let upper = seq.to_uppercase();
    let bases: Vec<char> = upper.chars().collect();
    let mut orfs = Vec::new();

    // Forward frames (1, 2, 3)
    for frame_offset in 0..3 {
        find_orfs_in_frame(&bases, frame_offset, (frame_offset + 1) as i8, min_length_aa, &table, &mut orfs);
    }

    // Reverse frames (-1, -2, -3)
    let rc = reverse_complement(&upper);
    let rc_bases: Vec<char> = rc.chars().collect();
    for frame_offset in 0..3 {
        let mut frame_orfs = Vec::new();
        find_orfs_in_frame(&rc_bases, frame_offset, -(frame_offset as i8 + 1), min_length_aa, &table, &mut frame_orfs);
        // Remap positions to the forward strand
        for orf in &mut frame_orfs {
            let new_start = bases.len() - orf.end;
            let new_end = bases.len() - orf.start;
            orf.start = new_start;
            orf.end = new_end;
        }
        orfs.extend(frame_orfs);
    }

    orfs.sort_by_key(|o| o.start);
    orfs
}

fn find_orfs_in_frame(
    bases: &[char],
    offset: usize,
    frame: i8,
    min_length_aa: usize,
    table: &CodonTable,
    orfs: &mut Vec<Orf>,
) {
    let mut i = offset;
    while i + 2 < bases.len() {
        let codon: String = bases[i..i + 3].iter().collect();
        if table.is_start_codon(&codon) {
            let start = i;
            let mut protein = String::new();
            let mut j = i;
            let mut found_stop = false;

            while j + 2 < bases.len() {
                let c: String = bases[j..j + 3].iter().collect();
                let aa = table.translate_codon(&c);
                if aa == '*' {
                    found_stop = true;
                    j += 3;
                    break;
                }
                protein.push(aa);
                j += 3;
            }

            if found_stop && protein.len() >= min_length_aa {
                orfs.push(Orf {
                    start,
                    end: j,
                    frame,
                    length_aa: protein.len(),
                    protein,
                });
            }
            i = j;
        } else {
            i += 3;
        }
    }
}

/// Insert bases at a position
pub fn insert_bases(seq: &str, position: usize, bases: &str) -> String {
    let pos = position.min(seq.len());
    let mut result = String::with_capacity(seq.len() + bases.len());
    result.push_str(&seq[..pos]);
    result.push_str(bases);
    result.push_str(&seq[pos..]);
    result
}

/// Delete bases at a range
pub fn delete_bases(seq: &str, start: usize, length: usize) -> String {
    let start = start.min(seq.len());
    let end = (start + length).min(seq.len());
    let mut result = String::with_capacity(seq.len() - (end - start));
    result.push_str(&seq[..start]);
    result.push_str(&seq[end..]);
    result
}

/// Replace bases at a range
pub fn replace_bases(seq: &str, start: usize, length: usize, replacement: &str) -> String {
    let start = start.min(seq.len());
    let end = (start + length).min(seq.len());
    let mut result = String::with_capacity(seq.len() - (end - start) + replacement.len());
    result.push_str(&seq[..start]);
    result.push_str(replacement);
    result.push_str(&seq[end..]);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_complement_base() {
        assert_eq!(complement_base('A'), 'T');
        assert_eq!(complement_base('T'), 'A');
        assert_eq!(complement_base('G'), 'C');
        assert_eq!(complement_base('C'), 'G');
    }

    #[test]
    fn test_reverse_complement() {
        assert_eq!(reverse_complement("ATCGATCG"), "CGATCGAT");
        assert_eq!(reverse_complement("AAAAAA"), "TTTTTT");
        assert_eq!(reverse_complement(""), "");
    }

    #[test]
    fn test_translate() {
        let table = CodonTable::standard();
        assert_eq!(translate("ATGAAATTT", &table), "MKF");
        assert_eq!(translate("ATGTAA", &table), "M*");
        assert_eq!(translate("AT", &table), ""); // incomplete codon
    }

    #[test]
    fn test_gc_content() {
        assert!((gc_content("ATCG") - 0.5).abs() < f64::EPSILON);
        assert!((gc_content("GGCC") - 1.0).abs() < f64::EPSILON);
        assert!((gc_content("AATT") - 0.0).abs() < f64::EPSILON);
        assert!((gc_content("") - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_gc_content_windowed() {
        let result = gc_content_windowed("ATCGATCG", 4, 2);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].0, 0);
        assert!((result[0].1 - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn test_find_orfs() {
        // ATG (start) + AAA (K) + TGA (stop) = small ORF
        let orfs = find_orfs("ATGAAATGA", 0);
        assert!(!orfs.is_empty());
        assert_eq!(orfs[0].protein, "MK");
    }

    #[test]
    fn test_insert_bases() {
        assert_eq!(insert_bases("AACCTTGG", 4, "XX"), "AACCXXTTGG");
        assert_eq!(insert_bases("AABB", 0, "XX"), "XXAABB");
        assert_eq!(insert_bases("AABB", 4, "XX"), "AABBXX");
    }

    #[test]
    fn test_delete_bases() {
        assert_eq!(delete_bases("AACCTTGG", 2, 4), "AAGG");
        assert_eq!(delete_bases("AABB", 0, 2), "BB");
    }

    #[test]
    fn test_replace_bases() {
        assert_eq!(replace_bases("AACCTTGG", 2, 4, "XX"), "AAXXGG");
    }
}
