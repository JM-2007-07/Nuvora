import { ProgressSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Body, Card, ErrorBox, Loading, Pill, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';

const tone = { MASTERED: 'mint', DEVELOPING: 'blue', WEAK: 'mag', NOT_STARTED: 'neutral' } as const;

/** The learner's topics with mastery and before/after, from the same API as the website. */
export default function Home() {
  const { colors, t, locale } = usePrefs();
  const progress = useQuery({ queryKey: ['progress', 'javascript', locale], queryFn: () => api('/me/progress?subject=javascript', ProgressSchema, { locale }) });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={progress.isRefetching} onRefresh={() => void progress.refetch()} tintColor={colors.mint} />}>
        {progress.isPending ? <Loading /> : null}
        {progress.isError ? <ErrorBox onRetry={() => void progress.refetch()} /> : null}
        {progress.data ? (
          <>
            <Title>{t('home.hello', { name: progress.data.learner.displayName })}</Title>
            <Body muted>{t('home.skills', { subject: progress.data.subject.title })}</Body>
            {progress.data.topics.every((x) => x.scorePercent === null) ? <Body muted>{t('home.none')}</Body> : null}
            {progress.data.topics.map((x, i) => (
              <Card key={x.topic.slug} index={i} accessible accessibilityLabel={`${x.topic.title}: ${x.scorePercent ?? '—'}%, ${t(`home.status.${x.status}`)}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <Body style={{ fontWeight: '700', flexShrink: 1 }}>{x.topic.title}</Body>
                  <Pill text={t(`home.status.${x.status}`)} tone={tone[x.status]} />
                </View>
                <Bar percent={x.scorePercent ?? 0} tone={x.status === 'WEAK' ? 'mag' : x.status === 'DEVELOPING' ? 'blue' : 'mint'} />
                {x.before && x.after ? (
                  <Body muted style={{ fontSize: 14 }}>
                    {x.before.scorePercent}% → {x.after.scorePercent}%
                  </Body>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
