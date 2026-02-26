use std::collections::HashMap;

/// Standard and organism-specific codon tables
pub struct CodonTable {
    pub name: String,
    pub id: u8,
    table: HashMap<String, char>,
    start_codons: Vec<String>,
    stop_codons: Vec<String>,
}

impl CodonTable {
    /// Standard genetic code (NCBI table 1)
    pub fn standard() -> Self {
        let mut table = HashMap::new();
        let codons = [
            ("TTT", 'F'), ("TTC", 'F'), ("TTA", 'L'), ("TTG", 'L'),
            ("CTT", 'L'), ("CTC", 'L'), ("CTA", 'L'), ("CTG", 'L'),
            ("ATT", 'I'), ("ATC", 'I'), ("ATA", 'I'), ("ATG", 'M'),
            ("GTT", 'V'), ("GTC", 'V'), ("GTA", 'V'), ("GTG", 'V'),
            ("TCT", 'S'), ("TCC", 'S'), ("TCA", 'S'), ("TCG", 'S'),
            ("CCT", 'P'), ("CCC", 'P'), ("CCA", 'P'), ("CCG", 'P'),
            ("ACT", 'T'), ("ACC", 'T'), ("ACA", 'T'), ("ACG", 'T'),
            ("GCT", 'A'), ("GCC", 'A'), ("GCA", 'A'), ("GCG", 'A'),
            ("TAT", 'Y'), ("TAC", 'Y'), ("TAA", '*'), ("TAG", '*'),
            ("CAT", 'H'), ("CAC", 'H'), ("CAA", 'Q'), ("CAG", 'Q'),
            ("AAT", 'N'), ("AAC", 'N'), ("AAA", 'K'), ("AAG", 'K'),
            ("GAT", 'D'), ("GAC", 'D'), ("GAA", 'E'), ("GAG", 'E'),
            ("TGT", 'C'), ("TGC", 'C'), ("TGA", '*'), ("TGG", 'W'),
            ("CGT", 'R'), ("CGC", 'R'), ("CGA", 'R'), ("CGG", 'R'),
            ("AGT", 'S'), ("AGC", 'S'), ("AGA", 'R'), ("AGG", 'R'),
            ("GGT", 'G'), ("GGC", 'G'), ("GGA", 'G'), ("GGG", 'G'),
        ];

        for (codon, aa) in &codons {
            table.insert(codon.to_string(), *aa);
        }

        CodonTable {
            name: "Standard".to_string(),
            id: 1,
            table,
            start_codons: vec!["ATG".to_string(), "CTG".to_string(), "TTG".to_string()],
            stop_codons: vec!["TAA".to_string(), "TAG".to_string(), "TGA".to_string()],
        }
    }

    /// Bacterial/archaeal genetic code (NCBI table 11)
    pub fn bacterial() -> Self {
        // Same as standard for amino acids, different start codons
        let mut ct = Self::standard();
        ct.name = "Bacterial/Archaeal".to_string();
        ct.id = 11;
        ct.start_codons = vec![
            "ATG".to_string(),
            "GTG".to_string(),
            "TTG".to_string(),
            "CTG".to_string(),
            "ATT".to_string(),
            "ATC".to_string(),
            "ATA".to_string(),
        ];
        ct
    }

    /// Translate a single codon to an amino acid
    pub fn translate_codon(&self, codon: &str) -> char {
        self.table
            .get(&codon.to_uppercase())
            .copied()
            .unwrap_or('X')
    }

    pub fn is_start_codon(&self, codon: &str) -> bool {
        self.start_codons.contains(&codon.to_uppercase())
    }

    pub fn is_stop_codon(&self, codon: &str) -> bool {
        self.stop_codons.contains(&codon.to_uppercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_table() {
        let table = CodonTable::standard();
        assert_eq!(table.translate_codon("ATG"), 'M');
        assert_eq!(table.translate_codon("TAA"), '*');
        assert_eq!(table.translate_codon("GCT"), 'A');
        assert_eq!(table.translate_codon("XXX"), 'X');
    }

    #[test]
    fn test_start_stop_codons() {
        let table = CodonTable::standard();
        assert!(table.is_start_codon("ATG"));
        assert!(!table.is_start_codon("AAA"));
        assert!(table.is_stop_codon("TAA"));
        assert!(table.is_stop_codon("TAG"));
        assert!(table.is_stop_codon("TGA"));
    }

    #[test]
    fn test_bacterial_table() {
        let table = CodonTable::bacterial();
        assert!(table.is_start_codon("GTG"));
        assert!(table.is_start_codon("TTG"));
    }
}
