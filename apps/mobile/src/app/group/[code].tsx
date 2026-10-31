import { router, useLocalSearchParams } from 'expo-router';
import { CircleHelp, UserRound } from 'lucide-react-native';
import { View } from 'react-native';
import { Bar, Card, ErrorBox, Hud, Loading, Pill, Ring, Row, Screen, Section, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { useGroupAnalytics } from '@/lib/staff-queries';

/** One group's diagnostic from stored answers: topics, hardest questions, learners (teacher only). */
export default function Group() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, colors } = usePrefs();
  const group = useGroupAnalytics(code);
  const g = group.data;
  const hardest = g ? [...g.questions].sort((a, b) => a.correct / Math.max(1, a.answered) - b.correct / Math.max(1, b.answered)).slice(0, 4) : [];

  return (
    <Screen back title={g ? `${g.group.code} · ${g.group.name}` : code} refreshing={group.isRefetching} onRefresh={() => void group.refetch()}>
      {group.isPending ? <Loading /> : null}
      {group.isError ? <ErrorBox onRetry={() => void group.refetch()} /> : null}
      {g ? (
        <>
          <Hud>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ring percent={g.group.averagePercent ?? 0} size={90} stroke={9} tone={(g.group.averagePercent ?? 0) >= 60 ? 'mint' : 'mag'}>
                <T variant="number" ink="onHud">
                  {g.group.averagePercent ?? '–'}
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="strong" ink="onHud">
                  {g.diagnostic.quiz.title}
                </T>
                <T ink="onHudMuted">
                  {t('staff.students', { n: g.group.studentCount })} · {t('staff.submitted', { n: g.group.submitted })}
                </T>
              </View>
            </View>
          </Hud>

          <Section title={t('group.topics')}>
            <Card>
              {g.topics.map((x) => (
                <View key={x.topic.slug} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T variant="strong">{x.topic.title}</T>
                    <T variant="strong" ink={x.score.percent < 60 ? 'mag' : 'mint'}>
                      {x.score.percent}%
                    </T>
                  </View>
                  <Bar percent={x.score.percent} tone={x.score.percent < 60 ? 'mag' : 'mint'} />
                </View>
              ))}
            </Card>
          </Section>

          <Section title={t('group.hardest')}>
            {hardest.map((q, i) => (
              <Card key={q.key} index={i}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <CircleHelp color={colors.magInk} size={20} />
                  <T variant="strong" style={{ flex: 1 }}>
                    Q{q.number} · {q.topic.title}
                  </T>
                  <Pill text={t('group.correctOf', { correct: q.correct, total: q.answered })} tone="mag" />
                </View>
                <T numberOfLines={3}>{q.prompt.replace(/~~~[\s\S]*?~~~/g, '').trim()}</T>
                {q.options.map((o) => (
                  <View key={o.key} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <T variant="caption" ink={o.isCorrect ? 'mint' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
                        {o.text}
                      </T>
                      <T variant="caption" ink={o.isCorrect ? 'mint' : 'muted'}>
                        {o.chosen}
                      </T>
                    </View>
                    <Bar percent={q.answered ? (o.chosen / q.answered) * 100 : 0} tone={o.isCorrect ? 'mint' : 'blue'} height={5} />
                  </View>
                ))}
              </Card>
            ))}
          </Section>

          <Section title={t('group.students')}>
            {g.students.map((s, i) => (
              <Row
                key={s.slug}
                index={i}
                icon={UserRound}
                tone={!s.score ? 'neutral' : s.score.percent >= 60 ? 'mint' : 'mag'}
                title={s.name}
                subtitle={s.score ? t('group.correctOf', { correct: s.score.correct, total: s.score.total }) : t('group.notSubmitted')}
                right={s.score ? <T variant="strong">{s.score.percent}%</T> : null}
                onPress={s.submitted ? () => router.push(`/student/${encodeURIComponent(code)}/${encodeURIComponent(s.slug)}`) : undefined}
              />
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
