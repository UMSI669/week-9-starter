/**
 * The category sort order shown on Home.
 *
 * Why this is tested: the order is what replaced the cloud map's visual
 * encoding. The map showed "which theme do I dream about most" as area; the
 * card row shows it as reading order, so the order has to be right and it has
 * to be stable. A row that reshuffles between renders would be worse than the
 * map it replaced.
 */

import { SORT_MODES, sortCategories } from '../CategoryCards';

const categories = [
  { key: 'mystery', label: 'Mystery', count: 2 },
  { key: 'adventure', label: 'Adventure', count: 5 },
  { key: 'nature', label: 'Nature & Animals', count: 2 },
  { key: 'school', label: 'School & Work', count: 0 },
  { key: 'flying', label: 'Flying & Falling', count: 9 },
];

const keys = (list) => list.map((item) => item.key);

describe('sortCategories', () => {
  it('puts the biggest category first by default', () => {
    expect(keys(sortCategories(categories))).toEqual([
      'flying',
      'adventure',
      'mystery',
      'nature',
      'school',
    ]);
  });

  it('reverses to smallest first', () => {
    expect(keys(sortCategories(categories, SORT_MODES.FEWEST))).toEqual([
      'school',
      'mystery',
      'nature',
      'adventure',
      'flying',
    ]);
  });

  it('breaks ties alphabetically, in both directions', () => {
    // Mystery (2) and Nature & Animals (2) are tied. "Mystery" sorts first by
    // label either way, so a tie never depends on input order.
    const most = keys(sortCategories(categories, SORT_MODES.MOST));
    const fewest = keys(sortCategories(categories, SORT_MODES.FEWEST));
    expect(most.indexOf('mystery')).toBeLessThan(most.indexOf('nature'));
    expect(fewest.indexOf('mystery')).toBeLessThan(fewest.indexOf('nature'));
  });

  it('is stable regardless of the order it is given', () => {
    const shuffled = [...categories].reverse();
    expect(keys(sortCategories(shuffled))).toEqual(keys(sortCategories(categories)));
  });

  it('sorts alphabetically when asked, ignoring counts', () => {
    expect(keys(sortCategories(categories, SORT_MODES.ALPHABETICAL))).toEqual([
      'adventure',
      'flying',
      'mystery',
      'nature',
      'school',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const input = [...categories];
    sortCategories(input, SORT_MODES.FEWEST);
    expect(keys(input)).toEqual(keys(categories));
  });

  it('handles one category and no categories', () => {
    expect(keys(sortCategories([categories[0]]))).toEqual(['mystery']);
    expect(sortCategories([])).toEqual([]);
  });
});
