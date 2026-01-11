
export function insertText(lines: string[], text: string, line: number, column: number): { newLines: string[], endLine: number, endColumn: number } {
  const currentLine = lines[line] || "";
  const before = currentLine.substring(0, column);
  const after = currentLine.substring(column);
  
  if (!text.includes("\n")) {
    const newLine = before + text + after;
    const newLines = [...lines];
    newLines[line] = newLine;
    return { newLines, endLine: line, endColumn: column + text.length };
  } else {
    const textLines = text.split("\n");
    const newLines = [...lines];
    
    // First line
    newLines[line] = before + (textLines[0] ?? "");
    
    // Middle lines
    for (let i = 1; i < textLines.length - 1; i++) {
        newLines.splice(line + i, 0, textLines[i] ?? "");
    }
    
    // Last line
    const lastTextLine = textLines[textLines.length - 1] ?? "";
    newLines.splice(line + textLines.length - 1, 0, lastTextLine + after);
    
    return { 
        newLines, 
        endLine: line + textLines.length - 1, 
        endColumn: lastTextLine.length 
    };
  }
}

export function deleteBackwards(lines: string[], line: number, column: number): { newLines: string[], endLine: number, endColumn: number } {
  const currentLine = lines[line] || "";
  
  if (column > 0) {
    // Delete char in same line
    const newLine = currentLine.substring(0, column - 1) + currentLine.substring(column);
    const newLines = [...lines];
    newLines[line] = newLine;
    return { newLines, endLine: line, endColumn: column - 1 };
  } else {
    // Merge with previous line
    if (line === 0) return { newLines: lines, endLine: line, endColumn: column }; // Start of file
    
    const prevLine = lines[line - 1] ?? "";
    const newLine = prevLine + currentLine;
    const newLines = [...lines];
    newLines.splice(line - 1, 2, newLine); // Replace prev and curr with merged
    return { newLines, endLine: line - 1, endColumn: prevLine.length };
  }
}

export function deleteRange(lines: string[], startLine: number, startCol: number, endLine: number, endCol: number): { newLines: string[], endLine: number, endColumn: number } {
  // Ensure start is before end
  if (startLine > endLine || (startLine === endLine && startCol > endCol)) {
    [startLine, endLine] = [endLine, startLine];
    [startCol, endCol] = [endCol, startCol];
  }

  const newLines = [...lines];
  
  if (startLine === endLine) {
    // Single line delete
    const line = newLines[startLine] || "";
    newLines[startLine] = line.substring(0, startCol) + line.substring(endCol);
    return { newLines, endLine: startLine, endColumn: startCol };
  } else {
    // Multi line delete
    const firstLine = newLines[startLine] || "";
    const lastLine = newLines[endLine] || "";
    
    // Merge start of first line with end of last line
    const mergedLine = firstLine.substring(0, startCol) + lastLine.substring(endCol);
    
    // Remove lines in between
    newLines.splice(startLine, endLine - startLine + 1, mergedLine);
    
    return { newLines, endLine: startLine, endColumn: startCol };
  }
}
