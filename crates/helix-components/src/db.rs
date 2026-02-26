use rusqlite::{params, Connection, Result as SqlResult};

use crate::component::Component;
use crate::seed_data::builtin_components;

/// Create the components table if it does not exist.
pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS components (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            category    TEXT NOT NULL,
            sequence    TEXT NOT NULL,
            length      INTEGER NOT NULL,
            description TEXT,
            organism    TEXT,
            is_builtin  INTEGER NOT NULL DEFAULT 1,
            accession   TEXT,
            color       TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(name, sequence)
        );
        CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
        CREATE INDEX IF NOT EXISTS idx_components_length ON components(length);",
    )
}

/// Seed built-in components (idempotent via INSERT OR IGNORE).
/// Returns the number of newly inserted rows.
pub fn seed_builtins(conn: &Connection) -> SqlResult<usize> {
    let components = builtin_components();
    let mut count = 0usize;
    for c in &components {
        let changed = conn.execute(
            "INSERT OR IGNORE INTO components
                (name, category, sequence, length, description, organism, is_builtin, accession, color)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
            params![
                c.name,
                c.category,
                c.sequence,
                c.length,
                c.description,
                c.organism,
                c.accession,
                c.color,
            ],
        )?;
        count += changed;
    }
    Ok(count)
}

/// Retrieve components, optionally filtered by category.
pub fn get_components(conn: &Connection, category: Option<&str>) -> SqlResult<Vec<Component>> {
    let mut components = Vec::new();
    match category {
        Some(cat) => {
            let mut stmt = conn.prepare(
                "SELECT id, name, category, sequence, length, description, organism,
                        is_builtin, accession, color
                 FROM components WHERE category = ?1 ORDER BY name",
            )?;
            let rows = stmt.query_map(params![cat], row_to_component)?;
            for row in rows {
                components.push(row?);
            }
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, name, category, sequence, length, description, organism,
                        is_builtin, accession, color
                 FROM components ORDER BY name",
            )?;
            let rows = stmt.query_map([], row_to_component)?;
            for row in rows {
                components.push(row?);
            }
        }
    }
    Ok(components)
}

/// Get a single component by ID.
pub fn get_component(conn: &Connection, id: i64) -> SqlResult<Option<Component>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, category, sequence, length, description, organism,
                is_builtin, accession, color
         FROM components WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], row_to_component)?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// Insert a user-defined component. Returns the new row ID.
pub fn add_user_component(conn: &Connection, component: &Component) -> SqlResult<i64> {
    conn.execute(
        "INSERT INTO components
            (name, category, sequence, length, description, organism, is_builtin, accession, color)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
        params![
            component.name,
            component.category,
            component.sequence,
            component.length,
            component.description,
            component.organism,
            component.accession,
            component.color,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Delete a user-defined component. Built-ins cannot be deleted.
/// Returns true if a row was deleted.
pub fn delete_user_component(conn: &Connection, id: i64) -> SqlResult<bool> {
    let changed =
        conn.execute("DELETE FROM components WHERE id = ?1 AND is_builtin = 0", params![id])?;
    Ok(changed > 0)
}

/// Search components by name (case-insensitive LIKE).
pub fn search_components(conn: &Connection, query: &str) -> SqlResult<Vec<Component>> {
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, name, category, sequence, length, description, organism,
                is_builtin, accession, color
         FROM components WHERE name LIKE ?1 ORDER BY name",
    )?;
    let rows = stmt.query_map(params![pattern], row_to_component)?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}

fn row_to_component(row: &rusqlite::Row) -> SqlResult<Component> {
    Ok(Component {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        sequence: row.get(3)?,
        length: row.get(4)?,
        description: row.get(5)?,
        organism: row.get(6)?,
        is_builtin: row.get::<_, i32>(7)? != 0,
        accession: row.get(8)?,
        color: row.get(9)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn
    }

    #[test]
    fn test_init_and_seed() {
        let conn = test_db();
        let count = seed_builtins(&conn).unwrap();
        assert!(count > 0, "Should seed at least one component");

        // Idempotent
        let count2 = seed_builtins(&conn).unwrap();
        assert_eq!(count2, 0, "Second seed should insert nothing");
    }

    #[test]
    fn test_get_components() {
        let conn = test_db();
        seed_builtins(&conn).unwrap();
        let all = get_components(&conn, None).unwrap();
        assert!(!all.is_empty());

        let resistance = get_components(&conn, Some("resistance")).unwrap();
        assert!(resistance.iter().all(|c| c.category == "resistance"));
    }

    #[test]
    fn test_user_component_crud() {
        let conn = test_db();
        let comp = Component::new_builtin("MyPart", "cds", "ATGATGATG", Some("Test"), None, None, None);
        let id = add_user_component(&conn, &comp).unwrap();
        assert!(id > 0);

        let fetched = get_component(&conn, id).unwrap().unwrap();
        assert_eq!(fetched.name, "MyPart");
        assert!(!fetched.is_builtin);

        assert!(delete_user_component(&conn, id).unwrap());
        assert!(get_component(&conn, id).unwrap().is_none());
    }

    #[test]
    fn test_cannot_delete_builtin() {
        let conn = test_db();
        seed_builtins(&conn).unwrap();
        let all = get_components(&conn, None).unwrap();
        let builtin = all.iter().find(|c| c.is_builtin).unwrap();
        assert!(!delete_user_component(&conn, builtin.id).unwrap());
    }

    #[test]
    fn test_search() {
        let conn = test_db();
        seed_builtins(&conn).unwrap();
        let results = search_components(&conn, "Amp").unwrap();
        assert!(results.iter().any(|c| c.name.contains("Amp")));
    }
}
