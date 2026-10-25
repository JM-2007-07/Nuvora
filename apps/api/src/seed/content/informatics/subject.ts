import { defineSubject } from '@nuvora/shared';

export const informatics = defineSubject({
  slug: 'informatics',
  order: 1,
  title: {
    tg: 'Информатика',
    ru: 'Информатика',
    en: 'Informatics',
  },
  description: {
    tg: 'Асосҳои барномасозӣ: тағйирёбандаҳо, шартҳо, давраҳо, функсияҳо, рӯйхатҳо ва алгоритмҳои оддӣ.',
    ru: 'Основы программирования: переменные, условия, циклы, функции, списки и простые алгоритмы.',
    en: 'Programming basics: variables, conditions, loops, functions, lists, and simple algorithms.',
  },
  // Drafted by Claude (AI). Not linguistically approved until a native speaker reviews each language.
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },
});
