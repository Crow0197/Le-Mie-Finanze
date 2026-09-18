import { resolveNavigation } from './navigation';

const definitions = [
  { id: 'home' },
  { id: 'movimenti' },
  { id: 'amministrazione', locked: true },
];

describe('resolveNavigation', () => {
  it('shows every section when there are no preferences', () => {
    expect(resolveNavigation(definitions, undefined)).toEqual([
      { item: definitions[0], visible: true },
      { item: definitions[1], visible: true },
      { item: definitions[2], visible: true },
    ]);
  });

  it('follows the saved order and hides what the user hid', () => {
    const entries = resolveNavigation(definitions, [
      { id: 'movimenti', visible: true },
      { id: 'home', visible: false },
      { id: 'amministrazione', visible: true },
    ]);
    expect(entries.map((entry) => entry.item.id)).toEqual(['movimenti', 'home', 'amministrazione']);
    expect(entries[1].visible).toBe(false);
  });

  it('keeps locked sections visible', () => {
    const entries = resolveNavigation(definitions, [{ id: 'amministrazione', visible: false }]);
    expect(entries[0]).toEqual({ item: definitions[2], visible: true });
  });

  it('appends sections added later and ignores unknown ones', () => {
    const entries = resolveNavigation(definitions, [
      { id: 'sparita', visible: true },
      { id: 'amministrazione', visible: true },
    ]);
    expect(entries.map((entry) => entry.item.id)).toEqual(['amministrazione', 'home', 'movimenti']);
  });
});
