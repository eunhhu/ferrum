/**
 * TextMeasurer Utility Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { textMeasurer } from "../../utils/textMeasurer";

describe("TextMeasurer", () => {
  beforeEach(() => {
    textMeasurer.setFont("13px 'Fira Code', monospace");
  });

  describe("measure", () => {
    it("returns 0 for empty string", () => {
      const width = textMeasurer.measure("");
      expect(width).toBe(0);
    });

    it("returns positive width for text", () => {
      const width = textMeasurer.measure("hello");
      expect(width).toBeGreaterThan(0);
    });

    it("longer text has greater width", () => {
      const short = textMeasurer.measure("hi");
      const long = textMeasurer.measure("hello world");
      expect(long).toBeGreaterThan(short);
    });
  });

  describe("measureCursorIndex", () => {
    it("returns 0 for negative clientX", () => {
      const index = textMeasurer.measureCursorIndex("hello", -10);
      expect(index).toBe(0);
    });

    it("returns 0 for zero clientX", () => {
      const index = textMeasurer.measureCursorIndex("hello", 0);
      expect(index).toBe(0);
    });

    it("returns text length for very large clientX", () => {
      const index = textMeasurer.measureCursorIndex("hello", 10000);
      expect(index).toBe(5);
    });

    it("returns 0 for empty text", () => {
      const index = textMeasurer.measureCursorIndex("", 50);
      expect(index).toBe(0);
    });

    it("returns valid index within bounds", () => {
      const text = "hello world";
      // Test various positions
      for (let x = 0; x < 200; x += 10) {
        const index = textMeasurer.measureCursorIndex(text, x);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(text.length);
      }
    });

    it("increases index as clientX increases", () => {
      const text = "abcdefghij";
      let prevIndex = 0;

      for (let x = 0; x < 200; x += 20) {
        const index = textMeasurer.measureCursorIndex(text, x);
        expect(index).toBeGreaterThanOrEqual(prevIndex);
        prevIndex = index;
      }
    });
  });

  describe("setFont", () => {
    it("accepts font string without error", () => {
      // In the mock environment, font changes don't affect measurements
      // but we can verify the method doesn't throw
      expect(() => textMeasurer.setFont("20px Arial")).not.toThrow();
      expect(() => textMeasurer.setFont("10px monospace")).not.toThrow();
    });

    it("can be called multiple times", () => {
      textMeasurer.setFont("12px Arial");
      const width1 = textMeasurer.measure("test");

      textMeasurer.setFont("12px Arial");
      const width2 = textMeasurer.measure("test");

      // Same font should produce same width
      expect(width1).toBe(width2);
    });
  });
});
