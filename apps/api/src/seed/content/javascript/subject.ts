import { defineSubject } from '@nuvora/shared';

export const javascript = defineSubject({
  slug: 'javascript',
  order: 0,
  title: { tg: 'JavaScript', ru: 'JavaScript', en: 'JavaScript' },
  description: {
    tg: 'Асосҳои JavaScript: тағйирёбандаҳо, шартҳо, функсияҳо, массивҳо ва объектҳо. Аз ташхис оғоз кунед ва холигиҳои худро бинед.',
    ru: 'Основы JavaScript: переменные, условия, функции, массивы и объекты. Начните с диагностики и увидьте свои пробелы.',
    en: 'JavaScript basics: variables, conditions, functions, arrays and objects. Start with the diagnostic and see your gaps.',
  },
  // Drafted by Claude (AI). Not linguistically approved until a native speaker reviews each language.
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },
});
