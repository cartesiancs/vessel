use dashmap::DashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Clone)]
pub struct BinaryStore {
    store: Arc<DashMap<Uuid, (Instant, Vec<u8>)>>,
}

impl BinaryStore {
    pub fn new() -> Self {
        let store = Arc::new(DashMap::new());
        let store_clone = store.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                let cutoff = Instant::now() - Duration::from_secs(60);
                store_clone.retain(|_, (timestamp, _)| *timestamp > cutoff);
            }
        });

        Self { store }
    }

    pub fn insert(&self, data: Vec<u8>) -> Uuid {
        let id = Uuid::new_v4();
        self.store.insert(id, (Instant::now(), data));
        id
    }

    pub fn remove(&self, id: &Uuid) -> Option<Vec<u8>> {
        self.store.remove(id).map(|(_, (_, data))| data)
    }
}
