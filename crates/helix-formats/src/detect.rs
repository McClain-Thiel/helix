use crate::FileFormat;

/// Auto-detect file format from content
pub fn detect_format(content: &str) -> FileFormat {
    let trimmed = content.trim_start();

    if trimmed.starts_with("LOCUS") {
        FileFormat::GenBank
    } else if trimmed.starts_with('>') {
        FileFormat::Fasta
    } else if trimmed.starts_with("ID ") {
        FileFormat::Embl
    } else {
        FileFormat::Unknown
    }
}

/// Detect format from file extension
pub fn detect_format_from_extension(path: &str) -> FileFormat {
    let lower = path.to_lowercase();
    if lower.ends_with(".gb") || lower.ends_with(".gbk") || lower.ends_with(".genbank") {
        FileFormat::GenBank
    } else if lower.ends_with(".fa")
        || lower.ends_with(".fasta")
        || lower.ends_with(".fna")
        || lower.ends_with(".fsa")
    {
        FileFormat::Fasta
    } else if lower.ends_with(".embl") {
        FileFormat::Embl
    } else if lower.ends_with(".dna") {
        FileFormat::SnapGene
    } else {
        FileFormat::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_genbank() {
        assert_eq!(
            detect_format("LOCUS       pET28a    5369 bp"),
            FileFormat::GenBank
        );
    }

    #[test]
    fn test_detect_fasta() {
        assert_eq!(
            detect_format(">seq1\nATCGATCG"),
            FileFormat::Fasta
        );
    }

    #[test]
    fn test_detect_from_extension() {
        assert_eq!(detect_format_from_extension("test.gb"), FileFormat::GenBank);
        assert_eq!(detect_format_from_extension("test.fasta"), FileFormat::Fasta);
        assert_eq!(detect_format_from_extension("test.dna"), FileFormat::SnapGene);
    }
}
