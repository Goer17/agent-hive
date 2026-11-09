const DELIMITER_CELL = /^:?-{3,}:?$/;

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of line.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  if (cells.length > 0 && cells[0] === "") cells.shift();
  if (cells.length > 0 && (cells[cells.length - 1] ?? "") === "") cells.pop();
  return cells;
}

function isTableRow(line: string): boolean {
  // Require a leading pipe and at most three spaces of indentation, so prose
  // pipes and indented code blocks are left alone.
  return /^\s{0,3}\|/.test(line) && line.includes("|");
}

function isDelimiterRow(line: string): boolean {
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL.test(cell));
}

function delimiterFor(header: string): string {
  const count = Math.max(1, splitCells(header).length);
  return `| ${Array.from({ length: count }, () => "---").join(" | ")} |`;
}

/**
 * Make pipe tables robust against two common Markdown mistakes:
 *  - a table directly after a paragraph without a blank line;
 *  - a table header + data rows without the `| --- |` delimiter row.
 * Fenced code blocks are left untouched.
 */
export function normalizeTables(source: string): string {
  const lines = source.split("\n");
  const output: string[] = [];
  let fence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = (fenceMatch[1] ?? "")[0] ?? "";
      if (fence === null) fence = marker || null;
      else if (marker && marker === fence) fence = null;
      output.push(line);
      continue;
    }
    if (fence !== null) {
      output.push(line);
      continue;
    }

    if (!isTableRow(line) || isDelimiterRow(line)) {
      output.push(line);
      continue;
    }

    // Collect the header plus any following data rows.
    const rows: string[] = [];
    let next = index;
    while (next < lines.length) {
      const candidate = lines[next] ?? "";
      if (!isTableRow(candidate) || isDelimiterRow(candidate)) break;
      rows.push(candidate);
      next += 1;
    }

    const hasDelimiter = next < lines.length && isDelimiterRow(lines[next] ?? "");
    if (hasDelimiter) {
      const previous = output[output.length - 1] ?? "";
      if (previous.trim() !== "") output.push("");
      output.push(line);
      continue;
    }

    if (rows.length >= 2) {
      const previous = output[output.length - 1] ?? "";
      if (previous.trim() !== "") output.push("");
      const header = rows[0] ?? "";
      output.push(header, delimiterFor(header));
      for (let row = 1; row < rows.length; row += 1) output.push(rows[row] ?? "");
      index = next - 1;
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}