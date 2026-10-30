/**
 * Checks an uploaded voice clip's first bytes, so a file of another type renamed to
 * audio/* is refused (the MIME type comes from the client). Covers what browsers'
 * MediaRecorder produces (WebM/Opus, Ogg, MP4/AAC on Safari) and common audio files.
 */
export function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const ascii = (start: number, end: number) => buffer.subarray(start, end).toString('latin1');
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true; // WebM / Matroska (EBML)
  if (ascii(0, 4) === 'OggS') return true; // Ogg
  if (ascii(4, 8) === 'ftyp') return true; // MP4 / M4A
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return true; // WAV
  if (ascii(0, 3) === 'ID3') return true; // MP3 with ID3 tag
  if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return true; // MPEG audio frame or AAC ADTS
  return false;
}
