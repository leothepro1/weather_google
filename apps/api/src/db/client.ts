// Thin D1 helpers. Kept tiny by design — query builders go in route/service
// modules so they stay co-located with the code that owns them.

export function now(): number {
  return Date.now();
}

export async function d1First<T>(
  stmt: D1PreparedStatement,
): Promise<T | null> {
  return (await stmt.first<T>()) ?? null;
}

export async function d1All<T>(stmt: D1PreparedStatement): Promise<T[]> {
  const result = await stmt.all<T>();
  return result.results ?? [];
}
