import { type ExamResult, ExamResultSchema, type ExamState, ExamStateSchema, ExamEventResultSchema, SaveAnswerResultSchema } from '@nuvora/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, CircleCheckBig, Clock, CloudOff, Info, ListChecks, Megaphone, Pause, Send, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CodeBlock, Markdown } from '@/components/markdown';
import { Bar, Button, Card, Empty, Hud, IconBadge, Loading, Pill, Ring, Screen, Section, T, tap } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import { shortDate, useAssignments } from '@/lib/queries';
import { getItem, setItem } from '@/lib/storage';

type Phase = { kind: 'intro' } | { kind: 'starting' } | { kind: 'running'; state: ExamState } | { kind: 'result'; result: ExamResult } | { kind: 'blocked'; code: string };

/**
 * Native exam (Standard Exam Mode). The server keeps the clock and the score; this screen saves
 * every answer at once (idempotent by sequence number), reports leaving the app and losing the
 * connection as signals for the teacher, and follows the teacher's pause, warnings and extensions.
 */
export default function Exam() {
  const { id, attempt, result } = useLocalSearchParams<{ id: string; attempt?: string; result?: string }>();
  const { t, locale, colors } = usePrefs();
  const [phase, setPhase] = useState<Phase>(attempt || result ? { kind: 'starting' } : { kind: 'intro' });
  const meta = useAssignments().data?.items.find((a) => a.id === id);

  const begin = useCallback(async () => {
    setPhase({ kind: 'starting' });
    try {
      const state = await api(`/me/assessments/${id}/attempts`, ExamStateSchema, { method: 'POST', locale });
      if (state.status === 'IN_PROGRESS' || state.status === 'PAUSED') setPhase({ kind: 'running', state });
      else setPhase({ kind: 'result', result: await api(`/me/assessment-attempts/${state.attemptId}/result`, ExamResultSchema, { locale }) });
    } catch (e) {
      setPhase({ kind: 'blocked', code: e instanceof ApiError ? e.code : 'OFFLINE' });
    }
  }, [id, locale]);

  useEffect(() => {
    if (result) {
      // A submitted attempt: show its result (what it reveals follows the teacher's setting).
      api(`/me/assessment-attempts/${result}/result`, ExamResultSchema, { locale })
        .then((r) => setPhase({ kind: 'result', result: r }))
        .catch((e) => setPhase({ kind: 'blocked', code: e instanceof ApiError ? e.code : 'OFFLINE' }));
    } else if (attempt) {
      // Continue a known attempt; once it is finished, show its result instead of starting again.
      api(`/me/assessment-attempts/${attempt}`, ExamStateSchema, { locale })
        .then(async (state) => {
          if (state.status === 'IN_PROGRESS' || state.status === 'PAUSED') setPhase({ kind: 'running', state });
          else setPhase({ kind: 'result', result: await api(`/me/assessment-attempts/${attempt}/result`, ExamResultSchema, { locale }) });
        })
        .catch(() => void begin());
    }
  }, [attempt, result, begin, locale]);
  if ((result || attempt) && phase.kind === 'starting')
    return (
      <Screen back>
        <Loading />
      </Screen>
    );

  if (phase.kind === 'intro' || phase.kind === 'starting')
    return (
      <Screen back title={t('exam.introTitle')}>
        {meta ? (
          <Card>
            <T variant="heading">{meta.title}</T>
            {meta.description ? <T ink="muted">{meta.description}</T> : null}
            <View style={styles.pills}>
              <Pill icon={Clock} text={meta.timeLimitMinutes ? t('common.min', { n: meta.timeLimitMinutes }) : t('tests.noLimit')} />
              <Pill icon={ListChecks} text={t('exam.questions', { n: meta.questionCount })} />
              {meta.closesAt ? <Pill icon={CalendarClock} text={`→ ${shortDate(meta.closesAt, true)}`} /> : null}
            </View>
          </Card>
        ) : null}
        <Hud>
          <IconBadge icon={ShieldCheck} tone="mint" size={52} />
          {(['exam.intro1', 'exam.intro2', 'exam.intro3'] as const).map((k) => (
            <View key={k} style={styles.bullet}>
              <Info color={colors.hudMuted} size={18} />
              <T ink="onHud" style={{ flex: 1 }}>
                {t(k)}
              </T>
            </View>
          ))}
          <Button kind="hud" label={t('exam.begin')} busy={phase.kind === 'starting'} onPress={() => void begin()} />
        </Hud>
      </Screen>
    );
  if (phase.kind === 'blocked') {
    const message = { NOT_OPEN_YET: t('exam.notYet'), CLOSED: t('exam.closed'), NO_ATTEMPTS_LEFT: t('exam.noAttempts'), READMIT_REQUIRED: t('exam.readmit') }[phase.code] ?? t('common.error');
    return (
      <Screen back title={t('tests.title')}>
        <Empty icon={Info} title={message} action={<Button kind="ghost" label={t('common.retry')} onPress={() => void begin()} />} />
      </Screen>
    );
  }
  if (phase.kind === 'result') return <ExamResultView result={phase.result} />;
  return <Runner initial={phase.state} onFinished={(result) => setPhase({ kind: 'result', result })} />;
}

