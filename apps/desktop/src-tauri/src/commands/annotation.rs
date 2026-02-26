use crate::dto::{AnnotationHitDto, ComponentDto};
use helix_components::annotate::{AnnotationConfig, AnnotationHit};
use helix_components::component::Component;
use helix_components::db;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

/// Managed state holding the SQLite connection for the component database.
pub struct ComponentDbState {
    pub conn: Mutex<Connection>,
}

/// Auto-annotate a sequence against the component database.
/// Returns a list of hits for the user to review before applying.
#[tauri::command]
pub fn auto_annotate(
    state: State<'_, ComponentDbState>,
    sequence: String,
    is_circular: bool,
    min_identity: Option<f64>,
    min_coverage: Option<f64>,
) -> Result<Vec<AnnotationHitDto>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let components = db::get_components(&conn, None).map_err(|e| e.to_string())?;

    let config = AnnotationConfig {
        min_identity: min_identity.unwrap_or(80.0),
        min_coverage: min_coverage.unwrap_or(80.0),
        ..Default::default()
    };

    let hits =
        helix_components::annotate::annotate(&sequence, is_circular, &components, &config);

    Ok(hits.iter().map(|h| annotation_hit_to_dto(h)).collect())
}

/// List all components in the database, optionally filtered by category.
#[tauri::command]
pub fn list_components(
    state: State<'_, ComponentDbState>,
    category: Option<String>,
) -> Result<Vec<ComponentDto>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let components =
        db::get_components(&conn, category.as_deref()).map_err(|e| e.to_string())?;
    Ok(components.iter().map(component_to_dto).collect())
}

/// Add a user-defined component to the database.
#[tauri::command]
pub fn add_component(
    state: State<'_, ComponentDbState>,
    name: String,
    category: String,
    sequence: String,
    description: Option<String>,
) -> Result<ComponentDto, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let component = Component {
        id: 0,
        name,
        category,
        sequence: sequence.to_uppercase(),
        length: sequence.len(),
        description,
        organism: None,
        is_builtin: false,
        accession: None,
        color: None,
    };
    let id = db::add_user_component(&conn, &component).map_err(|e| e.to_string())?;
    let saved = db::get_component(&conn, id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve saved component".to_string())?;
    Ok(component_to_dto(&saved))
}

/// Delete a user-defined component (built-ins cannot be deleted).
#[tauri::command]
pub fn delete_component(
    state: State<'_, ComponentDbState>,
    id: i64,
) -> Result<bool, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_user_component(&conn, id).map_err(|e| e.to_string())
}

/// Search components by name.
#[tauri::command]
pub fn search_components(
    state: State<'_, ComponentDbState>,
    query: String,
) -> Result<Vec<ComponentDto>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let results = db::search_components(&conn, &query).map_err(|e| e.to_string())?;
    Ok(results.iter().map(component_to_dto).collect())
}

// ── DTO conversions ──

fn annotation_hit_to_dto(hit: &AnnotationHit) -> AnnotationHitDto {
    AnnotationHitDto {
        component_name: hit.component_name.clone(),
        component_id: hit.component_id,
        category: hit.category.clone(),
        target_start: hit.target_start,
        target_end: hit.target_end,
        strand: if hit.is_reverse_complement { -1 } else { 1 },
        percent_identity: hit.percent_identity,
        query_coverage: hit.query_coverage,
        alignment_score: hit.alignment_score,
        color: hit.color.clone().unwrap_or_else(|| "#9a9ba3".to_string()),
    }
}

fn component_to_dto(c: &Component) -> ComponentDto {
    ComponentDto {
        id: c.id,
        name: c.name.clone(),
        category: c.category.clone(),
        length: c.length,
        description: c.description.clone(),
        organism: c.organism.clone(),
        is_builtin: c.is_builtin,
    }
}
