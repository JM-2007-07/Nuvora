import { router, useLocalSearchParams } from 'expo-router';
import { BookOpenText, ExternalLink, Link2, PencilLine } from 'lucide-react-native';
import { Linking, View } from 'react-native';
import { Button, ErrorBox, Hud, Loading, Pill, Ring, Row, Screen, Section, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { STATUS_TONE, useProgress, useTopic } from '@/lib/queries';

/** One topic: the learner's result, prerequisites, lessons, practice and further reading. */
export default function Topic() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = usePrefs();
  const topic = useTopic(slug);
  const progress = useProgress();
  const mine = progress.data?.topics.find((x) => x.topic.slug === slug);
  const d = topic.data;

  return (
    <Screen back title={d?.title ?? ''} refreshing={topic.isRefetching} onRefresh={() => void topic.refetch()}>
      {topic.isPending ? <Loading /> : null}
      {topic.isError ? <ErrorBox onRetry={() => void topic.refetch()} /> : null}
      {d ? (
        <>
          <Hud>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ring percent={mine?.scorePercent ?? 0} size={84} stroke={8} tone={mine ? STATUS_TONE[mine.status] : 'neutral'} label={mine?.scorePercent !== null && mine ? t('topic.yourScore', { score: mine.scorePercent ?? 0 }) : undefined}>
                <T variant="number" ink="onHud">
                  {mine?.scorePercent ?? '–'}
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 8 }}>
                {mine ? <Pill text={t(`status.${mine.status}`)} tone={STATUS_TONE[mine.status]} /> : null}
                <T ink="onHudMuted">{d.summary}</T>
              </View>
            </View>
            {d.prerequisites.length ? (
              <T variant="caption" ink="onHudMuted">
                {t('topic.requires', { list: d.prerequisites.map((x) => x.title).join(', ') })}
              </T>
            ) : null}
            {d.quiz ? <Button kind="hud" icon={PencilLine} label={t('topic.practice')} onPress={() => router.push(`/quiz/${d.quiz!.slug}`)} /> : null}
          </Hud>

          {d.lessons.length ? (
            <Section title={t('topic.lessons')}>
              {d.lessons.map((l, i) => (
                <Row key={l.slug} index={i} icon={BookOpenText} tone="blue" title={l.title} subtitle={t('lesson.read', { n: l.estimatedMinutes })} onPress={() => router.push(`/lesson/${l.slug}`)} />
              ))}
            </Section>
          ) : null}

          {d.quiz ? (
            <Section title={t('topic.practice')}>
              <Row icon={PencilLine} tone="mint" title={d.quiz.title} subtitle={t('topic.practiceSub', { n: d.quiz.questionCount })} onPress={() => router.push(`/quiz/${d.quiz!.slug}`)} />
            </Section>
          ) : null}

          {d.resources.length ? (
            <Section title={t('topic.resources')}>
              {d.resources.map((r, i) => (
                <Row
                  key={r.key}
                  index={i}
                  icon={r.url ? ExternalLink : Link2}
                  tone="gold"
                  title={r.title}
                  subtitle={`${t(`type.${r.type}`)} · ${r.author}`}
                  onPress={r.url ? () => void Linking.openURL(r.url!) : undefined}
                />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
