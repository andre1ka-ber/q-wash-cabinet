// Money is integer minor units (see q-wash-api's DATA_MODEL.md) — matches
// the mobile app's formatSomoni (q-wash/lib/shared/format.dart) so pricing
// reads the same everywhere in the platform: "128 смн." (no decimals when
// the amount is a whole unit), not rubles.
export function formatSomoni(cents: number): string {
  const whole = cents / 100;
  const text = cents % 100 === 0 ? whole.toFixed(0) : whole.toFixed(2);
  return `${text} смн.`;
}
