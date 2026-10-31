import { LessonCompletionSchema, type LessonDetail, PublicQuizSchema, TopicDetailSchema } from '@nuvora/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCheck, CloudDownload, CloudOff, PencilLine, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Markdown } from '@/components/markdown';
import { Button, Card, ErrorBox, Loading, Pill, Screen, T, tap } from '@/components/ui';
import { api } from '@/lib/api';
import { removeLesson, saveLesson, savedLesson } from '@/lib/offline';
import { usePrefs } from '@/lib/prefs';
import { shortDate, useLesson } from '@/lib/queries';

/** A lesson, readable offline once saved; saving also keeps the topic's practice quiz. */
export default function Lesson() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = usePrefs();
  const queryClient = useQueryClient();
  const online = useLesson(slug);
  const [offline, setOffline] = useState<{ lesson: LessonDetail; savedAt: string; quizSlug: string | null } | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void savedLesson(slug, locale).then((s) => {
      setOffline(s ? { lesson: s.lesson, savedAt: s.savedAt, quizSlug: s.quiz?.slug ?? null } : null);
      setChecked(true);
    });
  }, [slug, locale]);

  const complete = useMutation({
    mutationFn: () => api(`/me/lessons/${slug}/completion`, LessonCompletionSchema, { method: 'PUT', locale }),
    onSuccess: () => {
      tap('success');
      setDone(true);
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const lesson = online.data ?? offline?.lesson ?? null;
  const fromDevice = !online.data && !!offline;

  const download = async () => {
    if (!online.data) return;
    setBusy(true);
    try {
      const topic = await api(`/topics/${online.data.topic.slug}`, TopicDetailSchema, { locale });
      const quiz = topic.quiz ? await api(`/quizzes/${topic.quiz.slug}`, PublicQuizSchema, { locale }) : null;
      await saveLesson(online.data, quiz, locale);
      setOffline({ lesson: online.data, savedAt: new Date().toISOString(), quizSlug: quiz?.slug ?? null });
      tap('success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title={lesson?.topic.title ?? ''}>
      {!lesson && (online.isPending || !checked) ? <Loading rows={4} /> : null}
      {!lesson && online.isError && checked ? <ErrorBox onRetry={() => void online.refetch()} /> : null}
      {lesson ? (
        <>
          <View style={{ gap: 10 }}>
            <T variant="display" style={{ fontSize: 26, lineHeight: 32 }}>
              {lesson.title}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pill text={t('lesson.read', { n: lesson.estimatedMinutes })} tone="blue" />
              {fromDevice ? <Pill icon={CloudOff} text={t('lesson.offlineCopy', { date: shortDate(offline!.savedAt) })} tone="gold" /> : offline ? <Pill icon={CloudDownload} text={t('lesson.downloaded')} tone="mint" /> : null}
            </View>
          </View>
          <Card>
            <Markdown source={lesson.body} />
          </Card>
          <View style={{ gap: 10 }}>
            {!fromDevice ? (
              <Button icon={CheckCheck} kind={done ? 'soft' : 'primary'} label={done ? t('lesson.completed') : t('lesson.complete')} busy={complete.isPending} disabled={done} onPress={() => complete.mutate()} />
            ) : null}
            {offline?.quizSlug || !fromDevice ? (
              <Button
                icon={PencilLine}
                kind="ghost"
                label={t('lesson.practice')}
                onPress={() => router.push(offline?.quizSlug ? `/quiz/${offline.quizSlug}` : `/topic/${lesson.topic.slug}`)}
              />
            ) : null}
            {offline ? (
              <Button
                icon={Trash2}
                kind="ghost"
                label={t('lesson.remove')}
                onPress={async () => {
                  await removeLesson(slug, locale);
                  setOffline(null);
                }}
              />
            ) : (
              <Button icon={CloudDownload} kind="soft" label={t('lesson.download')} busy={busy} onPress={() => void download()} />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
