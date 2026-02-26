pub mod commands;
pub mod dto;

use commands::{annotation, file, sequence};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize the component database
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("Failed to create data dir: {}", e))?;

            let db_path = data_dir.join("components.db");
            let conn = rusqlite::Connection::open(&db_path)
                .map_err(|e| format!("Failed to open components DB: {}", e))?;

            helix_components::db::init_db(&conn)
                .map_err(|e| format!("Failed to init components DB: {}", e))?;
            let seeded = helix_components::db::seed_builtins(&conn)
                .map_err(|e| format!("Failed to seed components: {}", e))?;
            if seeded > 0 {
                eprintln!("Seeded {} built-in components", seeded);
            }

            app.manage(annotation::ComponentDbState {
                conn: std::sync::Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            file::open_sequence_file,
            file::detect_file_format,
            file::save_sequence_file,
            file::export_genbank,
            sequence::reverse_complement,
            sequence::translate,
            sequence::gc_content,
            sequence::find_orfs,
            sequence::search_sequence,
            annotation::auto_annotate,
            annotation::list_components,
            annotation::add_component,
            annotation::delete_component,
            annotation::search_components,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Helix");
}
