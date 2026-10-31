import { BookOpen, ClipboardCheck, Ellipsis, House, Network } from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';

export default function LearnerLayout() {
  return (
    <AreaTabs
      area="learner"
      tabs={[
        { name: 'index', title: 'tabs.home', icon: House },
        { name: 'learn', title: 'tabs.learn', icon: Network },
        { name: 'tests', title: 'tabs.tests', icon: ClipboardCheck },
        { name: 'library', title: 'tabs.library', icon: BookOpen },
        { name: 'settings', title: 'tabs.settings', icon: Ellipsis },
      ]}
    />
  );
}
