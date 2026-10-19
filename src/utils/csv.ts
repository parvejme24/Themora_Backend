// Minimal RFC 4180 CSV reader/writer (quoted fields, embedded commas,
// quotes and line breaks, CRLF or LF, optional UTF-8 BOM).

// Spreadsheet apps run cells that start with these as formulas, so exported
// values get a leading apostrophe (and imports remove it again).
const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCell = (value: string) => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (rows: string[][]) =>
  // BOM so Excel opens the file as UTF-8
  "﻿" + rows.map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";

const unescapeCell = (value: string) => (value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value);

export const parseCsv = (text: string): string[][] => {
  const input = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const endCell = () => {
    row.push(unescapeCell(cell));
    cell = "";
  };
  const endRow = () => {
    endCell();
    // Skip blank lines
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (char === '"') inQuotes = false;
      else cell += char;
      i += 1;
      continue;
    }

    if (char === '"' && cell === "") inQuotes = true;
    else if (char === ",") endCell();
    else if (char === "\n") endRow();
    else if (char === "\r") {
      if (input[i + 1] === "\n") i += 1;
      endRow();
    } else cell += char;
    i += 1;
  }

  if (inQuotes) throw new Error("The CSV has a quoted value that is never closed");
  if (cell !== "" || row.length) endRow();
  return rows;
};
