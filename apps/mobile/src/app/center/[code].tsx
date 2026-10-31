import { useLocalSearchParams } from 'expo-router';
import { CircleCheck, CircleDashed, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { Bar, Card, ErrorBox, Hud, Loading, Pill, Ring, Row, Screen, Section, T } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { useCenterGroup } from '@/lib/staff-queries';

/** A center's view of one group: totals and who took part, never scores or answers. */
export default function CenterGroup() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { t, colors } = usePrefs();
  const data = useCenterGroup(code);
  const d = data.data;
  return (
    <Screen back title={d ? `${d.group.code} · ${d.group.name}` : code} refreshing={data.isRefetching} onRefresh={() => void data.refetch()}>
      {data.isPending ? <Loading /> : null}
      {data.isError ? <ErrorBox onRetry={() => void data.refetch()} /> : null}
      {d ? (
        <>
          <Hud>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Ring percent={d.group.participationPercent ?? 0} size={88} stroke={9} tone="mint">
                <T variant="number" ink="onHud">
                  {d.group.participationPercent ?? '–'}
                </T>
              </Ring>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="strong" ink="onHud">
                  {d.group.teacher}
                </T>
                <T ink="onHudMuted">
                  {t('staff.students', { n: d.group.students })} · {t('staff.submitted', { n: d.group.submitted })}
                </T>
                {d.group.diagnosticPercent !== null ? <Pill text={t('staff.average', { n: d.group.diagnosticPercent })} tone="blue" /> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ShieldCheck color={colors.mint} size={16} />
              <T variant="caption" ink="onHudMuted" style={{ flex: 1 }}>
                {t('staff.center')}
              </T>
            </View>
          </Hud>
          {d.group.topics ? (
            <Section title={t('group.topics')}>
              <Card>
                {d.group.topics.map((x) => (
                  <View key={x.title} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T variant="strong">{x.title}</T>
                      <T variant="strong">{x.percent}%</T>
                    </View>
                    <Bar percent={x.percent} tone={x.percent < 60 ? 'mag' : 'mint'} />
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}
          {d.participation ? (
            <Section title={t('group.students')}>
              {d.participation.map((p, i) => (
                <Row key={`${p.name}-${i}`} index={i} icon={p.tookDiagnostic ? CircleCheck : CircleDashed} tone={p.tookDiagnostic ? 'mint' : 'neutral'} title={p.name} chevron={false} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
