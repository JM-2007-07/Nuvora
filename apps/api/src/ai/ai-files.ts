import { AI_FILE_TYPES } from '@nuvora/shared';
import type { AiPart } from './ai-model.js';
import { docxText } from './docx-text.js';

/** An uploaded file for the model (pure). The bytes are checked, never just the name or the declared type. */

const MAX_TEXT_CHARS = 1_000_000;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type FileProblem = 'FILE_TYPE' | 'FILE_UNREADABLE' | 'FILE_TOO_LONG';

const starts = (data: Buffer, ...bytes: number[]) => bytes.every((b, i) => data[i] === b);

function looksLike(mime: string, data: Buffer): boolean {
  if (mime === 'application/pdf') return data.subarray(0, 5).toString('latin1') === '%PDF-';
  if (mime === 'image/png') return starts(data, 0x89, 0x50, 0x4e, 0x47);
  if (mime === 'image/jpeg') return starts(data, 0xff, 0xd8, 0xff);
  if (mime === 'image/webp') return data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP';
  if (mime === DOCX) return starts(data, 0x50, 0x4b);
  return !data.includes(0); // plain text has no NUL bytes
}

/** Some systems send .md and .docx without a useful type: fall back to the extension. */
function effectiveType(mimetype: string, name: string): string {
  if ((AI_FILE_TYPES as readonly string[]).includes(mimetype)) return mimetype;
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'md') return 'text/markdown';
  if (ext === 'docx') return DOCX;
  if (ext === 'txt') return 'text/plain';
  return mimetype;
}

const asText = (text: string): AiPart | FileProblem => {
  if (!text.trim()) return 'FILE_UNREADABLE';
  if (text.length > MAX_TEXT_CHARS) return 'FILE_TOO_LONG';
  return { type: 'text', text: `<document>\n${text}\n</document>` };
};

export function filePart(file: { mimetype: string; originalname: string; buffer: Buffer }): AiPart | FileProblem {
  const mime = effectiveType(file.mimetype, file.originalname);
  if (!(AI_FILE_TYPES as readonly string[]).includes(mime)) return 'FILE_TYPE';
  if (!looksLike(mime, file.buffer)) return 'FILE_UNREADABLE';
  if (mime === DOCX) {
    const text = docxText(file.buffer);
    return text ? asText(text) : 'FILE_UNREADABLE';
  }
  if (mime.startsWith('text/')) return asText(file.buffer.toString('utf8'));
  return { type: mime === 'application/pdf' ? 'document' : 'image', data: file.buffer.toString('base64'), mimeType: mime };
}
