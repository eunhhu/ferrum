//! Strongly-typed identifiers for Ferrum entities
//!
//! This module provides type-safe IDs to prevent mixing up different entity types.
//! Each ID is a wrapper around a UUID with a unique type marker.

use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

/// Macro to generate strongly-typed ID wrappers
macro_rules! define_id {
    ($name:ident, $doc:literal) => {
        #[doc = $doc]
        #[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(Uuid);

        impl $name {
            /// Create a new random ID
            #[inline]
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }

            /// Create an ID from a UUID
            #[inline]
            pub const fn from_uuid(uuid: Uuid) -> Self {
                Self(uuid)
            }

            /// Get the underlying UUID
            #[inline]
            pub const fn as_uuid(&self) -> &Uuid {
                &self.0
            }

            /// Create a nil (zero) ID - useful for testing
            #[inline]
            pub const fn nil() -> Self {
                Self(Uuid::nil())
            }

            /// Check if this is a nil ID
            #[inline]
            pub fn is_nil(&self) -> bool {
                self.0.is_nil()
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Debug for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}({})", stringify!($name), &self.0.to_string()[..8])
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", &self.0.to_string()[..8])
            }
        }

        impl From<Uuid> for $name {
            fn from(uuid: Uuid) -> Self {
                Self(uuid)
            }
        }

        impl From<$name> for Uuid {
            fn from(id: $name) -> Uuid {
                id.0
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Ok(Self(Uuid::parse_str(s)?))
            }
        }
    };
}

// Define all ID types
define_id!(BufferId, "Unique identifier for a text buffer");
define_id!(FileId, "Unique identifier for a file");
define_id!(TabId, "Unique identifier for an editor tab");
define_id!(ViewId, "Unique identifier for a view/panel");
define_id!(WindowId, "Unique identifier for a window");
define_id!(ProjectId, "Unique identifier for a project");
define_id!(SessionId, "Unique identifier for an editing session");
define_id!(
    TransactionId,
    "Unique identifier for an undo/redo transaction"
);
define_id!(WorkspaceId, "Unique identifier for a workspace");
define_id!(PeerId, "Unique identifier for a collaboration peer");
define_id!(OperationId, "Unique identifier for a CRDT operation");
define_id!(RequestId, "Unique identifier for an async request");

/// Trait for entities that have an ID
pub trait HasId {
    /// The ID type for this entity
    type Id: Clone + Eq + std::hash::Hash;

    /// Get the entity's ID
    fn id(&self) -> Self::Id;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id_creation() {
        let id1 = BufferId::new();
        let id2 = BufferId::new();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_id_nil() {
        let id = BufferId::nil();
        assert!(id.is_nil());
        assert_eq!(id, BufferId::nil());
    }

    #[test]
    fn test_id_serialization() {
        let id = BufferId::new();
        let json = serde_json::to_string(&id).unwrap();
        let parsed: BufferId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn test_id_display() {
        let id = BufferId::new();
        let display = format!("{}", id);
        assert_eq!(display.len(), 8);
    }

    #[test]
    fn test_different_id_types() {
        // This should NOT compile:
        // let buffer_id: BufferId = FileId::new();
        // Demonstrating type safety at compile time
    }
}
