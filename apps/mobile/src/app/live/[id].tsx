import { type LiveParticipant, type TeacherExamActionRequest } from '@nuvora/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Flag, LogIn, Megaphone, Pause, Play, ShieldCheck, Square, Timer, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { z } from 'zod';
import { Bar, Button, Card, ErrorBox, Hud, IconBadge, Loading, Pill, Screen, Section, T, tap, toneColors, type Tone } from '@/components/ui';
import { api } from '@/lib/api';
import { EVENT_META, SIGNAL_CHIPS } from '@/lib/event-meta';
import { usePrefs } from '@/lib/prefs';
import { shortDate } from '@/lib/queries';
import { useLiveExam } from '@/lib/staff-queries';

const STATUS: Record<LiveParticipant['status'], { key: 'live.notStarted' | 'live.writing' | 'live.paused' | 'live.done' | 'live.expired' | 'live.ended'; tone: Tone }> = {
  NOT_STARTED: { key: 'live.notStarted', tone: 'neutral' },
  IN_PROGRESS: { key: 'live.writing', tone: 'blue' },
  PAUSED: { key: 'live.paused', tone: 'gold' },
  SUBMITTED: { key: 'live.done', tone: 'mint' },
  EXPIRED: { key: 'live.expired', tone: 'gold' },
  ENDED: { key: 'live.ended', tone: 'mag' },
};

