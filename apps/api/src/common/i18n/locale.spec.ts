import { localizeFields, resolveLocale, resolveText } from './locale.js';

describe('resolveLocale (Accept-Language)', () => {
  it.each([
    [undefined, 'ru'],
    ['', 'ru'],
    ['tg', 'tg'],
    ['ru', 'ru'],
    ['en', 'en'],
    ['RU', 'ru'],
    ['ru-RU,ru;q=0.9,en;q=0.8', 'ru'],
    ['fr-FR,fr;q=0.9,en;q=0.5', 'en'],
    ['en;q=0.3,ru;q=0.7', 'ru'],
    ['fr', 'ru'],
    ['*', 'ru'],
    ['ru;q=0', 'ru'],
    ['tg;q=0', 'ru'],
  ])('%j → %s', (header, expected) => {
    expect(resolveLocale(header)).toBe(expected);
  });

  it('accepts repeated headers', () => {
    expect(resolveLocale(['fr', 'en'])).toBe('en');
  });
});

describe('resolveText (fallback order tg → ru → en, ru → en → tg, en → ru → tg)', () => {
  const all = { tg: 'TG', ru: 'RU', en: 'EN' };

  it('uses the requested locale when present', () => {
    expect(resolveText(all, 'tg')).toEqual({ text: 'TG', fallback: false });
    expect(resolveText(all, 'en')).toEqual({ text: 'EN', fallback: false });
  });

  it.each([
    ['tg', { ru: 'RU', en: 'EN' }, 'RU'],
    ['tg', { en: 'EN' }, 'EN'],
    ['ru', { tg: 'TG', en: 'EN' }, 'EN'],
    ['ru', { tg: 'TG' }, 'TG'],
    ['en', { tg: 'TG', ru: 'RU' }, 'RU'],
    ['en', { tg: 'TG' }, 'TG'],
  ] as const)('%s falls back correctly for %j', (locale, stored, expected) => {
    expect(resolveText(stored, locale)).toEqual({ text: expected, fallback: true });
  });

  it('rejects malformed stored text', () => {
    expect(() => resolveText({}, 'tg')).toThrow();
    expect(() => resolveText('plain string', 'tg')).toThrow();
  });
});

describe('localizeFields', () => {
  it('resolves every field and lists only the ones that fell back', () => {
    expect(localizeFields('tg', { title: { tg: 'Сарлавҳа', ru: 'Заголовок' }, summary: { ru: 'Кратко', en: 'Short' } })).toEqual({
      title: 'Сарлавҳа',
      summary: 'Кратко',
      fallbackFields: ['summary'],
    });
  });
});