function Runner({ initial, onFinished }: { initial: ExamState; onFinished: (r: ExamResult) => void }) {
  const { t, colors, fonts, locale } = usePrefs();
  const reduced = useReducedMotion();
  const network = useNetworkState();
  const queryClient = useQueryClient();
  const [state, setState] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, number>>(initial.answers);
  const [index, setIndex] = useState(0);
  const [sync, setSync] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [signal, setSignal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(new Date(initial.serverNow).getTime() - Date.now());
  const seq = useRef(initial.lastSeq);
  const unsent = useRef(new Map<string, { optionKey: number; seq: number }>());
  const attemptId = initial.attemptId;
  const online = network.isInternetReachable ?? network.isConnected ?? true;

  // Sequence numbers survive an app restart, so a late duplicate can never overwrite a newer answer.
  useEffect(() => {
    void getItem(`faroz.exam.seq.${attemptId}`).then((v) => {
      seq.current = Math.max(seq.current, Number(v ?? 0));
    });
  }, [attemptId]);

  const finish = useCallback(async () => {
    const result = await api(`/me/assessment-attempts/${attemptId}/result`, ExamResultSchema, { locale });
    void queryClient.invalidateQueries({ queryKey: ['assessments'] });
    onFinished(result);
  }, [attemptId, locale, onFinished, queryClient]);

  const refresh = useCallback(async () => {
    try {
      const next = await api(`/me/assessment-attempts/${attemptId}`, ExamStateSchema, { locale });
      offset.current = new Date(next.serverNow).getTime() - Date.now();
      setState(next);
      if (next.status !== 'IN_PROGRESS' && next.status !== 'PAUSED') await finish();
    } catch {
      /* offline: keep going, the next poll retries */
    }
  }, [attemptId, locale, finish]);

  // Unsent answers are kept on the device too, so closing the app while offline loses nothing.
  const unsentKey = `faroz.exam.unsent.${attemptId}`;
  const persist = useCallback(() => void setItem(unsentKey, JSON.stringify([...unsent.current])), [unsentKey]);

  const flush = useCallback(async () => {
    if (!unsent.current.size) return setSync('saved');
    setSync('saving');
    let stop: 'offline' | 'refresh' | null = null;
    for (const [questionId, item] of [...unsent.current]) {
      try {
        const r = await api(`/me/assessment-attempts/${attemptId}/answers/${questionId}`, SaveAnswerResultSchema, { method: 'PUT', body: item, locale });
        if (unsent.current.get(questionId)?.seq === item.seq) unsent.current.delete(questionId);
        if (r.status !== 'IN_PROGRESS') stop = 'refresh';
      } catch (e) {
        if (e instanceof ApiError) {
          unsent.current.delete(questionId);
          if (e.code === 'ATTEMPT_PAUSED' || e.code === 'ATTEMPT_CLOSED') stop = 'refresh';
        } else stop = 'offline';
      }
      if (stop) break;
    }
    persist();
    setSync(unsent.current.size ? 'offline' : 'saved');
    if (stop === 'refresh') void refresh();
  }, [attemptId, locale, refresh, persist]);

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    void getItem(unsentKey).then((raw) => {
      let saved: [string, { optionKey: number; seq: number }][] = [];
      try {
        const parsed: unknown = JSON.parse(raw ?? '[]');
        if (Array.isArray(parsed)) saved = parsed.filter((x): x is [string, { optionKey: number; seq: number }] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1]?.optionKey === 'number' && typeof x[1]?.seq === 'number');
      } catch {
        /* a damaged entry is dropped; the server keeps everything that did arrive */
      }
      if (!saved.length) return;
      for (const [questionId, item] of saved) if (!unsent.current.has(questionId)) unsent.current.set(questionId, item);
      setAnswers((a) => ({ ...a, ...Object.fromEntries(saved.map(([questionId, item]) => [questionId, item.optionKey])) }));
      void flush();
    });
  }, [unsentKey, flush]);

  const report = useCallback(
    async (kind: 'APP_BACKGROUND' | 'APP_FOREGROUND' | 'OFFLINE' | 'ONLINE') => {
      try {
        const r = await api(`/me/assessment-attempts/${attemptId}/events`, ExamEventResultSchema, { method: 'POST', body: { kind, clientAt: new Date().toISOString() }, locale });
        if (r.outcome !== 'recorded') setSignal(true);
        if (r.status !== 'IN_PROGRESS') void refresh();
      } catch {
        /* the event is informational; the server also notices missing answers and connections */
      }
    },
    [attemptId, locale, refresh],
  );

  // Clock tick, polling, app state and connectivity.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      void refresh();
      // Answers that failed while the server was unreachable are retried on every poll.
      if (unsent.current.size) void flush();
    }, 10_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refresh, flush]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') void report('APP_BACKGROUND');
      if (s === 'active') {
        void report('APP_FOREGROUND');
        void refresh();
        void flush();
      }
    });
    return () => sub.remove();
  }, [report, refresh, flush]);
  const wasOnline = useRef(online);
  useEffect(() => {
    if (wasOnline.current === online) return;
    wasOnline.current = online;
    if (online) {
      void report('ONLINE');
      void flush();
    } else setSync('offline');
  }, [online, report, flush]);

  const choose = (questionId: string, optionKey: number) => {
    if (state.status !== 'IN_PROGRESS') return;
    tap();
    seq.current += 1;
    void setItem(`faroz.exam.seq.${attemptId}`, String(seq.current));
    setAnswers((a) => ({ ...a, [questionId]: optionKey }));
    unsent.current.set(questionId, { optionKey, seq: seq.current });
    persist();
    void flush();
  };

  const submit = async () => {
    setSubmitting(true);
    await flush();
    try {
      const result = await api(`/me/assessment-attempts/${attemptId}/submit`, ExamResultSchema, { method: 'POST', locale });
      tap('success');
      void queryClient.invalidateQueries({ queryKey: ['assessments'] });
      onFinished(result);
    } catch {
      setSubmitting(false);
      setConfirming(false);
      void refresh();
    }
  };

  const q = state.questions[index]!;
  const total = state.questions.length;
  const answered = Object.keys(answers).length;
  const left = state.deadlineAt ? Math.max(0, new Date(state.deadlineAt).getTime() - (now + offset.current)) : null;
  const mm = left === null ? null : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  const lowTime = left !== null && left < 60_000;
  const paused = state.status === 'PAUSED';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.top, { borderColor: colors.line, backgroundColor: colors.sideBg }]}>
        <View style={{ flex: 1 }}>
          <T variant="strong" numberOfLines={1}>
            {state.assessment.title}
          </T>
          <View style={styles.syncRow}>
            {sync === 'offline' ? <CloudOff color={colors.goldInk} size={14} /> : sync === 'saved' ? <CircleCheckBig color={colors.mintInk} size={14} /> : null}
            <T variant="caption" ink={sync === 'offline' ? 'gold' : sync === 'saved' ? 'mint' : 'muted'}>
              {t(sync === 'saved' ? 'exam.saved' : sync === 'saving' ? 'exam.saving' : 'exam.offline')}
            </T>
          </View>
        </View>
        {mm ? (
          <View accessible accessibilityRole="timer" accessibilityLabel={`${t('exam.left')} ${mm}`} style={[styles.timer, { backgroundColor: lowTime ? colors.magTint : colors.panel2 }]}>
            <Clock color={lowTime ? colors.magInk : colors.muted} size={16} />
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: lowTime ? colors.magInk : colors.text, fontVariant: ['tabular-nums'] }}>{mm}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <Bar percent={(answered / total) * 100} tone="mint" height={5} />
      </View>

      <Animated.ScrollView contentContainerStyle={styles.body}>
        {state.notice ? (
          <Animated.View entering={reduced ? undefined : FadeInDown}>
            <Card style={{ backgroundColor: colors.goldTint, borderColor: colors.gold, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Megaphone color={colors.goldInk} size={22} />
              <View style={{ flex: 1 }}>
                <T variant="label" ink="gold">
                  {t('exam.warning')}
                </T>
                <T>{state.notice}</T>
              </View>
            </Card>
          </Animated.View>
        ) : null}
        {signal ? (
          <Pressable onPress={() => setSignal(false)}>
            <Card style={{ backgroundColor: colors.magTint, borderColor: colors.mag }}>
              <T>{t('exam.signal')}</T>
            </Card>
          </Pressable>
        ) : null}

        <T variant="label" ink="faint">
          {t('quiz.question', { n: index + 1, total })}
        </T>
        <Animated.View key={q.id} entering={reduced ? undefined : FadeIn.duration(200)} style={{ gap: 12 }}>
          <Card>
            <Markdown source={q.prompt} size={17} />
            {q.code ? <CodeBlock code={q.code} /> : null}
          </Card>
          <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
            {q.options.map((o, i) => {
              const on = answers[q.id] === o.key;
              return (
                <Pressable
                  key={o.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: paused }}
                  disabled={paused}
                  onPress={() => choose(q.id, o.key)}
                  style={[styles.option, { backgroundColor: on ? colors.blueTint : colors.panel, borderColor: on ? colors.blue : colors.line }]}
                >
                  <View style={[styles.letter, { backgroundColor: on ? colors.blue : colors.panel2 }]}>
                    <Text style={{ color: on ? colors.onBlue : colors.muted, fontFamily: fonts.bold }}>{String.fromCharCode(65 + i)}</Text>
                  </View>
                  <T style={{ flex: 1 }}>{o.text}</T>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.dots}>
          {state.questions.map((x, i) => (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              accessibilityLabel={t('quiz.question', { n: i + 1, total })}
              onPress={() => setIndex(i)}
              style={[styles.dot, { backgroundColor: i === index ? colors.blue : answers[x.id] !== undefined ? colors.mintTint : colors.panel2, borderColor: i === index ? colors.blue : colors.line }]}
            >
              <Text style={{ color: i === index ? colors.onBlue : answers[x.id] !== undefined ? colors.mintInk : colors.muted, fontFamily: fonts.semibold }}>{i + 1}</Text>
            </Pressable>
          ))}
        </View>

        {confirming ? (
          <Card style={{ borderColor: colors.blue, gap: 12 }}>
            <T variant="strong">{t('exam.submitConfirm', { n: total - answered })}</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind="ghost" label={t('common.cancel')} onPress={() => setConfirming(false)} style={{ flex: 1 }} />
              <Button icon={Send} label={t('exam.submit')} busy={submitting} onPress={() => void submit()} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button kind="ghost" label={t('quiz.prev')} disabled={index === 0} onPress={() => setIndex((i) => i - 1)} style={{ flex: 1 }} />
            {index < total - 1 ? (
              <Button label={t('quiz.next')} onPress={() => setIndex((i) => i + 1)} style={{ flex: 1 }} />
            ) : (
              <Button icon={Send} label={t('exam.submit')} disabled={paused} onPress={() => setConfirming(true)} style={{ flex: 1 }} />
            )}
          </View>
        )}
      </Animated.ScrollView>

      {paused ? (
        <Animated.View entering={reduced ? undefined : FadeIn} style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.scrim }]}>
          <Card style={{ alignItems: 'center', gap: 12, maxWidth: 360 }}>
            <IconBadge icon={Pause} tone="blue" size={56} />
            <T variant="title" style={{ textAlign: 'center' }}>
              {t('exam.paused')}
            </T>
            <T ink="muted" style={{ textAlign: 'center' }}>
              {t('exam.pausedBody')}
            </T>
          </Card>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

export function ExamResultView({ result }: { result: ExamResult }) {
  const { t, colors } = usePrefs();
  const reduced = useReducedMotion();
  const tone = result.percent >= 80 ? 'mint' : result.percent >= 50 ? 'blue' : 'gold';
  const note = result.status === 'EXPIRED' ? t('exam.expired') : result.status === 'ENDED' ? t('exam.ended') : null;
  return (
    <Screen back title={t('quiz.resultTitle')}>
      <Hud>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(11)}>
            <Ring percent={result.percent} size={140} stroke={12} tone={tone} label={t('quiz.score', { correct: result.correct, total: result.total })}>
              <Animated.View entering={reduced ? undefined : ZoomIn.delay(650).springify()}>
                <CircleCheckBig color={colors.mint} size={48} strokeWidth={2.4} />
              </Animated.View>
            </Ring>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(500)} style={{ alignItems: 'center', gap: 4 }}>
            <T variant="title" ink="onHud">
              {result.status === 'SUBMITTED' ? t('exam.submitted') : t('exam.ended')}
            </T>
            <T variant="display" ink="onHud">
              {result.percent}%
            </T>
            <T ink="onHudMuted">{t('quiz.score', { correct: result.correct, total: result.total })}</T>
            {note ? <T ink="onHudMuted">{note}</T> : null}
          </Animated.View>
        </View>
      </Hud>
      {result.revealed ? (
        <Section title={t('quiz.review')}>
          {result.questions.map((q, i) => (
            <Card key={q.id} index={i} style={{ borderColor: q.isCorrect ? colors.mint : colors.mag }}>
              <T variant="label" ink="faint">
                {t('quiz.question', { n: q.number, total: result.questions.length })}
              </T>
              <Markdown source={q.prompt} />
              {q.code ? <CodeBlock code={q.code} /> : null}
              <T variant="caption" ink="muted">
                {t('quiz.yourAnswer')}: {q.chosen ?? '—'}
              </T>
              {!q.isCorrect ? (
                <T variant="caption" ink="mint">
                  {t('quiz.correctAnswer')}: {q.correct}
                </T>
              ) : null}
              {q.explanation ? <T variant="caption" ink="muted">{q.explanation}</T> : null}
            </Card>
          ))}
        </Section>
      ) : (
        <T ink="muted">{result.revealAt ? t('exam.hiddenUntil', { date: shortDate(result.revealAt, true) }) : t('exam.hidden')}</T>
      )}
      <Button kind="ghost" label={t('common.done')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  body: { padding: 20, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 18, padding: 14, minHeight: 60 },
  letter: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dot: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { alignItems: 'center', justifyContent: 'center', padding: 24 },
});
