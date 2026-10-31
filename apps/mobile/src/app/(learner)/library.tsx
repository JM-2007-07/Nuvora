import { BookOpen, Dumbbell, FileText, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Empty, ErrorBox, Loading, Pill, Row, Screen, Segmented } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { useLibrary } from '@/lib/queries';

const ICON = { BOOK: BookOpen, ARTICLE: FileText, VIDEO: PlayCircle, EXERCISE: Dumbbell } as const;
const TONE = { BOOK: 'blue', ARTICLE: 'mint', VIDEO: 'mag', EXERCISE: 'gold' } as const;

/** Further reading for every topic: books, articles, videos and exercises. */
export default function Library() {
  const { t } = usePrefs();
  const library = useLibrary();
  const [type, setType] = useState<'all' | keyof typeof ICON>('all');
  const items = (library.data?.items ?? []).filter((i) => type === 'all' || i.resource.type === type);
  return (
    <Screen title={t('library.title')} subtitle={t('library.subtitle')} refreshing={library.isRefetching} onRefresh={() => void library.refetch()}>
      <Segmented
        label={t('library.title')}
        value={type}
        onChange={setType}
        options={[
          { key: 'all', label: '∗' },
          { key: 'BOOK', label: t('type.BOOK') },
          { key: 'ARTICLE', label: t('type.ARTICLE') },
          { key: 'EXERCISE', label: t('type.EXERCISE') },
        ]}
      />
      {library.isPending ? <Loading /> : null}
      {library.isError ? <ErrorBox onRetry={() => void library.refetch()} /> : null}
      {library.data && !items.length ? <Empty icon={BookOpen} title={t('library.empty')} /> : null}
      <View style={{ gap: 10 }}>
        {items.map(({ resource: r, topic }, i) => (
          <Row
            key={`${topic.slug}-${r.key}`}
            index={i}
            icon={ICON[r.type]}
            tone={TONE[r.type]}
            title={r.title}
            subtitle={`${r.author} · ${topic.title}\n${r.whyUseful}`}
            badge={<Pill text={r.languages.join(' · ').toUpperCase()} />}
            onPress={r.url ? () => void Linking.openURL(r.url!) : undefined}
          />
        ))}
      </View>
    </Screen>
  );
}
