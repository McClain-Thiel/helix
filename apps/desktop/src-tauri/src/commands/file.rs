use crate::dto::SequenceDto;

/// Open and parse a sequence file, returning a DTO
#[tauri::command]
pub fn open_sequence_file(path: String) -> Result<SequenceDto, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let sequences = helix_formats::parse_file(&content)
        .map_err(|e| format!("Failed to parse file: {}", e))?;

    let seq = sequences
        .into_iter()
        .next()
        .ok_or_else(|| "No sequences found in file".to_string())?;

    Ok(SequenceDto::from(&seq))
}

/// Detect the format of a file
#[tauri::command]
pub fn detect_file_format(path: String) -> Result<String, String> {
    let format = helix_formats::detect::detect_format_from_extension(&path);
    Ok(format!("{:?}", format))
}

/// Save a sequence to a file in GenBank format
#[tauri::command]
pub fn save_sequence_file(
    path: String,
    sequence_json: String,
) -> Result<(), String> {
    let _seq: serde_json::Value =
        serde_json::from_str(&sequence_json).map_err(|e| format!("Invalid JSON: {}", e))?;

    // For now, we just write the JSON. Full serialization comes with export in Step 15.
    std::fs::write(&path, &sequence_json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}
