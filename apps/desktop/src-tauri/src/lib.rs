pub mod commands;
pub mod dto;

use commands::{file, sequence};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            file::open_sequence_file,
            file::detect_file_format,
            file::save_sequence_file,
            sequence::reverse_complement,
            sequence::translate,
            sequence::gc_content,
            sequence::find_orfs,
            sequence::search_sequence,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Helix");
}
