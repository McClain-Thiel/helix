use crate::dto::{MatchDto, OrfDto};
use helix_core::{codon::CodonTable, operations, search};

#[tauri::command]
pub fn reverse_complement(sequence: String) -> String {
    operations::reverse_complement(&sequence)
}

#[tauri::command]
pub fn translate(sequence: String) -> String {
    let table = CodonTable::standard();
    operations::translate(&sequence, &table)
}

#[tauri::command]
pub fn gc_content(sequence: String) -> f64 {
    operations::gc_content(&sequence)
}

#[tauri::command]
pub fn find_orfs(sequence: String, min_length_aa: usize) -> Vec<OrfDto> {
    operations::find_orfs(&sequence, min_length_aa)
        .iter()
        .map(OrfDto::from)
        .collect()
}

#[tauri::command]
pub fn search_sequence(
    sequence: String,
    pattern: String,
    is_circular: bool,
) -> Vec<MatchDto> {
    search::find_pattern(&sequence, &pattern, is_circular)
        .iter()
        .map(MatchDto::from)
        .collect()
}
