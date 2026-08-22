// Standard Russian mod-10/mod-100 plural-agreement rule (see
// q-wash-admin/src/shared/pluralRu.ts — same helper, not shared via
// q-wash-shared since it's UI text logic, not an API/theme concern).
export function pluralRu(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
