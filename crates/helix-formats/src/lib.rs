pub mod detect;
pub mod fasta;
pub mod genbank;

use helix_core::Sequence;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("Invalid format: {0}")]
    InvalidFormat(String),
    #[error("Unexpected end of input")]
    UnexpectedEnd,
    #[error("Invalid location: {0}")]
    InvalidLocation(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileFormat {
    GenBank,
    Fasta,
    Embl,
    SnapGene,
    Unknown,
}

/// Parse a file based on detected format
pub fn parse_file(content: &str) -> Result<Vec<Sequence>, ParseError> {
    match detect::detect_format(content) {
        FileFormat::GenBank => genbank::parse(content).map(|s| vec![s]),
        FileFormat::Fasta => fasta::parse(content),
        _ => Err(ParseError::InvalidFormat(
            "Unsupported or unrecognized file format".to_string(),
        )),
    }
}
