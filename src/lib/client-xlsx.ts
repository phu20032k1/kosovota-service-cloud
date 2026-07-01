"use client";

function xml(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function columnName(index: number) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(headers: string[], rows: unknown[][]) {
  const allRows = [headers, ...rows];
  const body = allRows.map((row, r) => {
    const cells = headers.map((_, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xml(row[c])}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const encoder = new TextEncoder();
let crcTable: number[] | null = null;
function crc32(data: Uint8Array) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeU16(out: number[], value: number) { out.push(value & 255, (value >>> 8) & 255); }
function writeU32(out: number[], value: number) { out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function writeBytes(out: number[], bytes: Uint8Array) { for (const byte of bytes) out.push(byte); }

function zip(files: { name: string; content: string }[]) {
  const out: number[] = [];
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const offset = out.length;
    const crc = crc32(content);
    writeU32(out, 0x04034b50); writeU16(out, 20); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0);
    writeU32(out, crc); writeU32(out, content.length); writeU32(out, content.length); writeU16(out, name.length); writeU16(out, 0);
    writeBytes(out, name); writeBytes(out, content);
    central.push({ name, crc, size: content.length, offset });
  }
  const centralStart = out.length;
  for (const file of central) {
    writeU32(out, 0x02014b50); writeU16(out, 20); writeU16(out, 20); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0);
    writeU32(out, file.crc); writeU32(out, file.size); writeU32(out, file.size); writeU16(out, file.name.length); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0); writeU16(out, 0); writeU32(out, 0); writeU32(out, file.offset);
    writeBytes(out, file.name);
  }
  const centralSize = out.length - centralStart;
  writeU32(out, 0x06054b50); writeU16(out, 0); writeU16(out, 0); writeU16(out, central.length); writeU16(out, central.length); writeU32(out, centralSize); writeU32(out, centralStart); writeU16(out, 0);
  return new Uint8Array(out);
}

export function downloadXlsx(filename: string, sheetName: string, headers: string[], rows: unknown[][]) {
  const safeSheet = xml(sheetName || "Sheet1").slice(0, 31) || "Sheet1";
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml(headers, rows) },
  ];
  const blob = new Blob([zip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
