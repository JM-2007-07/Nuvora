import { Ellipsis, LayoutDashboard, Radio } from 'lucide-react-native';
import { AreaTabs } from '@/components/area-tabs';
import { useStaffSession } from '@/lib/staff-queries';

export default function StaffLayout() {
  // Live exams belong to teachers; a center never sees individual answers, so it gets no exams tab.
  const role = useStaffSession().data?.staff?.role;
  return (
    <AreaTabs
      area="staff"
      tabs={[
        { name: 'index', title: 'tabs.overview', icon: LayoutDashboard },
        { name: 'exams', title: 'tabs.exams', icon: Radio, hidden: !!role && role !== 'TEACHER' },
        { name: 'settings', title: 'tabs.settings', icon: Ellipsis },
      ]}
    />
  );
}
