import { useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';
import { Markdown } from '@/components/markdown';
import { Card, ErrorBox, IconBadge, Loading, Pill, Screen, Section, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { shortDate } from '@/lib/queries';
import { useStudentAnswers } from '@/lib/staff-queries';

/** One learner answer by answer (teachers of the group only; the server checks it). */
export default function Student() {
  const { code, slug } = useLocalSearchParams<{ code: string; slug: string }>();
  const { t } = usePrefs();
  const data = useStudentAnswers(code, slug);
  const s = data.data;
  return (
    <Screen back title={s?.student.name ?? ''} subtitle={s ? `${s.group.code} · ${s.group.name}` : undefined}>
      {data.isPending ? <Loading /> : null}
      {data.isError ? <ErrorBox onRetry={() => void data.refetch()} /> : null}
      {s?.attempts.map((a) => (
        <Section key={a.id} title={`${a.quiz.title} · ${shortDate(a.submittedAt)}`} action={<Pill text={`${a.score.correct}/${a.score.total} · ${a.score.percent}%`} tone={a.score.percent >= 60 ? 'mint' : 'mag'} />}>
          {a.answers.map((x, i) => (
            <Card key={x.key} index={i}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconBadge icon={x.isCorrect ? Check : X} tone={x.isCorrect ? 'mint' : 'mag'} size={30} />
                <T variant="label" ink="faint" style={{ flex: 1 }}>
                  Q{x.number} · {x.topic.title}
                </T>
              </View>
              <Markdown source={x.prompt} size={15} />
              <T variant="caption" ink={x.isCorrect ? 'mint' : 'mag'}>
                {t('student.chosen')}: {x.chosen || '—'}
              </T>
              {!x.isCorrect ? (
                <T variant="caption" ink="mint">
                  {t('student.right')}: {x.correctOption}
                </T>
              ) : null}
            </Card>
          ))}
        </Section>
      ))}
    </Screen>
  );
}
