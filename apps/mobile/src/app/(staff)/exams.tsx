import { router } from 'expo-router';
import { Radio } from 'lucide-react-native';
import { Empty, ErrorBox, Loading, Pill, Row, Screen } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { shortDate } from '@/lib/queries';
import { useStaffSession, useTeacherAssessments } from '@/lib/staff-queries';

/** Teacher's published assessments: open one to watch it live and act. */
export default function Exams() {
  const { t } = usePrefs();
  const me = useStaffSession();
  const teacher = me.data?.staff?.role === 'TEACHER';
  const list = useTeacherAssessments(teacher);
  const items = (list.data?.items ?? []).filter((a) => a.source === 'stored' && a.status !== 'draft');
  return (
    <Screen title={t('exams.title')} subtitle={t('exams.subtitle')} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {me.data && !teacher ? <Empty icon={Radio} title={t('staff.center')} /> : null}
      {teacher && list.isPending ? <Loading /> : null}
      {list.isError ? <ErrorBox onRetry={() => void list.refetch()} /> : null}
      {teacher && list.data && !items.length ? <Empty icon={Radio} title={t('exams.empty')} /> : null}
      {items.map((a, i) => (
        <Row
          key={a.id}
          index={i}
          icon={Radio}
          tone={a.status === 'live' ? 'mint' : a.status === 'scheduled' ? 'gold' : 'neutral'}
          title={a.title}
          subtitle={`${a.groupCode} · ${a.questionCount}${a.closesAt ? ` · → ${shortDate(a.closesAt, true)}` : ''}`}
          badge={<Pill text={t(a.status === 'live' ? 'exams.live' : a.status === 'scheduled' ? 'exams.scheduled' : 'exams.closed')} tone={a.status === 'live' ? 'mint' : a.status === 'scheduled' ? 'gold' : 'neutral'} />}
          onPress={() => router.push(`/live/${a.id}`)}
        />
      ))}
    </Screen>
  );
}
