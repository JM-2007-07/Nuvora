import { type AttemptResult, AttemptResultSchema, type PublicQuiz } from '@nuvora/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, BookOpenText, Check, CloudUpload, RotateCcw, Send, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { Markdown } from '@/components/markdown';
import { Bar, Button, Card, Empty, ErrorBox, Hud, IconBadge, Loading, Pill, Ring, Row, Screen, Section, T, tap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { enqueuePractice, savedQuiz } from '@/lib/offline';
import { usePrefs } from '@/lib/prefs';
import { STATUS_TONE, useQuiz } from '@/lib/queries';

/** Quiz player (diagnostic and topic practice). Scored on the server; queued when offline. */
export default function Quiz() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = usePrefs();
  const online = useQuiz(slug);
  const [offlineQuiz, setOfflineQuiz] = useState<PublicQuiz | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [queued, setQueued] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (online.isError) void savedQuiz(slug, locale).then(setOfflineQuiz);
  }, [online.isError, slug, locale]);

  const quiz = online.data ?? offlineQuiz;
  if (result) return <ResultView result={result} onAgain={() => { setResult(null); setRound((r) => r + 1); }} />;
  if (queued)
    return (
      <Screen back title={quiz?.title ?? ''}>
        <Empty icon={CloudUpload} title={t('quiz.offlineQueued')} action={<Button kind="ghost" label={t('common.done')} onPress={() => router.back()} />} />
      </Screen>
    );
  return (
    <Screen back title={quiz?.title ?? ''} scroll>
      {!quiz && online.isPending ? <Loading rows={3} /> : null}
      {!quiz && online.isError ? <ErrorBox onRetry={() => void online.refetch()} /> : null}
      {quiz ? <Player key={round} quiz={quiz} onResult={setResult} onQueued={() => setQueued(true)} /> : null}
    </Screen>
  );
}

