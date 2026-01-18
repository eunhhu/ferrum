//! Plugin permission system
//!
//! Provides capability-based security for plugins.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

/// Plugin identifier
pub type PluginId = Uuid;

/// Available permissions for plugins
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
  /// Read workspace information (open files, folder structure)
  WorkspaceRead,

  /// Modify workspace (create/delete files)
  WorkspaceWrite,

  /// Read editor content
  EditorRead,

  /// Modify editor content
  EditorModify,

  /// Read files from the filesystem
  FileSystemRead,

  /// Write files to the filesystem
  FileSystemWrite,

  /// Make network requests
  NetworkRequest,

  /// Spawn child processes
  ProcessSpawn,

  /// Access clipboard
  ClipboardAccess,

  /// Show notifications
  ShowNotification,

  /// Register UI panels
  RegisterPanel,

  /// Register commands
  RegisterCommand,

  /// Register themes
  RegisterTheme,

  /// Access terminal
  TerminalAccess,

  /// Access git operations
  GitAccess,

  /// Access environment variables
  EnvAccess,
}

impl Permission {
  /// Parse permission from string
  pub fn from_string(s: &str) -> Option<Self> {
    match s {
      "workspace.read" => Some(Permission::WorkspaceRead),
      "workspace.write" => Some(Permission::WorkspaceWrite),
      "editor.read" => Some(Permission::EditorRead),
      "editor.modify" => Some(Permission::EditorModify),
      "fs.read" => Some(Permission::FileSystemRead),
      "fs.write" => Some(Permission::FileSystemWrite),
      "network.request" => Some(Permission::NetworkRequest),
      "process.spawn" => Some(Permission::ProcessSpawn),
      "clipboard.access" => Some(Permission::ClipboardAccess),
      "notification.show" => Some(Permission::ShowNotification),
      "ui.panel" => Some(Permission::RegisterPanel),
      "ui.command" => Some(Permission::RegisterCommand),
      "ui.theme" => Some(Permission::RegisterTheme),
      "terminal.access" => Some(Permission::TerminalAccess),
      "git.access" => Some(Permission::GitAccess),
      "env.access" => Some(Permission::EnvAccess),
      _ => None,
    }
  }

  /// Convert permission to string
  pub fn to_string(&self) -> &'static str {
    match self {
      Permission::WorkspaceRead => "workspace.read",
      Permission::WorkspaceWrite => "workspace.write",
      Permission::EditorRead => "editor.read",
      Permission::EditorModify => "editor.modify",
      Permission::FileSystemRead => "fs.read",
      Permission::FileSystemWrite => "fs.write",
      Permission::NetworkRequest => "network.request",
      Permission::ProcessSpawn => "process.spawn",
      Permission::ClipboardAccess => "clipboard.access",
      Permission::ShowNotification => "notification.show",
      Permission::RegisterPanel => "ui.panel",
      Permission::RegisterCommand => "ui.command",
      Permission::RegisterTheme => "ui.theme",
      Permission::TerminalAccess => "terminal.access",
      Permission::GitAccess => "git.access",
      Permission::EnvAccess => "env.access",
    }
  }

  /// Get permission description for user display
  pub fn description(&self) -> &'static str {
    match self {
      Permission::WorkspaceRead => "Read workspace information and open files",
      Permission::WorkspaceWrite => "Create, modify, and delete files in the workspace",
      Permission::EditorRead => "Read content from open editors",
      Permission::EditorModify => "Modify content in open editors",
      Permission::FileSystemRead => "Read files from the filesystem",
      Permission::FileSystemWrite => "Write files to the filesystem",
      Permission::NetworkRequest => "Make HTTP/HTTPS requests",
      Permission::ProcessSpawn => "Run external programs",
      Permission::ClipboardAccess => "Access the system clipboard",
      Permission::ShowNotification => "Show desktop notifications",
      Permission::RegisterPanel => "Add custom panels to the IDE",
      Permission::RegisterCommand => "Register custom commands",
      Permission::RegisterTheme => "Register custom themes",
      Permission::TerminalAccess => "Access the integrated terminal",
      Permission::GitAccess => "Perform git operations",
      Permission::EnvAccess => "Access environment variables",
    }
  }

  /// Check if this permission is considered dangerous
  pub fn is_dangerous(&self) -> bool {
    matches!(
      self,
      Permission::FileSystemWrite
        | Permission::ProcessSpawn
        | Permission::NetworkRequest
        | Permission::TerminalAccess
    )
  }
}

