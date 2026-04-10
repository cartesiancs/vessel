use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::watch;

use crate::state::Protocol;

#[async_trait]
pub trait MediaAdapter: Send + Sync {
    fn protocol(&self) -> Protocol;
    async fn start(&self, shutdown: watch::Receiver<()>) -> Result<()>;
}
