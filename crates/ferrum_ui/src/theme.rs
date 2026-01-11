//! Theme definitions

use serde::{Deserialize, Serialize};

/// Color in hex format
pub type Color = String;

/// Theme definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
  pub name: String,
  pub is_dark: bool,
  pub colors: ThemeColors,
  pub syntax: SyntaxColors,
}

/// UI colors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
  // Background colors
  pub background: Color,
  pub surface: Color,
  pub surface_hover: Color,

  // Foreground colors
  pub foreground: Color,
  pub foreground_muted: Color,

  // Accent colors
  pub primary: Color,
  pub secondary: Color,

  // Status colors
  pub success: Color,
  pub warning: Color,
  pub error: Color,
  pub info: Color,

  // Editor specific
  pub line_number: Color,
  pub line_highlight: Color,
  pub selection: Color,
  pub cursor: Color,

  // UI elements
  pub border: Color,
  pub scrollbar: Color,
  pub scrollbar_hover: Color,
}

/// Syntax highlighting colors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyntaxColors {
  pub keyword: Color,
  pub string: Color,
  pub number: Color,
  pub comment: Color,
  pub function: Color,
  pub type_name: Color,
  pub variable: Color,
  pub parameter: Color,
  pub property: Color,
  pub operator: Color,
  pub punctuation: Color,
  pub constant: Color,
}

impl Theme {
  /// Create a default dark theme
  pub fn dark() -> Self {
    Self {
      name: "Ferrum Dark".to_string(),
      is_dark: true,
      colors: ThemeColors {
        background: "#1e1e2e".to_string(),
        surface: "#313244".to_string(),
        surface_hover: "#45475a".to_string(),
        foreground: "#cdd6f4".to_string(),
        foreground_muted: "#6c7086".to_string(),
        primary: "#89b4fa".to_string(),
        secondary: "#f5c2e7".to_string(),
        success: "#a6e3a1".to_string(),
        warning: "#f9e2af".to_string(),
        error: "#f38ba8".to_string(),
        info: "#89dceb".to_string(),
        line_number: "#6c7086".to_string(),
        line_highlight: "#313244".to_string(),
        selection: "#45475a".to_string(),
        cursor: "#f5e0dc".to_string(),
        border: "#45475a".to_string(),
        scrollbar: "#45475a".to_string(),
        scrollbar_hover: "#585b70".to_string(),
      },
      syntax: SyntaxColors {
        keyword: "#cba6f7".to_string(),
        string: "#a6e3a1".to_string(),
        number: "#fab387".to_string(),
        comment: "#6c7086".to_string(),
        function: "#89b4fa".to_string(),
        type_name: "#f9e2af".to_string(),
        variable: "#cdd6f4".to_string(),
        parameter: "#eba0ac".to_string(),
        property: "#89dceb".to_string(),
        operator: "#89dceb".to_string(),
        punctuation: "#6c7086".to_string(),
        constant: "#fab387".to_string(),
      },
    }
  }

  /// Create a default light theme
  pub fn light() -> Self {
    Self {
      name: "Ferrum Light".to_string(),
      is_dark: false,
      colors: ThemeColors {
        background: "#eff1f5".to_string(),
        surface: "#e6e9ef".to_string(),
        surface_hover: "#dce0e8".to_string(),
        foreground: "#4c4f69".to_string(),
        foreground_muted: "#9ca0b0".to_string(),
        primary: "#1e66f5".to_string(),
        secondary: "#ea76cb".to_string(),
        success: "#40a02b".to_string(),
        warning: "#df8e1d".to_string(),
        error: "#d20f39".to_string(),
        info: "#04a5e5".to_string(),
        line_number: "#9ca0b0".to_string(),
        line_highlight: "#e6e9ef".to_string(),
        selection: "#dce0e8".to_string(),
        cursor: "#dc8a78".to_string(),
        border: "#ccd0da".to_string(),
        scrollbar: "#ccd0da".to_string(),
        scrollbar_hover: "#bcc0cc".to_string(),
      },
      syntax: SyntaxColors {
        keyword: "#8839ef".to_string(),
        string: "#40a02b".to_string(),
        number: "#fe640b".to_string(),
        comment: "#9ca0b0".to_string(),
        function: "#1e66f5".to_string(),
        type_name: "#df8e1d".to_string(),
        variable: "#4c4f69".to_string(),
        parameter: "#e64553".to_string(),
        property: "#04a5e5".to_string(),
        operator: "#04a5e5".to_string(),
        punctuation: "#9ca0b0".to_string(),
        constant: "#fe640b".to_string(),
      },
    }
  }
}
