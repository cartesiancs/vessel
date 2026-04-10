// Library crate for external access (tests, etc.)

pub mod db;
pub mod error;
pub mod flow;
pub mod logo;
pub mod media;
pub mod recording;
pub mod state;
pub mod tunnel_control;
pub mod utils;

// Re-export commonly used types for convenience
pub use state::{DbPool, MediaType, Protocol, StreamDescriptor, StreamHandle, StreamRegistry};
