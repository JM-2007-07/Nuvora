import { router, useFocusEffect } from 'expo-router';
import { CloudDownload, History, Radar } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Empty, ErrorBox, Loading, Pill, Ring, Row, Screen, Section, T } from '@/components/ui';
import { savedIndex, type SavedIndex } from '@/lib/offline';
import { usePrefs } from '@/lib/prefs';
import { DIAGNOSTIC, shortDate, STATUS_TONE, useProgress } from '@/lib/queries';

/** The learning path: topics in prerequisite order, the diagnostic, results and offline lessons. */
export default function Learn() {
  const { t, colors, locale } = usePrefs();
  const progress = useProgress();
  const [saved, setSaved] = useState<SavedIndex>([]);
  useFocusEffect(
    useCallback(() => {
      void savedIndex().then((all) => setSaved(all.filter((e) => e.locale === locale)));
    }, [locale]),
  );
  const p = progress.data;
  const diag = p?.checkpoints[0];

  return (
    <Screen title={t('learn.title')} subtitle={t('learn.subtitle')} refreshing={progress.isRefetching} onRefresh={() => void progress.refetch()}>
      {progress.isPending ? <Loading /> : null}
      {progress.isError ? <ErrorBox onRetry={() => void progress.refetch()} /> : null}
      {p ? (
        <>
          {diag ? (
            <Row
              icon={Radar}
              tone="blue"
              title={diag.quiz.title}
              subtitle={diag.latestAttempt ? `${diag.latestAttempt.correctCount}/${diag.latestAttempt.totalCount} · ${shortDate(diag.latestAttempt.submittedAt)}` : `${diag.questionCount}`}
              onPress={() => router.push(`/quiz/${DIAGNOSTIC}`)}
            />
          ) : null}

          <View>
            {[...p.topics]
              .sort((a, b) => a.order - b.order)
              .map((x, i, all) => {
                const tone = STATUS_TONE[x.status];
                return (
                  <Pressable key={x.topic.slug} accessibilityRole="button" accessibilityLabel={`${x.topic.title}, ${t(`status.${x.status}`)}`} onPress={() => router.push(`/topic/${x.topic.slug}`)} style={styles.step}>
                    <View style={styles.rail}>
                      <Ring percent={x.scorePercent ?? 0} size={54} stroke={6} tone={tone}>
                        <T variant="strong">{i + 1}</T>
                      </Ring>
                      {i < all.length - 1 ? <View style={[styles.line, { backgroundColor: colors.line2 }]} /> : null}
                    </View>
                    <Card index={i} style={styles.stepCard}>
                      <View style={styles.rowBetween}>
                        <T variant="strong" style={{ flex: 1 }}>
                          {x.topic.title}
                        </T>
                        <T variant="strong" ink={tone === 'neutral' ? 'faint' : tone}>
                          {x.scorePercent === null ? '—' : `${x.scorePercent}%`}
                        </T>
                      </View>
                      <Pill text={t(`status.${x.status}`)} tone={tone} />
                    </Card>
                  </Pressable>
                );
              })}
          </View>

          {p.attempts.length ? (
            <Section title={t('quiz.resultTitle')}>
              {p.attempts.slice(0, 6).map((a, i) => (
                <Row key={a.id} index={i} icon={History} tone={a.scorePercent >= 80 ? 'mint' : a.scorePercent >= 50 ? 'blue' : 'mag'} title={a.quiz.title} subtitle={shortDate(a.submittedAt, true)} chevron={false} right={<T variant="strong">{`${a.correctCount}/${a.totalCount}`}</T>} />
              ))}
            </Section>
          ) : null}

          <Section title={t('learn.saved')}>
            {saved.length ? (
              saved.map((e, i) => <Row key={e.slug} index={i} icon={CloudDownload} tone="mint" title={e.title} subtitle={`${e.topic} · ${shortDate(e.savedAt)}`} onPress={() => router.push(`/lesson/${e.slug}`)} />)
            ) : (
              <Empty icon={CloudDownload} title={t('learn.savedEmpty')} />
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12, minHeight: 92 },
  rail: { alignItems: 'center', width: 54 },
  line: { width: 3, flex: 1, borderRadius: 2, marginVertical: 4 },
  stepCard: { flex: 1, marginBottom: 12, gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
