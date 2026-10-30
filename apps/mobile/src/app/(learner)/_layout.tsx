import { AreaTabs } from '@/components/tabs';

export default function LearnerLayout() {
  return (
    <AreaTabs
      area="learner"
      tabs={[
        { name: 'index', title: 'tabs.home', glyph: '◎' },
        { name: 'tests', title: 'tabs.tests', glyph: '✎' },
        { name: 'settings', title: 'tabs.settings', glyph: '⚙' },
      ]}
    />
  );
}
