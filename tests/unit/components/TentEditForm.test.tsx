import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '../../../src/lib/i18n';

import { TentEditForm, type TentFormValues } from '../../../src/components/TentEditForm';

// Mock react-leaflet so the embedded TentMapEditor renders inert primitives.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="marker" />,
  useMapEvents: () => null,
  ZoomControl: () => null,
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
}));

const sampleCategories = [
  {
    id: 'ad9e5a71-6988-43a6-a20f-10a2463cb37b',
    event_id: 'evt-1',
    slug: 'galerie',
    name_de: 'Galerie',
    name_en: 'Gallery',
    icon: '🎨',
    display_order: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a347c869-8131-4eff-9afb-783df678bd08',
    event_id: 'evt-1',
    slug: 'atelier',
    name_de: 'Atelier',
    name_en: 'Studio',
    icon: '🖌️',
    display_order: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const defaultCenter: [number, number] = [49.0, 8.4];
const defaultZoom = 17;

describe('TentEditForm', () => {
  const onSubmit = vi.fn<(v: TentFormValues) => Promise<void>>();

  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
  });

  it('renders all expected fields including display_number and a category multi-select', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Beschreibung \(DE\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description \(EN\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^#$|^Nummer$|display number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website|Webseite/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/public email|Öffentliche E-Mail/i)).toBeInTheDocument();
    // Categories now appear as checkboxes.
    expect(screen.getByRole('checkbox', { name: /Galerie/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Atelier/i })).toBeInTheDocument();
    // Map editor: lat/lng inputs.
    expect(screen.getByLabelText(/^lat$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^lng$/i)).toBeInTheDocument();
  });

  it('keeps the Save button enabled regardless of coordinates (T4: save no longer gated on position)', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /save|Speichern/i })).not.toBeDisabled();
  });

  it('validates required slug + name and rejects bad slugs', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    // Empty submit: required errors surface, onSubmit is NOT called.
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Bad slug (uppercase): rejected by regex.
    await user.type(screen.getByLabelText(/slug/i), 'BadSlug');
    await user.type(screen.getByLabelText(/^name$/i), 'A name');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects malformed URLs and emails but accepts empty optional fields', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'galerie-nord');
    await user.type(screen.getByLabelText(/^name$/i), 'Galerie Nord');
    await user.type(screen.getByLabelText(/website|Webseite/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/website|Webseite/i));
    await user.type(screen.getByLabelText(/public email|Öffentliche E-Mail/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the parsed values when fields are valid', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'galerie-nord');
    await user.type(screen.getByLabelText(/^name$/i), 'Galerie Nord');
    await user.type(screen.getByLabelText(/Beschreibung \(DE\)/i), 'Eine Galerie');
    await user.type(screen.getByLabelText(/website|Webseite/i), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0];
    expect(submitted.slug).toBe('galerie-nord');
    expect(submitted.name).toBe('Galerie Nord');
    expect(submitted.description_de).toBe('Eine Galerie');
    expect(submitted.website_url).toBe('https://example.com');
    // Lat/lng default to null when the admin doesn't place a marker.
    expect(submitted.lat).toBeNull();
    expect(submitted.lng).toBeNull();
  });

  it('populates fields from the initial value when editing an existing tent', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        initial={{
          slug: 'existing-tent',
          name: 'Existing Tent',
          description_de: 'Bestehend',
          website_url: 'https://existing.example',
          category_ids: [sampleCategories[1]!.id],
          lat: 49.5,
          lng: 8.5,
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/slug/i)).toHaveValue('existing-tent');
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Existing Tent');
    expect(screen.getByLabelText(/Beschreibung \(DE\)/i)).toHaveValue('Bestehend');
    expect(screen.getByLabelText(/website|Webseite/i)).toHaveValue('https://existing.example');
    expect(screen.getByRole('checkbox', { name: /Atelier/i })).toBeChecked();
    expect(screen.getByLabelText(/^lat$/i)).toHaveValue(49.5);
    expect(screen.getByLabelText(/^lng$/i)).toHaveValue(8.5);
  });

  it('emits selected category_ids and a numeric display_number on submit', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'foo');
    await user.type(screen.getByLabelText(/^name$/i), 'Foo');
    await user.type(screen.getByLabelText(/^#$|^Nummer$|display number/i), '7');
    await user.click(screen.getByRole('checkbox', { name: /Galerie/i }));
    await user.click(screen.getByRole('checkbox', { name: /Atelier/i }));

    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      slug: 'foo',
      name: 'Foo',
      display_number: 7,
      category_ids: expect.arrayContaining([
        sampleCategories[0]!.id,
        sampleCategories[1]!.id,
      ]),
    });
  });

  it('omits display_number from the payload when blank (trigger fills it)', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/slug/i), 'bar');
    await user.type(screen.getByLabelText(/^name$/i), 'Bar');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].display_number).toBeUndefined();
  });

  it('rejects a tent that has lat but no lng (and vice versa) via zod refinement', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'orphan');
    await user.type(screen.getByLabelText(/^name$/i), 'Orphan');
    // Only fill lat — leaves lng null, refinement should reject.
    await user.type(screen.getByLabelText(/^lat$/i), '49.5');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes a trimmed contact_person value through to onSubmit', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'with-contact');
    await user.type(screen.getByLabelText(/^name$/i), 'Studio Collective');
    await user.type(
      screen.getByLabelText(/Ansprechperson|Contact person/i),
      'Anna Müller',
    );
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].contact_person).toBe('Anna Müller');
  });

  it('submits an empty contact_person as the empty string (page-layer normalises to null)', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'no-contact');
    await user.type(screen.getByLabelText(/^name$/i), 'No Contact');
    // contact_person left blank
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    // RHF passes through the empty string from the input. The TentEditPage
    // submit handler is what coerces "" → null for the DB write.
    const val = onSubmit.mock.calls[0]![0].contact_person;
    expect(val === '' || val == null).toBe(true);
  });

  it('submits lat/lng pair when both are set via the inputs', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        tileStyle="osm"
        onTileStyleChange={() => {}}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'paired');
    await user.type(screen.getByLabelText(/^name$/i), 'Paired');
    await user.type(screen.getByLabelText(/^lat$/i), '49.5');
    await user.type(screen.getByLabelText(/^lng$/i), '8.5');
    await user.click(screen.getByRole('button', { name: /save|Speichern/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ lat: 49.5, lng: 8.5 });
  });
});
