/**
 * TextMeasurer Utility
 * 
 * Uses an offscreen canvas to accurately measure text width, ensuring
 * proper cursor positioning even for variable-width fonts and CJK characters.
 */

export class TextMeasurer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private font: string = "13px 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace";

  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
  }

  setFont(font: string) {
    if (this.font !== font) {
      this.font = font;
      this.ctx.font = font;
    }
  }

  measure(text: string): number {
    this.ctx.font = this.font;
    return this.ctx.measureText(text).width;
  }

  /**
   * Finds the column index that corresponds to the given X coordinate.
   * Useful for hit testing clicks.
   */
  measureCursorIndex(text: string, clientX: number): number {
    this.ctx.font = this.font;
    
    // Simple approach: find the character index where x is closest
    let lastWidth = 0;
    for (let i = 0; i <= text.length; i++) {
        const width = this.ctx.measureText(text.substring(0, i)).width;
        if (width > clientX) {
            // Check if we are closer to i-1 or i
            if (clientX - lastWidth < width - clientX) {
                return i - 1;
            } else {
                return i;
            }
        }
        lastWidth = width;
    }

    return text.length;
  }
}

export const textMeasurer = new TextMeasurer();
