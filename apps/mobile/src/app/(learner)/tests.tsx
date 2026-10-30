import { LearnerAssessmentListSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Card, ErrorBox, Loading, Pill, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';

/**
 * Assessments the learner's teachers assigned (same data as the website). Taking an exam in the
 * app needs the native exam player with app-background signals; until then the app shows what is
 * assigned and the results, and says plainly where to take it.
 */
export default function Tests() {
  const { colors, t, locale } = usePrefs();
  const list = useQuery({ queryKey: ['assessments', locale], queryFn: () => api('/me/assessments', LearnerAssessmentListSchema, { locale }) });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.mint} />}>
        <Title>{t('tests.title')}</Title>
        {list.isPending ? <Loading /> : null}
        {list.isError ? <ErrorBox onRetry={() => void list.refetch()} /> : null}
        {list.data && list.data.items.length === 0 ? <Body muted>{t('tests.empty')}</Body> : null}
        {list.data?.items.map((a, i) => (
          <Card key={a.id} index={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Body style={{ fontWeight: '700', flexShrink: 1 }}>{a.title}</Body>
              <Pill text={t(a.window === 'open' ? 'tests.open' : a.window === 'scheduled' ? 'tests.scheduled' : 'tests.closed')} tone={a.window === 'open' ? 'mint' : a.window === 'scheduled' ? 'gold' : 'neutral'} />
            </View>
            <Body muted style={{ fontSize: 14 }}>
              {a.groupCode} · {a.timeLimitMinutes ? t('tests.minutes', { n: a.timeLimitMinutes }) : t('tests.noLimit')} · {t('tests.attempts', { used: a.attemptsUsed, allowed: a.attemptsAllowed })}
            </Body>
            {a.lastResult ? <Body>{t('tests.result', { correct: a.lastResult.correct, total: a.lastResult.total })}</Body> : null}
            {a.window === 'open' ? <Body muted style={{ fontSize: 14 }}>{t('tests.webOnly')}</Body> : null}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
