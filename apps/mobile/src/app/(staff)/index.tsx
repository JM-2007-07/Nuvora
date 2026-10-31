import { router } from 'expo-router';
import { Building2, ShieldCheck, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { Bar, Card, ErrorBox, Hud, IconBadge, Loading, Pill, Ring, Screen, Section, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { useCenterOverview, useStaffSession, useTeacherOverview } from '@/lib/staff-queries';

/**
 * Staff overview. Teachers see their groups and open them answer by answer; center staff see
 * group totals and participation only (the API returns nothing per learner to them).
 */
export default function StaffOverview() {
  const { t, colors } = usePrefs();
  const me = useStaffSession();
  const role = me.data?.staff?.role;
  const teacher = useTeacherOverview(role === 'TEACHER');
  const center = useCenterOverview(role === 'ADMIN' || role === 'COORDINATOR');
  const active = role === 'TEACHER' ? teacher : center;
  const refresh = () => void Promise.all([me.refetch(), active.refetch()]);
  const staff = me.data?.staff;

  return (
    <Screen title={t('tabs.overview')} refreshing={active.isRefetching} onRefresh={refresh}>
      {me.isPending || (role && active.isPending) ? <Loading /> : null}
      {me.isError || active.isError ? <ErrorBox onRetry={refresh} /> : null}
      {staff ? (
        <Hud>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconBadge icon={role === 'TEACHER' ? Users : Building2} tone="mint" size={52} />
            <View style={{ flex: 1 }}>
              <T variant="title" ink="onHud">
                {staff.name}
              </T>
              <T ink="onHudMuted">{staff.title}</T>
            </View>
          </View>
          {role !== 'TEACHER' ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ShieldCheck color={colors.mint} size={16} />
              <T variant="caption" ink="onHudMuted" style={{ flex: 1 }}>
                {t('staff.center')}
              </T>
            </View>
          ) : null}
        </Hud>
      ) : null}

      {teacher.data ? (
        <Section title={t('staff.groups')}>
          {teacher.data.groups.map((g, i) => (
            <Card key={g.code} index={i} onPress={g.recorded ? () => router.push(`/group/${encodeURIComponent(g.code)}`) : undefined} accessibilityLabel={`${g.code} ${g.name}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Ring percent={g.averagePercent ?? 0} size={58} stroke={6} tone={g.averagePercent === null ? 'neutral' : g.averagePercent >= 60 ? 'mint' : 'mag'}>
                  <T variant="strong">{g.averagePercent === null ? '–' : `${g.averagePercent}`}</T>
                </Ring>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="strong">
                    {g.code} · {g.name}
                  </T>
                  <T variant="caption" ink="muted">
                    {t('staff.students', { n: g.studentCount })} · {t('staff.submitted', { n: g.submitted })}
                  </T>
                  {g.weakestTopic ? (
                    <T variant="caption" ink="mag">
                      {t('staff.weakest', { topic: g.weakestTopic.title, n: g.weakestTopic.percent })}
                    </T>
                  ) : null}
                </View>
                {!g.recorded ? <Pill text={t('staff.reference')} /> : null}
              </View>
              <Bar percent={g.studentCount ? Math.round((g.submitted / g.studentCount) * 100) : 0} tone="blue" height={6} />
            </Card>
          ))}
        </Section>
      ) : null}

      {center.data ? (
        <Section title={t('staff.groups')}>
          {center.data.groups.map((g, i) => (
            <Card key={g.code} index={i} onPress={() => router.push(`/center/${encodeURIComponent(g.code)}`)} accessibilityLabel={`${g.code} ${g.name}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Ring percent={g.participationPercent ?? 0} size={58} stroke={6} tone="mint">
                  <T variant="strong">{g.participationPercent === null ? '–' : `${g.participationPercent}`}</T>
                </Ring>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="strong">
                    {g.code} · {g.name}
                  </T>
                  <T variant="caption" ink="muted">
                    {g.teacher} · {t('staff.students', { n: g.students })}
                  </T>
                  {g.diagnosticPercent !== null ? (
                    <T variant="caption" ink="blue">
                      {t('staff.average', { n: g.diagnosticPercent })}
                    </T>
                  ) : null}
                </View>
                {!g.recorded ? <Pill text={t('staff.reference')} /> : null}
              </View>
            </Card>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
