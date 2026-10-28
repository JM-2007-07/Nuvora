/**
 * Knowledge Map layout (D-09): column = prerequisite depth (longest path from a
 * topic with no prerequisites), row = order within the column. Pure, no library.
 */
export interface LayoutTopic {
  slug: string;
  order: number;
  prerequisites: string[];
}

export type PlacedTopic<T extends LayoutTopic = LayoutTopic> = T & { column: number; row: number };

export function layoutTopics<T extends LayoutTopic>(topics: T[]): { placed: PlacedTopic<T>[]; columns: number; rows: number } {
  const bySlug = new Map(topics.map((t) => [t.slug, t]));
  const depth = new Map<string, number>();
  const visit = (slug: string, stack: Set<string>): number => {
    if (depth.has(slug)) return depth.get(slug)!;
    if (stack.has(slug)) return 0; // defensive: cycles are rejected by seed:check
    stack.add(slug);
    const prerequisites = (bySlug.get(slug)?.prerequisites ?? []).filter((p) => bySlug.has(p));
    const d = prerequisites.length ? Math.max(...prerequisites.map((p) => visit(p, stack) + 1)) : 0;
    stack.delete(slug);
    depth.set(slug, d);
    return d;
  };
  topics.forEach((t) => visit(t.slug, new Set()));

  const columns = new Map<number, T[]>();
  for (const t of [...topics].sort((a, b) => a.order - b.order)) {
    const d = depth.get(t.slug)!;
    columns.set(d, [...(columns.get(d) ?? []), t]);
  }
  const placed = [...columns.entries()].flatMap(([column, list]) => list.map((t, row) => ({ ...t, column, row })));
  return { placed, columns: columns.size, rows: Math.max(1, ...[...columns.values()].map((c) => c.length)) };
}
