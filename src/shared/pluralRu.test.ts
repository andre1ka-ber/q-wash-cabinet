import { describe, expect, it } from 'vitest';
import { pluralRu } from './pluralRu';

const forms: [string, string, string] = ['услуга', 'услуги', 'услуг'];

describe('pluralRu', () => {
  it('picks "one" for numbers ending in 1, except 11', () => {
    expect(pluralRu(1, forms)).toBe('услуга');
    expect(pluralRu(21, forms)).toBe('услуга');
    expect(pluralRu(101, forms)).toBe('услуга');
  });

  it('picks "many" for the 11-14 teens exception', () => {
    expect(pluralRu(11, forms)).toBe('услуг');
    expect(pluralRu(12, forms)).toBe('услуг');
    expect(pluralRu(14, forms)).toBe('услуг');
    expect(pluralRu(111, forms)).toBe('услуг');
  });

  it('picks "few" for numbers ending in 2-4, except 12-14', () => {
    expect(pluralRu(2, forms)).toBe('услуги');
    expect(pluralRu(3, forms)).toBe('услуги');
    expect(pluralRu(4, forms)).toBe('услуги');
    expect(pluralRu(22, forms)).toBe('услуги');
  });

  it('picks "many" for 0, 5-9, and 10', () => {
    expect(pluralRu(0, forms)).toBe('услуг');
    expect(pluralRu(5, forms)).toBe('услуг');
    expect(pluralRu(9, forms)).toBe('услуг');
    expect(pluralRu(10, forms)).toBe('услуг');
  });
});
