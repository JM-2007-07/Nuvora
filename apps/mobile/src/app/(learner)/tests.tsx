import { router } from 'expo-router';
import { ClipboardCheck, Clock, Play, RotateCw, Trophy } from 'lucide-react-native';
import { View } from 'react-native';
import { Button, Card, Empty, ErrorBox, IconBadge, Loading, Pill, Screen, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { shortDate, useAssignments } from '@/lib/queries';

/** Assessments the learner's teachers assigned, taken here in exam mode. */
export default function Tests() {
  const { t } = usePrefs();
  const list = useAssignments();
  return (
    <Screen title={t('tests.title')} subtitle={t('tests.subtitle')} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {list.isPending ? <Loading /> : null}
      {list.isError ? <ErrorBox onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.items.length === 0 ? <Empty icon={ClipboardCheck} title={t('tests.empty')} /> : null}
      {list.data?.items.map((a, i) => {
        const canStart = a.window === 'open' && (!!a.activeAttemptId || a.attemptsUsed < a.attemptsAllowed);
        const tone = a.window === 'open' ? 'mint' : a.window === 'scheduled' ? 'gold' : 'neutral';
        return (
          <Card key={a.id} index={i} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <IconBadge icon={ClipboardCheck} tone={tone} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="strong">{a.title}</T>
                <T variant="caption" ink="muted">
                  {a.groupCode} · {a.subject.title} · {a.questionCount}
                </T>
              </View>
              <Pill text={t(a.window === 'open' ? 'tests.open' : a.window === 'scheduled' ? 'tests.scheduled' : 'tests.closed')} tone={tone} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pill icon={Clock} text={a.timeLimitMinutes ? t('common.min', { n: a.timeLimitMinutes }) : t('tests.noLimit')} />
              <Pill icon={RotateCw} text={t('tests.attempts', { used: a.attemptsUsed, allowed: a.attemptsAllowed })} />
              {a.closesAt ? <Pill text={`→ ${shortDate(a.closesAt, true)}`} /> : null}
              {a.lastResult ? <Pill icon={Trophy} tone="mint" text={t('tests.result', { correct: a.lastResult.correct, total: a.lastResult.total })} /> : null}
            </View>
            {canStart ? (
              <Button icon={Play} label={a.activeAttemptId ? t('tests.continue') : t('tests.start')} onPress={() => router.push(a.activeAttemptId ? `/exam/${a.id}?attempt=${a.activeAttemptId}` : `/exam/${a.id}`)} />
            ) : a.lastResult ? (
              <Button kind="ghost" icon={Trophy} label={t('tests.view')} onPress={() => router.push(`/exam/${a.id}?result=${a.lastResult!.attemptId}`)} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
