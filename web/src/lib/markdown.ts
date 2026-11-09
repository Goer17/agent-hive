import type { Root } from "mdast";
import { visit } from "unist-util-visit";

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

    if (!isTableRow(line)) {
      output.push(line);
      continue;
    }

    // Consume the whole contiguous table block, including its delimiter row.
    // Handling data rows here avoids treating them as a second table.
    const block: string[] = [];
    let next = index;
    while (next < lines.length && isTableRow(lines[next] ?? "")) {
      block.push(lines[next] ?? "");
      next += 1;
    }

    if (block.length < 2) {
      output.push(line);
      continue;
    }

    const previous = output[output.length - 1] ?? "";
    if (previous.trim() !== "") output.push("");

    if (block.some((row) => isDelimiterRow(row))) {
      output.push(...block);
    } else {
      const header = block[0] ?? "";
      output.push(header, delimiterFor(header), ...block.slice(1));
    }
    index = next - 1;
  }

  return output.join("\n");
}

function matchingBrace(source: string, start: number): number {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * KaTeX's text-style inline fractions are cramped at chat sizes. Promote
 * inline \\frac/\\dfrac to \\dfrac and add a small zero-width rule above the
 * denominator so it does not touch the fraction bar.
 */
export function addFractionSpacing(source: string): string {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const match = /^\\(frac|dfrac)(?![A-Za-z])/.exec(source.slice(index));
    if (!match) {
      output += source[index] ?? "";
      index += 1;
      continue;
    }

    let cursor = index + match[0].length;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    if (source[cursor] !== "{") {
      output += source.slice(index, cursor);
      index = cursor;
      continue;
    }
    const numeratorEnd = matchingBrace(source, cursor);
    if (numeratorEnd === -1) {
      output += source.slice(index);
      break;
    }

    let afterNumerator = numeratorEnd + 1;
    while (/\s/.test(source[afterNumerator] ?? "")) afterNumerator += 1;
    if (source[afterNumerator] !== "{") {
      output += source.slice(index, afterNumerator);
      index = afterNumerator;
      continue;
    }
    const denominatorEnd = matchingBrace(source, afterNumerator);
    if (denominatorEnd === -1) {
      output += source.slice(index);
      break;
    }

    const numerator = addFractionSpacing(source.slice(cursor + 1, numeratorEnd));
    const denominator = addFractionSpacing(source.slice(afterNumerator + 1, denominatorEnd));
    output += `\\dfrac{${numerator}}{\\rule{0pt}{0.3em}${denominator}}`;
    index = denominatorEnd + 1;
  }
  return output;
}

export function remarkPromoteInlineFractions() {
  return (tree: Root) => {
    visit(tree, "inlineMath", (node) => {
      node.value = addFractionSpacing(node.value);
    });
  };
}
