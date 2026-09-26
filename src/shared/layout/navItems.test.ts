import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, navItemForPath } from './navItems';

describe('navItemForPath', () => {
  it('maps every route to its own item', () => {
    for (const item of NAV_ITEMS) {
      expect(navItemForPath(item.to).key).toBe(item.key);
    }
  });

  it('matches nested paths and falls back to the queue for the root or unknown paths', () => {
    expect(navItemForPath('/services/abc').key).toBe('services');
    expect(navItemForPath('/').key).toBe('queue');
    expect(navItemForPath('/nope').key).toBe('queue');
  });

  it('has unique keys and routes', () => {
    expect(new Set(NAV_ITEMS.map((i) => i.key)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.to)).size).toBe(NAV_ITEMS.length);
  });
});
