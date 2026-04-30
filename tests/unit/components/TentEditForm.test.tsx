import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TentEditForm, type TentFormValues } from '../../../src/components/TentEditForm';

const sampleCategories = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    event_id: 'evt-1',
    slug: 'galerie',
    name_de: 'Galerie',
    name_en: 'Gallery',
    icon: '🎨',
    display_order: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
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

  it('renders all expected fields and the category options', () => {
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
    expect(screen.getByLabelText(/adresse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instagram/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facebook/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/public email/i)).toBeInTheDocument();

    const select = screen.getByLabelText(/kategorie/i) as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.textContent);
    expect(optionTexts).toContain('🎨 Galerie');
    expect(optionTexts).toContain('🖌️ Atelier');
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
    await user.selectOptions(
      screen.getByLabelText(/kategorie/i),
      sampleCategories[0]!.id,
    );
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0]![0];
    expect(submitted.slug).toBe('galerie-nord');
    expect(submitted.name).toBe('Galerie Nord');
    expect(submitted.description_de).toBe('Eine Galerie');
    expect(submitted.website_url).toBe('https://example.com');
    expect(submitted.category_id).toBe(sampleCategories[0]!.id);
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
          category_id: sampleCategories[1]!.id,
        }}
        onRequestPlace={onRequestPlace}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText(/slug/i)).toHaveValue('existing-tent');
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Existing Tent');
    expect(screen.getByLabelText(/Beschreibung \(DE\)/i)).toHaveValue('Bestehend');
    expect(screen.getByLabelText(/website/i)).toHaveValue('https://existing.example');
    expect(screen.getByLabelText(/kategorie/i)).toHaveValue(sampleCategories[1]!.id);
  });
});
