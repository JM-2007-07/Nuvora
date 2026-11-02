import { inflateRawSync } from 'node:zlib';

/**
 * The text of a .docx file (a zip holding word/document.xml), which Gemini does not read itself.
 * Read with node:zlib only; the output cap protects against zip bombs. Null when it is not a readable docx.
 */
const MAX_TEXT_BYTES = 20 * 1024 * 1024;
const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

function entry(file: Buffer, wanted: string): Buffer | null {
  let end = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 65535); i--) {
    if (file.readUInt32LE(i) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = file.readUInt16LE(end + 10);
  let at = file.readUInt32LE(end + 16);
  for (let n = 0; n < count && at + 46 <= file.length; n++) {
    if (file.readUInt32LE(at) !== DIRECTORY_ENTRY) return null;
    const method = file.readUInt16LE(at + 10);
    const compressedSize = file.readUInt32LE(at + 20);
    const nameLength = file.readUInt16LE(at + 28);
    const extraLength = file.readUInt16LE(at + 30);
    const commentLength = file.readUInt16LE(at + 32);
    const localAt = file.readUInt32LE(at + 42);
    const name = file.toString('utf8', at + 46, at + 46 + nameLength);
    if (name === wanted) {
      if (localAt + 30 > file.length || file.readUInt32LE(localAt) !== LOCAL_HEADER) return null;
      const start = localAt + 30 + file.readUInt16LE(localAt + 26) + file.readUInt16LE(localAt + 28);
      const data = file.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      return method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_TEXT_BYTES }) : null;
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function docxText(file: Buffer): string | null {
  try {
    const xml = entry(file, 'word/document.xml')?.toString('utf8');
    if (!xml) return null;
    return xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return null;
  }
}
