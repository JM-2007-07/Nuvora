/**
 * Group B-12 from the Faroz handoff (design/data/demo-learner-teacher.json): the
 * 24 students who took the JavaScript diagnostic and the 2 who did not. Names and
 * answers are copied from the handoff, never invented.
 *
 * - `diagnostic`: the option each student picked per question q1…q20, as an index
 *   (0 = option a). Replayed through recordAttempt(), so totals are computed, not copied.
 * - `retest`: per Arrays retest question, 1 = correct, 0 = wrong (handoff `retest`).
 *   A wrong answer is recorded as the first wrong option, because the handoff only
 *   says whether the answer was right.
 *
 * Dates: the handoff's diagnostic opened Oct 6 and the retest closed Oct 13 (2026).
 */
export interface CohortStudent {
  slug: string;
  name: string;
  diagnostic: string | null;
  retest: string | null;
}

export const B12_GROUP = { code: 'B-12', diagnosticOn: '2026-10-06', retestOn: '2026-10-13' } as const;
export const B12_DIAGNOSTIC_QUIZ = 'javascript-diagnostic';
export const B12_RETEST_QUIZ = 'js-arrays-quiz';

export const B12_STUDENTS: CohortStudent[] = [
  { slug: 'amina-rahimova', name: 'Amina Rahimova', diagnostic: '11112211001000010100', retest: '11101' },
  { slug: 'firuz-nazarov', name: 'Firuz Nazarov', diagnostic: '11112221301100120102', retest: '10011' },
  { slug: 'madina-yusupova', name: 'Madina Yusupova', diagnostic: '11102231021002021111', retest: null },
  { slug: 'rustam-sharipov', name: 'Rustam Sharipov', diagnostic: '11102211011000010112', retest: '11010' },
  { slug: 'nilufar-mirzoeva', name: 'Nilufar Mirzoeva', diagnostic: '11102221011001010130', retest: '10001' },
  { slug: 'bahrom-qodirov', name: 'Bahrom Qodirov', diagnostic: '11112201001003320322', retest: '11011' },
  { slug: 'sitora-aminova', name: 'Sitora Aminova', diagnostic: '11102211211000111103', retest: '11111' },
  { slug: 'timur-abdulloev', name: 'Timur Abdulloev', diagnostic: '11102211211002011111', retest: null },
  { slug: 'zarina-safarova', name: 'Zarina Safarova', diagnostic: '11102221211002211111', retest: null },
  { slug: 'jamshed-rahmonov', name: 'Jamshed Rahmonov', diagnostic: '11102211221002111111', retest: null },
  { slug: 'mehrona-davlatova', name: 'Mehrona Davlatova', diagnostic: '11102211011000011130', retest: '10001' },
  { slug: 'komron-ismoilov', name: 'Komron Ismoilov', diagnostic: '11102211211002010111', retest: null },
  { slug: 'shahlo-nurova', name: 'Shahlo Nurova', diagnostic: '11100211211000010111', retest: '11101' },
  { slug: 'alisher-hakimov', name: 'Alisher Hakimov', diagnostic: '12011221002100130103', retest: '11000' },
  { slug: 'parvina-sodiqova', name: 'Parvina Sodiqova', diagnostic: '11102211211002111111', retest: null },
  { slug: 'daniil-petrov', name: 'Daniil Petrov', diagnostic: '11102211201000011111', retest: null },
  { slug: 'anna-smirnova', name: 'Anna Smirnova', diagnostic: '11101211011000010101', retest: '11101' },
  { slug: 'umed-fayzulloev', name: 'Umed Fayzulloev', diagnostic: '02021232001030110300', retest: null },
  { slug: 'laylo-jurayeva', name: 'Laylo Jurayeva', diagnostic: '11221201000110120000', retest: '11011' },
  { slug: 'suhrob-olimov', name: 'Suhrob Olimov', diagnostic: '11112221331110100130', retest: '11001' },
  { slug: 'farzona-kholova', name: 'Farzona Kholova', diagnostic: '13011211000003020300', retest: null },
  { slug: 'behruz-tursunov', name: 'Behruz Tursunov', diagnostic: '11112211311000011101', retest: null },
  { slug: 'malika-ergasheva', name: 'Malika Ergasheva', diagnostic: '11102221001200120110', retest: '10111' },
  { slug: 'iskandar-boboev', name: 'Iskandar Boboev', diagnostic: '11102211211002011111', retest: null },
  // Did not submit the diagnostic (handoff `notSubmitted`).
  { slug: 'daler-saidov', name: 'Daler Saidov', diagnostic: null, retest: null },
  { slug: 'sofia-ivanova', name: 'Sofia Ivanova', diagnostic: null, retest: null },
];

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'];

/** Answers for an attempt from a string of option indexes, matched to questions in quiz order. */
export function answersFromChoices(questionKeys: string[], choices: string): { questionKey: string; optionKey: string }[] {
  if (questionKeys.length !== choices.length) throw new Error(`Cohort script: ${choices.length} answers for ${questionKeys.length} questions`);
  return questionKeys.map((questionKey, i) => {
    const optionKey = OPTION_KEYS[Number(choices[i])];
    if (!optionKey) throw new Error(`Cohort script: invalid option index "${choices[i]}"`);
    return { questionKey, optionKey };
  });
}
