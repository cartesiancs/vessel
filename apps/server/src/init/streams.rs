use tracing::{error, info, warn};

use crate::db::repository;
use crate::media::{StreamActivation, StreamActivator};
use crate::state::DbPool;

pub fn create_hydrate_streams(pool: &DbPool, activator: &StreamActivator) {
    info!("Hydrating streams from database...");
    let db_streams = match repository::streams::get_all_streams(pool) {
        Ok(db_streams) => db_streams,
        Err(e) => {
            error!("Failed to hydrate streams from database: {}", e);
            return;
        }
    };

    let mut hydrated = 0usize;
    for stream in db_streams {
        let ssrc = stream.ssrc;
        let activation = match StreamActivation::try_from(stream) {
            Ok(activation) => activation,
            Err(e) => {
                warn!("Skipping stream with SSRC {}: {}", ssrc, e);
                continue;
            }
        };
        match activator.activate(activation) {
            Ok(()) => hydrated += 1,
            Err(e) => warn!("Failed to hydrate stream with SSRC {}: {}", ssrc, e),
        }
    }
    info!("Hydrated {} streams into memory.", hydrated);
}
