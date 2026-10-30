import { CenterOverviewSchema, StaffSessionStateSchema, TeacherOverviewSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bar, Body, Card, ErrorBox, Loading, Pill, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';

/**
 * Staff overview. Teachers see their groups with the diagnostic average; center staff see group
 * totals and participation only (the API returns nothing per learner to them).
 */
export default function StaffOverview() {
  const { colors, t, locale } = usePrefs();
  const me = useQuery({ queryKey: ['staff-session'], queryFn: () => api('/staff/session', StaffSessionStateSchema, { locale }) });
  const role = me.data?.staff?.role;
  const teacher = useQuery({ queryKey: ['teach-overview', locale], enabled: role === 'TEACHER', queryFn: () => api('/teach/overview', TeacherOverviewSchema, { locale }) });
  const center = useQuery({ queryKey: ['center-overview', locale], enabled: role === 'ADMIN' || role === 'COORDINATOR', queryFn: () => api('/center/overview', CenterOverviewSchema, { locale }) });
  const active = role === 'TEACHER' ? teacher : center;
  const refresh = () => void Promise.all([me.refetch(), active.refetch()]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' }} refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={refresh} tintColor={colors.mint} />}>
        {me.isPending || (role && active.isPending) ? <Loading /> : null}
        {me.isError || active.isError ? <ErrorBox onRetry={refresh} /> : null}
        {me.data?.staff ? (
          <>
            <Title>{me.data.staff.name}</Title>
            <Body muted>{me.data.staff.title}</Body>
          </>
        ) : null}
        {teacher.data ? (
          <>
            <Body style={{ fontWeight: '700' }}>{t('staff.groups')}</Body>
            {teacher.data.groups.map((g, i) => (
              <Card key={g.code} index={i}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Body style={{ fontWeight: '700', flexShrink: 1 }}>{g.code} · {g.name}</Body>
                  {g.averagePercent !== null ? <Pill text={`${g.averagePercent}%`} tone={g.averagePercent >= 60 ? 'mint' : 'mag'} /> : null}
                </View>
                <Body muted style={{ fontSize: 14 }}>{t('staff.students', { n: g.studentCount })} · {t('staff.submitted', { n: g.submitted })}</Body>
                <Bar percent={g.studentCount ? Math.round((g.submitted / g.studentCount) * 100) : 0} tone="blue" />
              </Card>
            ))}
          </>
        ) : null}
        {center.data ? (
          <>
            <Body muted style={{ fontSize: 14 }}>{t('staff.center')}</Body>
            {center.data.groups.map((g, i) => (
              <Card key={g.code} index={i}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Body style={{ fontWeight: '700', flexShrink: 1 }}>{g.code} · {g.name}</Body>
                  {g.diagnosticPercent !== null ? <Pill text={`${g.diagnosticPercent}%`} tone="blue" /> : null}
                </View>
                <Body muted style={{ fontSize: 14 }}>{g.teacher} · {t('staff.students', { n: g.students })} · {t('staff.submitted', { n: g.submitted })}</Body>
                {g.participationPercent !== null ? <Bar percent={g.participationPercent} tone="mint" /> : null}
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
