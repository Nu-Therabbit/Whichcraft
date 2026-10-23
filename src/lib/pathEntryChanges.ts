const entries = (raw: string | null) =>
  (raw ?? "")
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

const key = (entry: string) => entry.replace(/[\\/]+$/, "").toLowerCase();

/** Entries in `from` beyond as many copies as `other` has, so a dropped duplicate counts too. */
function beyond(from: string[], other: string[]): string[] {
  const left = new Map<string, number>();
  for (const e of other) left.set(key(e), (left.get(key(e)) ?? 0) + 1);
  return from.filter((e) => {
    const n = left.get(key(e)) ?? 0;
    if (n > 0) {
      left.set(key(e), n - 1);
      return false;
    }
    return true;
  });
}

/** Entries a PATH change adds and removes, compared the way Windows does (case, trailing slash). */
export function pathEntryChanges(before: string | null, after: string): { added: string[]; removed: string[] } {
  const was = entries(before);
  const now = entries(after);
  return { added: beyond(now, was), removed: beyond(was, now) };
}
