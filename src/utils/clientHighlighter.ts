/**
 * Client-side syntax highlighter for browser-only mode
 * Uses regex-based tokenization when Tauri backend is not available
 */

import type { HighlightSpan } from "../ipc/types";

interface TokenPattern {
  pattern: RegExp;
  cssClass: string;
}

const TYPESCRIPT_PATTERNS: TokenPattern[] = [
  // Comments
  { pattern: /\/\/.*$/gm, cssClass: "hl-comment" },
  { pattern: /\/\*[\s\S]*?\*\//g, cssClass: "hl-comment" },

  // Strings
  { pattern: /"(?:[^"\\]|\\.)*"/g, cssClass: "hl-string" },
  { pattern: /'(?:[^'\\]|\\.)*'/g, cssClass: "hl-string" },
  { pattern: /`(?:[^`\\]|\\.)*`/g, cssClass: "hl-string" },

  // Keywords
  {
    pattern:
      /\b(function|class|const|let|var|if|else|for|while|do|switch|case|break|continue|return|throw|try|catch|finally|new|delete|typeof|instanceof|in|of|async|await|yield|import|export|from|default|extends|implements|interface|type|enum|namespace|module|declare|abstract|public|private|protected|static|readonly|override|get|set)\b/g,
    cssClass: "hl-keyword",
  },

  // Types
  {
    pattern:
      /\b(string|number|boolean|void|null|undefined|never|any|unknown|object|symbol|bigint|Array|Object|Function|Promise|Map|Set)\b/g,
    cssClass: "hl-type",
  },

  // Constants
  {
    pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g,
    cssClass: "hl-constant",
  },

  // Numbers
  { pattern: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g, cssClass: "hl-number" },
  { pattern: /\b0x[0-9a-fA-F]+\b/g, cssClass: "hl-number" },
  { pattern: /\b0b[01]+\b/g, cssClass: "hl-number" },

  // Function calls
  { pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, cssClass: "hl-function" },

  // Class names (PascalCase)
  { pattern: /\b([A-Z][a-zA-Z0-9_$]*)\b/g, cssClass: "hl-type" },
];

export function highlightCode(code: string, language: string): HighlightSpan[] {
  const highlights: HighlightSpan[] = [];
  const patterns = getPatterns(language);

  for (const { pattern, cssClass } of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(code)) !== null) {
      // For function pattern, we need to adjust to not include the parenthesis
      const start = match.index;
      let end = match.index + match[0].length;

      // For function calls, only highlight the function name
      if (cssClass === "hl-function" && match[1]) {
        end = start + match[1].length;
      }

      highlights.push({
        start,
        end,
        kind: cssClass.replace("hl-", ""),
        css_class: cssClass,
      });
    }
  }

  // Sort by start position and remove overlaps
  highlights.sort((a, b) => a.start - b.start);

  return removeOverlaps(highlights);
}

function getPatterns(language: string): TokenPattern[] {
  switch (language.toLowerCase()) {
    case "typescript":
    case "typescriptreact":
    case "javascript":
    case "javascriptreact":
    case "tsx":
    case "jsx":
    case "ts":
    case "js":
      return TYPESCRIPT_PATTERNS;
    default:
      return TYPESCRIPT_PATTERNS; // Default to TS patterns
  }
}

function removeOverlaps(highlights: HighlightSpan[]): HighlightSpan[] {
  const result: HighlightSpan[] = [];
  let lastEnd = -1;

  for (const h of highlights) {
    if (h.start >= lastEnd) {
      result.push(h);
      lastEnd = h.end;
    }
  }

  return result;
}

export function getHighlightClass(kind: string): string {
  switch (kind) {
    case "keyword":
      return "text-purple-400";
    case "type":
      return "text-cyan-400";
    case "string":
      return "text-green-400";
    case "number":
      return "text-orange-400";
    case "comment":
      return "text-gray-500 italic";
    case "function":
      return "text-yellow-400";
    case "constant":
      return "text-blue-400";
    default:
      return "";
  }
}
