import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TentEditForm, type TentFormValues } from '../../../src/components/TentEditForm';

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

const samplePosition = { x: 1.5, y: 0, z: -2.3 };

describe('TentEditForm', () => {
  const onSubmit = vi.fn<(v: TentFormValues) => Promise<void>>();
  const onRequestPlace = vi.fn<() => void>();

  beforeEach(() => {
    onSubmit.mockReset();
    onSubmit.mockResolvedValue(undefined);
    onRequestPlace.mockReset();
  });

  it('renders all expected fields including display_number and a category multi-select', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        position={null}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Beschreibung \(DE\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description \(EN\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^#$|^Nummer$|display number/i)).toBeInTheDocument();
    // Categories now appear as checkboxes.
    expect(screen.getByRole('checkbox', { name: /Galerie/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Atelier/i })).toBeInTheDocument();
  });

  it('shows the placeholder when no position is set and a coordinate readout otherwise', () => {
    const { rerender } = render(
      <TentEditForm
        categories={sampleCategories}
        position={null}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/not placed/i)).toBeInTheDocument();

    rerender(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('(1.50, 0.00, -2.30)')).toBeInTheDocument();
  });

  it('disables the Save button when no position is set', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        position={null}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('triggers onRequestPlace when the place button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        position={null}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: /place on scene/i }));
    expect(onRequestPlace).toHaveBeenCalledTimes(1);
  });

  it('relabels the place button to "Reposition" once a position is set', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: /reposition/i })).toBeInTheDocument();
  });

  it('validates required slug + name and rejects bad slugs', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    // Empty submit: required errors surface, onSubmit is NOT called.
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    // Bad slug (uppercase): rejected by regex.
    await user.type(screen.getByLabelText(/slug/i), 'BadSlug');
    await user.type(screen.getByLabelText(/^name$/i), 'A name');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects malformed URLs and emails but accepts empty optional fields', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'galerie-nord');
    await user.type(screen.getByLabelText(/^name$/i), 'Galerie Nord');
    await user.type(screen.getByLabelText(/website/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/website/i));
    await user.type(screen.getByLabelText(/public email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the parsed values when fields are valid and a position is set', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'galerie-nord');
    await user.type(screen.getByLabelText(/^name$/i), 'Galerie Nord');
    await user.type(screen.getByLabelText(/Beschreibung \(DE\)/i), 'Eine Galerie');
    await user.type(screen.getByLabelText(/website/i), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0];
    expect(submitted.slug).toBe('galerie-nord');
    expect(submitted.name).toBe('Galerie Nord');
    expect(submitted.description_de).toBe('Eine Galerie');
    expect(submitted.website_url).toBe('https://example.com');
  });

  it('populates fields from the initial value when editing an existing tent', () => {
    render(
      <TentEditForm
        categories={sampleCategories}
        position={samplePosition}
        initial={{
          slug: 'existing-tent',
          name: 'Existing Tent',
          description_de: 'Bestehend',
          website_url: 'https://existing.example',
          category_ids: [sampleCategories[1]!.id],
        }}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/slug/i)).toHaveValue('existing-tent');
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Existing Tent');
    expect(screen.getByLabelText(/Beschreibung \(DE\)/i)).toHaveValue('Bestehend');
    expect(screen.getByLabelText(/website/i)).toHaveValue('https://existing.example');
    expect(screen.getByRole('checkbox', { name: /Atelier/i })).toBeChecked();
  });

  it('emits selected category_ids and a numeric display_number on submit', async () => {
    const user = userEvent.setup();
    render(
      <TentEditForm
        categories={sampleCategories}
        position={{ x: 0, y: 0, z: 0 }}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/slug/i), 'foo');
    await user.type(screen.getByLabelText(/^name$/i), 'Foo');
    await user.type(screen.getByLabelText(/^#$|^Nummer$|display number/i), '7');
    await user.click(screen.getByRole('checkbox', { name: /Galerie/i }));
    await user.click(screen.getByRole('checkbox', { name: /Atelier/i }));

    await user.click(screen.getByRole('button', { name: /save/i }));

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
        position={{ x: 0, y: 0, z: 0 }}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );
    await user.type(screen.getByLabelText(/slug/i), 'bar');
    await user.type(screen.getByLabelText(/^name$/i), 'Bar');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].display_number).toBeUndefined();
  });
});
