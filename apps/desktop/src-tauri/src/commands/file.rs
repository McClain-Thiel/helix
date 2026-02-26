use crate::dto::{OpenFileResult, SequenceDto};
use helix_formats::FileFormat;

/// Open and parse a sequence file, returning all sequences with metadata
#[tauri::command]
pub fn open_sequence_file(path: String) -> Result<OpenFileResult, String> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let format = helix_formats::detect::detect_format(&content);
    let format_str = match format {
        FileFormat::GenBank => "genbank",
        FileFormat::Fasta => "fasta",
        _ => {
            // Fallback: try extension-based detection
            let ext_format = helix_formats::detect::detect_format_from_extension(&path);
            match ext_format {
                FileFormat::GenBank => "genbank",
                FileFormat::Fasta => "fasta",
                _ => return Err(
                    "Unsupported file format. Helix supports GenBank (.gb, .gbk) and FASTA (.fasta, .fa) files.".to_string()
                ),
            }
        }
    };

    let sequences = helix_formats::parse_file(&content)
        .map_err(|e| format!("Failed to parse file: {}", e))?;

    if sequences.is_empty() {
        return Err("No sequences found in file.".to_string());
    }

    // Limit to 10 sequences for FASTA files with many entries
    let capped: Vec<SequenceDto> = sequences
        .iter()
        .take(10)
        .map(SequenceDto::from)
        .collect();

    Ok(OpenFileResult {
        sequences: capped,
        file_path: path,
        format: format_str.to_string(),
    })
}

/// Detect the format of a file
#[tauri::command]
pub fn detect_file_format(path: String) -> Result<String, String> {
    let format = helix_formats::detect::detect_format_from_extension(&path);
    Ok(format!("{:?}", format))
}

/// Save a sequence to a file. Format is determined by file extension.
/// Accepts the sequence as a JSON string matching SequenceDto.
#[tauri::command]
pub fn save_sequence_file(path: String, sequence_json: String) -> Result<(), String> {
    let dto: SequenceDto =
        serde_json::from_str(&sequence_json).map_err(|e| format!("Invalid JSON: {}", e))?;
    let seq = dto.to_core_sequence();

    let content = if path.to_lowercase().ends_with(".fasta")
        || path.to_lowercase().ends_with(".fa")
        || path.to_lowercase().ends_with(".fna")
    {
        helix_formats::fasta::serialize(&[seq])
    } else {
        // Default to GenBank
        helix_formats::genbank::serialize(&seq)
    };

    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

/// Export a sequence as a GenBank format string (for preview/clipboard)
#[tauri::command]
pub fn export_genbank(sequence_json: String) -> Result<String, String> {
    let dto: SequenceDto =
        serde_json::from_str(&sequence_json).map_err(|e| format!("Invalid JSON: {}", e))?;
    let seq = dto.to_core_sequence();
    Ok(helix_formats::genbank::serialize(&seq))
}
