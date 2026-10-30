import { canSeeBlock, type ProfileRelation } from '@nuvora/shared';

/** How a viewer relates to a profile owner. */
export type Relation = ProfileRelation;

/** The shared visibility rule (also used by the editor's preview). */
export const canSee = canSeeBlock;

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'gh', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', ӣ: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ӯ: 'u', ф: 'f', х: 'kh', ҳ: 'h', ц: 'ts', ч: 'ch', ҷ: 'j', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** A handle suggestion from a name: "Amina Rahimova" → "amina.rahimova", "Дилшод Каримов" → "dilshod.karimov". */
export function suggestHandle(name: string): string {
  const latin = name.toLowerCase().replace(/[Ѐ-ӿ]/g, (ch) => CYRILLIC[ch] ?? ch);
  const base = latin
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
    .replace(/\.+$/g, '');
  return base.length >= 3 ? base : `${base || 'user'}.faroz`.slice(0, 24);
}

/** First free handle: the base, then base2, base3… (kept within 24 characters). */
export function firstFree(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 24 - String(n).length)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, 16)}${Date.now().toString(36).slice(-8)}`;
}
