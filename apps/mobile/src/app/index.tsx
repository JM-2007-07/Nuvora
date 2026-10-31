import { Redirect } from 'expo-router';
import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Sends each identity to its own area: learners to the learner tabs, staff to the staff tabs. */
export default function Index() {
  const { kind } = useAuth();
  if (kind === null) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (kind === 'none') return <Redirect href="/sign-in" />;
  return <Redirect href={kind === 'staff' ? '/(staff)' : '/(learner)'} />;
}