/** The teacher's live exam board: who is in, how far, which signals came in, and actions. */
export default function Live() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale, colors } = usePrefs();
  const live = useLiveExam(id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const act = useMutation({
    mutationFn: ({ attemptId, body }: { attemptId: string; body: TeacherExamActionRequest }) => api(`/teach/assessment-attempts/${attemptId}/actions`, z.object({ status: z.string(), deadlineAt: z.string().nullable() }), { method: 'POST', body, locale }),
    onSuccess: () => {
      tap('success');
      void queryClient.invalidateQueries({ queryKey: ['live', id] });
    },
  });
  const d = live.data;
  const offset = d ? new Date(d.serverNow).getTime() - Date.now() : 0;

  return (
    <Screen back title={d?.assessment.title ?? ''} subtitle={d ? `${d.assessment.groupCode} · ${d.assessment.questionCount}` : undefined} refreshing={live.isRefetching} onRefresh={() => void live.refetch()}>
      {live.isPending ? <Loading /> : null}
      {live.isError ? <ErrorBox onRetry={() => void live.refetch()} /> : null}
      {d ? (
        <>
          <Hud>
            <View style={styles.tiles}>
              {[
                { label: t('live.started'), value: `${d.summary.started}/${d.participants.length}` },
                { label: t('live.submitted'), value: String(d.summary.submitted) },
                { label: t('live.average'), value: d.summary.averagePercent === null ? '—' : `${d.summary.averagePercent}%` },
                { label: t('live.flagged'), value: String(d.summary.flagged) },
              ].map((x) => (
                <View key={x.label} style={styles.tile}>
                  <T variant="number" ink="onHud">
                    {x.value}
                  </T>
                  <T variant="caption" ink="onHudMuted">
                    {x.label}
                  </T>
                </View>
              ))}
            </View>
          </Hud>

          <Section title={t('group.students')}>
            {d.participants.map((p, i) => {
              const status = STATUS[p.status];
              const left = p.deadlineAt && (p.status === 'IN_PROGRESS' || p.status === 'PAUSED') ? Math.max(0, new Date(p.deadlineAt).getTime() - (now + offset)) : null;
              const running = p.status === 'IN_PROGRESS' || p.status === 'PAUSED';
              const expanded = open === p.key && !!p.attemptId;
              return (
                <Card key={p.key} index={i} onPress={p.attemptId ? () => setOpen(expanded ? null : p.key) : undefined} accessibilityLabel={`${p.name}, ${t(status.key)}`} style={p.flagged ? { borderColor: colors.mag, backgroundColor: colors.magTint } : undefined}>
                  <View style={styles.rowCenter}>
                    <ConnectedDot on={p.connected} />
                    <T variant="strong" style={{ flex: 1 }} numberOfLines={1}>
                      {p.name}
                    </T>
                    {p.flagged ? <Flag color={colors.magInk} size={16} /> : null}
                    <Pill text={t(status.key)} tone={status.tone} />
                  </View>
                  {p.status !== 'NOT_STARTED' ? (
                    <>
                      <View style={styles.rowCenter}>
                        <View style={{ flex: 1 }}>
                          <Bar percent={p.total ? (p.answered / p.total) * 100 : 0} tone="blue" height={6} />
                        </View>
                        <T variant="caption" ink="muted">
                          {p.answered}/{p.total}
                        </T>
                        {left !== null ? (
                          <T variant="caption" ink={left < 60_000 ? 'mag' : 'muted'}>
                            {t('live.left', { time: `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` })}
                          </T>
                        ) : null}
                        {p.score ? (
                          <T variant="strong" ink={p.score.percent >= 60 ? 'mint' : 'mag'}>
                            {p.score.percent}%
                          </T>
                        ) : null}
                      </View>
                      <Signals p={p} />
                    </>
                  ) : null}
                  {expanded ? (
                    <Animated.View entering={FadeIn} style={styles.actions}>
                      {running ? <Button compact kind="soft" icon={Megaphone} label={t('live.warn')} onPress={() => act.mutate({ attemptId: p.attemptId!, body: { action: 'WARN', message: t('live.warnText') } })} /> : null}
                      {p.status === 'IN_PROGRESS' ? <Button compact kind="soft" icon={Pause} label={t('live.pause')} onPress={() => act.mutate({ attemptId: p.attemptId!, body: { action: 'PAUSE' } })} /> : null}
                      {p.status === 'PAUSED' ? <Button compact kind="soft" icon={Play} label={t('live.resume')} onPress={() => act.mutate({ attemptId: p.attemptId!, body: { action: 'RESUME' } })} /> : null}
                      {running && p.deadlineAt ? <Button compact kind="soft" icon={Timer} label={t('live.extend')} onPress={() => act.mutate({ attemptId: p.attemptId!, body: { action: 'EXTEND', minutes: 5 } })} /> : null}
                      <Button compact kind="soft" icon={Flag} label={p.flagged ? t('live.unflag') : t('live.flag')} onPress={() => act.mutate({ attemptId: p.attemptId!, body: { action: p.flagged ? 'UNFLAG' : 'FLAG' } })} />
                      {running ? (
                        confirmEnd === p.key ? (
                          <View style={{ width: '100%', gap: 8 }}>
                            <T variant="caption">{t('live.endConfirm', { name: p.name })}</T>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Button compact kind="ghost" label={t('common.cancel')} onPress={() => setConfirmEnd(null)} style={{ flex: 1 }} />
                              <Button compact kind="danger" icon={Square} label={t('live.end')} onPress={() => { setConfirmEnd(null); act.mutate({ attemptId: p.attemptId!, body: { action: 'END' } }); }} style={{ flex: 1 }} />
                            </View>
                          </View>
                        ) : (
                          <Button compact kind="ghost" icon={Square} label={t('live.end')} onPress={() => setConfirmEnd(p.key)} />
                        )
                      ) : null}
                    </Animated.View>
                  ) : null}
                </Card>
              );
            })}
          </Section>

          <Section title={t('live.events')}>
            <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
              {d.events.slice(0, 30).map((e) => {
                const meta = EVENT_META[e.kind];
                return (
                  <EventLine key={e.id} name={e.name} label={t(`event.${e.kind}`)} at={shortDate(e.at, true)} icon={meta.icon} tone={meta.tone} violation={!!meta.violation} />
                );
              })}
            </Card>
            <T variant="caption" ink="faint">
              {t('live.signalsNote')}
            </T>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function ConnectedDot({ on }: { on: boolean }) {
  const { colors } = usePrefs();
  return <View accessibilityLabel={on ? 'online' : 'offline'} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? colors.mint : colors.line2 }} />;
}

function Signals({ p }: { p: LiveParticipant }) {
  const { t, colors, fonts } = usePrefs();
  const chips = SIGNAL_CHIPS.filter((k) => (p.signals[k] ?? 0) > 0);
  if (!chips.length && !p.warnings && !p.reentries)
    return (
      <View style={styles.rowCenter}>
        <ShieldCheck color={colors.mintInk} size={15} />
        <T variant="caption" ink="mint">
          {t('live.noSignals')}
        </T>
      </View>
    );
  const chip = (key: string, Icon: typeof Flag, tone: Tone, count: number, label: string) => {
    const c = toneColors(colors, tone);
    return (
      <View key={key} accessible accessibilityLabel={`${label}: ${count}`} style={[styles.chip, { backgroundColor: c.bg }]}>
        <Icon color={c.fg} size={14} strokeWidth={2.4} />
        <T style={{ color: c.fg, fontFamily: fonts.bold, fontSize: 13 }}>{count}</T>
      </View>
    );
  };
  return (
    <View style={styles.chips}>
      {chips.map((k) => chip(k, EVENT_META[k].icon, EVENT_META[k].tone, p.signals[k]!, t(`event.${k}`)))}
      {p.warnings ? chip('warn', TriangleAlert, 'gold', p.warnings, t('event.WARNING')) : null}
      {p.reentries ? chip('re', LogIn, 'blue', p.reentries, t('event.RESUMED')) : null}
    </View>
  );
}

function EventLine({ name, label, at, icon, tone, violation }: { name: string; label: string; at: string; icon: typeof Flag; tone: Tone; violation: boolean }) {
  const { colors } = usePrefs();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeIn} style={[styles.event, { borderColor: colors.line, borderLeftColor: violation ? colors.mag : 'transparent', backgroundColor: violation ? colors.magTint : 'transparent' }]}>
      <IconBadge icon={icon} tone={tone} size={32} />
      <View style={{ flex: 1 }}>
        <T variant="caption">
          <T variant="caption" style={{ fontWeight: '700' }}>
            {name}
          </T>{' '}
          <T variant="caption" ink={violation ? 'mag' : 'muted'}>
            {label}
          </T>
        </T>
        <T variant="caption" ink="faint">
          {at}
        </T>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '46%', flexGrow: 1, gap: 2 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
});
