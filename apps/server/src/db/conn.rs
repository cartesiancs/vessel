use diesel::r2d2::{self, ConnectionManager, CustomizeConnection};
use diesel::sqlite::SqliteConnection;
use diesel::connection::SimpleConnection;

use crate::state::DbPool;

#[derive(Debug)]
struct SqliteConnectionCustomizer;

impl CustomizeConnection<SqliteConnection, diesel::r2d2::Error> for SqliteConnectionCustomizer {
    fn on_acquire(&self, conn: &mut SqliteConnection) -> Result<(), diesel::r2d2::Error> {
        conn.batch_execute("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
            .map_err(|e| diesel::r2d2::Error::QueryError(e))?;
        Ok(())
    }
}

pub fn establish_connection(database_url: &str) -> DbPool {
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    r2d2::Pool::builder()
        .connection_customizer(Box::new(SqliteConnectionCustomizer))
        .build(manager)
        .expect("Failed to create pool.")
}
