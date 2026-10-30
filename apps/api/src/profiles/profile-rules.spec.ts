import { describe, expect, it } from 'vitest';
import { canSee, firstFree, suggestHandle } from './profile-rules.js';
import { looksLikeImage } from './profiles.service.js';

describe('handle suggestions', () => {
  it('turns Latin, Russian and Tajik names into a handle', () => {
    expect(suggestHandle('Amina Rahimova')).toBe('amina.rahimova');
    expect(suggestHandle('Дилшод Каримов')).toBe('dilshod.karimov');
    expect(suggestHandle('Ҷамшед Раҳмонов')).toBe('jamshed.rahmonov');
  });
  it('keeps handles valid: at least 3 characters, no edge dots, at most 24', () => {
    expect(suggestHandle('Al')).toBe('al.faroz');
    expect(suggestHandle('  ...Zoë!!  ')).toBe('zoe');
    expect(suggestHandle('A very very long name for a person').length).toBeLessThanOrEqual(24);
  });
  it('picks the first free variant', () => {
    expect(firstFree('amina', new Set())).toBe('amina');
    expect(firstFree('amina', new Set(['amina', 'amina2']))).toBe('amina3');
    expect(firstFree('a'.repeat(24), new Set(['a'.repeat(24)]))).toBe(`${'a'.repeat(23)}2`);
  });
});

describe('visibility', () => {
  it('the owner sees every block', () => {
    expect(canSee('me', 'me')).toBe(true);
  });
  it('"everyone" shows to anyone signed in, "groups" to classmates and teachers, "me" to nobody else', () => {
    expect(canSee('everyone', 'other')).toBe(true);
    expect(canSee('groups', 'group')).toBe(true);
    expect(canSee('groups', 'other')).toBe(false);
    expect(canSee('me', 'group')).toBe(false);
  });
});

describe('image check', () => {
  it('accepts PNG, JPEG and WebP signatures and refuses other bytes', () => {
    expect(looksLikeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(looksLikeImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe(true);
    expect(looksLikeImage(Buffer.from('<svg onload=alert(1)>'))).toBe(false);
  });
});
