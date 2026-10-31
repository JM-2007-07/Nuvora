import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, ClipboardCheck, CloudUpload, Flame, Radar, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bar, Button, Card, ErrorBox, Hud, IconBadge, Loading, Pill, Ring, Screen, Section, T } from '@/components/ui';
import { flushQueue, queue, type QueueItem } from '@/lib/offline';
import { usePrefs } from '@/lib/prefs';
import { DIAGNOSTIC, STATUS_TONE, useAssignments, useProgress, useStats } from '@/lib/queries';

/** Learner home: level and streak, the next step, assigned tests, skills and before/after. */
export default function Home() {
  const { t, locale, colors } = usePrefs();
  const progress = useProgress();
  const stats = useStats();
  const assignments = useAssignments();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void queue().then((q) => setPending(q.filter((i) => i.status === 'pending')));
    }, []),
  );

  const refresh = () => void Promise.all([progress.refetch(), stats.refetch(), assignments.refetch()]);
  const p = progress.data;
  const s = stats.data;
  const open = assignments.data?.items.filter((a) => a.window === 'open' && (a.activeAttemptId || a.attemptsUsed < a.attemptsAllowed)) ?? [];
  const weakest = p ? [...p.topics].filter((x) => x.scorePercent !== null).sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0))[0] : undefined;
  const diagnosticDone = !!p?.checkpoints.some((c) => c.latestAttempt);

  return (
    <Screen refreshing={progress.isRefetching} onRefresh={refresh}>
      {progress.isPending ? <Loading /> : null}
      {progress.isError ? <ErrorBox onRetry={refresh} /> : null}
      {p ? (
        <>
          <View style={{ gap: 4 }}>
            <T variant="caption" ink="muted">
              {t('app.tagline')}
            </T>
            <T variant="display">{t('home.hello', { name: p.learner.displayName.split(' ')[0]! })}</T>
          </View>

          <Hud>
            <View style={styles.hudRow}>
              <Ring percent={s ? Math.round(((s.xp - s.levelStart) / Math.max(1, s.levelEnd - s.levelStart)) * 100) : 0} size={92} stroke={9} tone="mint" label={s ? t('home.level', { n: s.level }) : undefined}>
                <T variant="number" ink="onHud">
                  {s?.level ?? '–'}
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 6 }}>
                <T variant="label" ink="onHudMuted">
                  {s ? t('home.level', { n: s.level }) : ' '}
                </T>
                <T variant="title" ink="onHud">
                  {s ? t('home.xp', { xp: s.xp }) : '…'}
                </T>
                <T variant="caption" ink="onHudMuted">
                  {s ? t('home.toNext', { n: s.levelEnd - s.xp, level: s.level + 1 }) : ' '}
                </T>
              </View>
              <View style={[styles.streak, { borderColor: colors.hudMuted }]} accessible accessibilityLabel={`${t('home.streak')}: ${t('home.days', { n: s?.streakDays ?? 0 })}`}>
                <Flame color={colors.gold} size={22} />
                <T variant="strong" ink="onHud">
                  {s?.streakDays ?? 0}
                </T>
                <T variant="caption" ink="onHudMuted">
                  {t('home.streak')}
                </T>
              </View>
            </View>
          </Hud>

          <Card index={1} style={{ gap: 14 }}>
            <View style={styles.rowCenter}>
              <IconBadge icon={Sparkles} tone={weakest && weakest.status === 'WEAK' ? 'mag' : 'blue'} />
              <View style={{ flex: 1 }}>
                <T variant="label" ink="faint">
                  {t('home.next')}
                </T>
                <T variant="strong">
                  {!diagnosticDone ? t('home.nextStart') : weakest && (weakest.status === 'WEAK' || weakest.status === 'DEVELOPING') ? t('home.nextWeak', { topic: weakest.topic.title, score: weakest.scorePercent ?? 0 }) : t('home.nextAll')}
                </T>
              </View>
            </View>
            {!diagnosticDone ? (
              <Button icon={Radar} label={t('home.startDiagnostic')} onPress={() => router.push(`/quiz/${DIAGNOSTIC}`)} />
            ) : weakest ? (
              <Button icon={ArrowRight} label={t('home.openTopic')} onPress={() => router.push(`/topic/${weakest.topic.slug}`)} />
            ) : null}
          </Card>

          {open.length ? (
            <Card index={2} onPress={() => router.push('/(learner)/tests')} style={styles.rowCenter} accessibilityLabel={`${t('home.assigned')}. ${t('home.assignedCount', { n: open.length })}`}>
              <IconBadge icon={ClipboardCheck} tone="gold" />
              <View style={{ flex: 1 }}>
                <T variant="strong">{t('home.assigned')}</T>
                <T variant="caption" ink="muted">
                  {t('home.assignedCount', { n: open.length })}
                </T>
              </View>
              <Pill text={open[0]!.title} tone="gold" />
            </Card>
          ) : null}

          {pending.length ? (
            <Card index={3} style={styles.rowCenter}>
              <IconBadge icon={CloudUpload} tone="blue" />
              <View style={{ flex: 1 }}>
                <T variant="strong">{t('home.queue')}</T>
                <T variant="caption" ink="muted">
                  {t('home.queuePending', { n: pending.length })}
                </T>
              </View>
              <Button
                compact
                kind="soft"
                label={t('home.syncNow')}
                busy={syncing}
                onPress={async () => {
                  setSyncing(true);
                  await flushQueue(locale);
                  setPending((await queue()).filter((i) => i.status === 'pending'));
                  setSyncing(false);
                  void queryClient.invalidateQueries();
                }}
              />
            </Card>
          ) : null}

          <Section title={t('home.skills', { subject: p.subject.title })}>
            <View style={styles.grid}>
              {p.topics.map((x, i) => (
                <Pressable
                  key={x.topic.slug}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.topic.title}: ${x.scorePercent ?? '—'}%, ${t(`status.${x.status}`)}`}
                  onPress={() => router.push(`/topic/${x.topic.slug}`)}
                  style={styles.cell}
                >
                  <Card index={i + 3} style={styles.skill}>
                    <Ring percent={x.scorePercent ?? 0} size={64} stroke={7} tone={STATUS_TONE[x.status]}>
                      <T variant="strong">{x.scorePercent === null ? '–' : `${x.scorePercent}`}</T>
                    </Ring>
                    <T variant="strong" numberOfLines={1} style={{ textAlign: 'center' }}>
                      {x.topic.title}
                    </T>
                    <Pill center text={t(`status.${x.status}`)} tone={STATUS_TONE[x.status]} />
                  </Card>
                </Pressable>
              ))}
            </View>
          </Section>

          {p.topics.some((x) => x.before && x.after) ? (
            <Section title={t('home.beforeAfter')}>
              <Card>
                {p.topics
                  .filter((x) => x.before && x.after)
                  .map((x) => (
                    <View key={x.topic.slug} style={{ gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <T variant="strong">{x.topic.title}</T>
                        <T variant="strong" ink={x.after!.scorePercent >= x.before!.scorePercent ? 'mint' : 'mag'}>
                          {x.before!.scorePercent}% → {x.after!.scorePercent}%
                        </T>
                      </View>
                      <Bar percent={x.before!.scorePercent} tone="mag" height={6} />
                      <Bar percent={x.after!.scorePercent} tone="mint" height={6} />
                    </View>
                  ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hudRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streak: { alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, minWidth: 72 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47.5%', flexGrow: 1 },
  skill: { alignItems: 'center', gap: 8, paddingVertical: 16 },
});
