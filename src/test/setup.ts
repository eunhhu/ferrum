/**
 * Vitest setup file
 */

import { beforeAll, afterEach } from "vitest";
import { cleanup } from "@solidjs/testing-library";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Tauri API for testing
beforeAll(() => {
  // @ts-ignore
  window.__TAURI__ = {
    invoke: async (cmd: string, args?: any) => {
      console.log(`Mock invoke: ${cmd}`, args);
      
      // Mock responses for testing
      if (cmd === "get_depth_regions") {
        return [
          { start_line: 0, end_line: 5, depth: 1 },
          { start_line: 1, end_line: 3, depth: 2 },
        ];
      }
      
      if (cmd === "get_fold_state") {
        return {
          folded_lines: [],
          fold_ranges: {
            0: { start_line: 0, end_line: 5, is_placeholder: false },
          },
        };
      }
      
      if (cmd === "toggle_fold") {
        return true;
      }
      
      return null;
    },
  };
});
