import { AreaTabs } from '@/components/tabs';

export default function StaffLayout() {
  return (
    <AreaTabs
      area="staff"
      tabs={[
        { name: 'index', title: 'tabs.overview', glyph: '◎' },
        { name: 'settings', title: 'tabs.settings', glyph: '⚙' },
      ]}
    />
  );
}