function Player({ quiz, onResult, onQueued }: { quiz: PublicQuiz; onResult: (r: AttemptResult) => void; onQueued: () => void }) {
  const { t, colors, fonts, locale } = usePrefs();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = quiz.questions[index]!;
  const total = quiz.questions.length;
  const answered = Object.keys(answers).length;
  const last = index === total - 1;

  const submit = async () => {
    const list = quiz.questions.filter((x) => answers[x.key]).map((x) => ({ questionKey: x.key, optionKey: answers[x.key]! }));
    setSending(true);
    setError(null);
    try {
      const r = await api(`/quizzes/${quiz.slug}/attempts`, AttemptResultSchema, { method: 'POST', body: { answers: list }, locale });
      tap('success');
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      onResult(r);
    } catch (e) {
      if (e instanceof ApiError) setError(e.code === 'QUIZ_INCOMPLETE' ? t('quiz.unanswered', { n: total - answered }) : t('common.error'));
      else {
        await enqueuePractice(quiz, list);
        onQueued();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <View style={styles.rowBetween}>
          <T variant="label" ink="faint">
            {t('quiz.question', { n: index + 1, total })}
          </T>
          <T variant="caption" ink="muted">
            {t('exam.answered', { n: answered, total })}
          </T>
        </View>
        <Bar percent={((index + 1) / total) * 100} tone="blue" height={6} />
      </View>

      <Animated.View key={q.key} entering={reduced ? undefined : FadeInRight.duration(220)} style={{ gap: 14 }}>
        <Card>
          <Markdown source={q.prompt} size={17} />
        </Card>
        <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
          {q.options.map((o, i) => {
            const on = answers[q.key] === o.key;
            return (
              <Pressable
                key={o.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  tap();
                  setAnswers((a) => ({ ...a, [q.key]: o.key }));
                }}
                style={({ pressed }) => [styles.option, { backgroundColor: on ? colors.blueTint : colors.panel, borderColor: on ? colors.blue : pressed ? colors.line2 : colors.line }]}
              >
                <View style={[styles.letter, { backgroundColor: on ? colors.blue : colors.panel2 }]}>
                  <Text style={{ color: on ? colors.onBlue : colors.muted, fontFamily: fonts.bold }}>{String.fromCharCode(65 + i)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Markdown source={o.text} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {error ? (
        <T ink="mag" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <View style={styles.nav}>
        <Button kind="ghost" icon={ArrowLeft} label={t('quiz.prev')} disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))} style={{ flex: 1 }} />
        {last ? (
          <Button icon={Send} label={t('quiz.submit')} busy={sending} disabled={answered === 0} onPress={() => void submit()} style={{ flex: 1.4 }} />
        ) : (
          <Button icon={ArrowRight} label={t('quiz.next')} onPress={() => setIndex((i) => Math.min(total - 1, i + 1))} style={{ flex: 1.4 }} />
        )}
      </View>
      {last && answered < total ? (
        <T variant="caption" ink="muted" style={{ textAlign: 'center' }}>
          {t('quiz.unanswered', { n: total - answered })}
        </T>
      ) : null}
    </View>
  );
}

function ResultView({ result, onAgain }: { result: AttemptResult; onAgain: () => void }) {
  const { t, colors } = usePrefs();
  const reduced = useReducedMotion();
  const tone = result.scorePercent >= 80 ? 'mint' : result.scorePercent >= 50 ? 'blue' : 'gold';
  return (
    <Screen back title={result.quiz.title}>
      <Hud>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)}>
            <Ring percent={result.scorePercent} size={132} stroke={11} tone={tone} label={t('quiz.score', { correct: result.correctCount, total: result.totalCount })}>
              <T variant="number" ink="onHud" style={{ fontSize: 34, lineHeight: 40 }}>
                {result.scorePercent}%
              </T>
            </Ring>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeIn.delay(450)} style={{ alignItems: 'center', gap: 4 }}>
            <T variant="title" ink="onHud">
              {t('quiz.score', { correct: result.correctCount, total: result.totalCount })}
            </T>
          </Animated.View>
        </View>
      </Hud>

      <Section title={t('quiz.byTopic')}>
        <Card>
          {result.topics.map((x) => (
            <View key={x.topic.slug} style={{ gap: 6 }}>
              <View style={styles.rowBetween}>
                <T variant="strong" style={{ flex: 1 }}>
                  {x.topic.title}
                </T>
                <Pill text={t(`status.${x.status}`)} tone={STATUS_TONE[x.status]} />
              </View>
              <Bar percent={x.scorePercent} tone={x.status === 'WEAK' ? 'mag' : x.status === 'MASTERED' ? 'mint' : 'blue'} />
              <T variant="caption" ink="muted">
                {t('group.correctOf', { correct: x.correctCount, total: x.totalCount })}
              </T>
            </View>
          ))}
        </Card>
      </Section>

      {result.recommendations.length ? (
        <Section title={t('quiz.recommend')}>
          {result.recommendations.map((r, i) => (
            <Row key={`${r.reason}-${r.topic.slug}`} index={i} icon={BookOpenText} tone={r.reason === 'NEXT_TOPIC' ? 'mint' : 'mag'} title={r.lesson?.title ?? r.topic.title} subtitle={r.topic.title} onPress={() => router.push(r.lesson ? `/lesson/${r.lesson.slug}` : `/topic/${r.topic.slug}`)} />
          ))}
        </Section>
      ) : null}

      <Section title={t('quiz.review')}>
        {result.questions.map((q, i) => {
          const chosen = q.options.find((o) => o.key === q.selectedOptionKey);
          const correct = q.options.find((o) => o.key === q.correctOptionKey);
          return (
            <Card key={q.key} index={i} style={{ borderColor: q.isCorrect ? colors.mint : colors.mag }}>
              <View style={styles.rowBetween}>
                <T variant="label" ink="faint">
                  {t('quiz.question', { n: i + 1, total: result.questions.length })}
                </T>
                <IconBadge icon={q.isCorrect ? Check : X} tone={q.isCorrect ? 'mint' : 'mag'} size={30} />
              </View>
              <Markdown source={q.prompt} />
              <T variant="caption" ink="muted">
                {t('quiz.yourAnswer')}: <T variant="caption">{chosen?.text ?? '—'}</T>
              </T>
              {!q.isCorrect ? (
                <T variant="caption" ink="mint">
                  {t('quiz.correctAnswer')}: {correct?.text ?? ''}
                </T>
              ) : null}
              {q.explanation ? <Markdown source={q.explanation} size={15} /> : null}
            </Card>
          );
        })}
      </Section>

      <View style={styles.nav}>
        <Button kind="ghost" icon={RotateCcw} label={t('quiz.again')} onPress={onAgain} style={{ flex: 1 }} />
        {result.topics[0] ? <Button label={t('quiz.toTopic')} onPress={() => router.replace(`/topic/${result.topics[0]!.topic.slug}`)} style={{ flex: 1 }} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 18, padding: 14, minHeight: 60 },
  letter: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  nav: { flexDirection: 'row', gap: 10 },
});