/// Manages permissions for all plugins
pub struct PermissionManager {
  /// Granted permissions per plugin
  granted: DashMap<PluginId, HashSet<Permission>>,

  /// Denied permissions per plugin (user explicitly denied)
  denied: DashMap<PluginId, HashSet<Permission>>,
}

impl PermissionManager {
  /// Create a new permission manager
  pub fn new() -> Self {
    Self {
      granted: DashMap::new(),
      denied: DashMap::new(),
    }
  }

  /// Check if a plugin has a permission
  pub fn has_permission(&self, plugin_id: PluginId, permission: Permission) -> bool {
    self
      .granted
      .get(&plugin_id)
      .map(|perms| perms.contains(&permission))
      .unwrap_or(false)
  }

  /// Grant a permission to a plugin
  pub fn grant(&self, plugin_id: PluginId, permission: Permission) {
    self
      .granted
      .entry(plugin_id)
      .or_insert_with(HashSet::new)
      .insert(permission);

    // Remove from denied if present
    if let Some(mut denied) = self.denied.get_mut(&plugin_id) {
      denied.remove(&permission);
    }
  }

  /// Grant multiple permissions to a plugin
  pub fn grant_all(&self, plugin_id: PluginId, permissions: impl IntoIterator<Item = Permission>) {
    for perm in permissions {
      self.grant(plugin_id, perm);
    }
  }

  /// Deny a permission to a plugin
  pub fn deny(&self, plugin_id: PluginId, permission: Permission) {
    self
      .denied
      .entry(plugin_id)
      .or_insert_with(HashSet::new)
      .insert(permission);

    // Remove from granted if present
    if let Some(mut granted) = self.granted.get_mut(&plugin_id) {
      granted.remove(&permission);
    }
  }

  /// Revoke a permission from a plugin
  pub fn revoke(&self, plugin_id: PluginId, permission: Permission) {
    if let Some(mut granted) = self.granted.get_mut(&plugin_id) {
      granted.remove(&permission);
    }
  }

  /// Revoke all permissions from a plugin
  pub fn revoke_all(&self, plugin_id: PluginId) {
    self.granted.remove(&plugin_id);
  }

  /// Check if a permission was explicitly denied
  pub fn is_denied(&self, plugin_id: PluginId, permission: Permission) -> bool {
    self
      .denied
      .get(&plugin_id)
      .map(|perms| perms.contains(&permission))
      .unwrap_or(false)
  }

  /// Get all granted permissions for a plugin
  pub fn get_permissions(&self, plugin_id: PluginId) -> HashSet<Permission> {
    self
      .granted
      .get(&plugin_id)
      .map(|perms| perms.clone())
      .unwrap_or_default()
  }

  /// Parse permission strings and grant them
  pub fn grant_from_strings(&self, plugin_id: PluginId, permission_strings: &[String]) {
    for perm_str in permission_strings {
      if let Some(perm) = Permission::from_string(perm_str) {
        self.grant(plugin_id, perm);
      }
    }
  }
}

impl Default for PermissionManager {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_permission_grant_revoke() {
    let manager = PermissionManager::new();
    let plugin_id = PluginId::new_v4();

    assert!(!manager.has_permission(plugin_id, Permission::EditorRead));

    manager.grant(plugin_id, Permission::EditorRead);
    assert!(manager.has_permission(plugin_id, Permission::EditorRead));

    manager.revoke(plugin_id, Permission::EditorRead);
    assert!(!manager.has_permission(plugin_id, Permission::EditorRead));
  }

  #[test]
  fn test_permission_from_string() {
    assert_eq!(
      Permission::from_string("editor.read"),
      Some(Permission::EditorRead)
    );
    assert_eq!(Permission::from_string("invalid"), None);
  }
}
