import { describe, it, expect } from 'vitest';
import {
  snapshotPhotoPath,
  injectSnapshotData,
} from '../../../src/lib/exportSnapshot';
import type { ExportTent } from '../../../src/lib/exportEvent';
import type { SnapshotData } from '../../../src/lib/snapshot';
import type { Event } from '../../../src/lib/supabase';

function makeTent(overrides: Partial<ExportTent> = {}): ExportTent {
  return {
    id: 't1',
    slug: 'galerie-nord',
    name: 'Galerie Nord',
    display_number: 3,
    categories: [],
    ...overrides,
  } as unknown as ExportTent;
}

const event = { id: 'evt-1', slug: 'kunstmeile-2026' } as unknown as Event;

function makeData(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    event,
    tents: [],
    categories: [],
    photosByTentId: {},
    ...overrides,
  };
}

describe('snapshotPhotoPath', () => {
  it('nests photos under photos/<folder>/ with a zero-padded index', () => {
    const t = makeTent({ display_number: 3, slug: 'galerie-nord' });
    expect(snapshotPhotoPath(t, 0, 'jpg')).toBe('photos/3_galerie-nord/01.jpg');
    expect(snapshotPhotoPath(t, 11, 'png')).toBe('photos/3_galerie-nord/12.png');
  });

  it('uses the "x" folder prefix when the display number is null', () => {
    const t = makeTent({ display_number: null, slug: 'imbiss' });
    expect(snapshotPhotoPath(t, 0, 'jpg')).toBe('photos/x_imbiss/01.jpg');
  });
});

describe('injectSnapshotData', () => {
  const tag = '<script id="km-snapshot-data" type="application/json">__KM_SNAPSHOT_DATA__</script>';

  it('replaces the placeholder tag contents with the JSON payload', () => {
    const out = injectSnapshotData(`<head>${tag}</head>`, makeData());
    expect(out).toContain('"slug":"kunstmeile-2026"');
    expect(out).not.toContain('__KM_SNAPSHOT_DATA__');
  });

  it('escapes < so embedded markup cannot close the script tag', () => {
    const data = makeData({
      tents: [makeTent({ description_de: '</script><b>x</b>' })],
    });
    const out = injectSnapshotData(`<head>${tag}</head>`, data);
    expect(out).not.toContain('</script><b>');
    expect(out).toContain('\\u003c/script>');
    // The only literal </script> left is the placeholder tag's own closer.
    expect(out.match(/<\/script>/g)).toHaveLength(1);
  });

  it('does not corrupt JSON containing $ replacement patterns', () => {
    const data = makeData({
      tents: [makeTent({ name: 'A $1 $& $$ B' })],
    });
    const out = injectSnapshotData(`<head>${tag}</head>`, data);
    expect(out).toContain('A $1 $& $$ B');
  });

  it('throws when the placeholder tag is missing', () => {
    expect(() => injectSnapshotData('<head></head>', makeData())).toThrow(
      /km-snapshot-data/,
    );
  });
});
