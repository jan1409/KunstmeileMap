import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TentMarker } from '../../../src/components/TentMarker';

describe('TentMarker', () => {
  it('renders a div with the display_number visible', () => {
    const { getByText } = render(
      <TentMarker displayNumber={42} color="#f00" ariaLabel="Galerie Müller" />,
    );
    expect(getByText('42')).toBeInTheDocument();
  });

  it('applies the category color as background', () => {
    const { container } = render(
      <TentMarker displayNumber={7} color="#0f0" ariaLabel="Stand 7" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('uses aria-label for accessibility', () => {
    const { getByLabelText } = render(
      <TentMarker displayNumber={1} color="#000" ariaLabel="Galerie Müller" />,
    );
    expect(getByLabelText('Galerie Müller')).toBeInTheDocument();
  });

  it('renders a dot for tents without a display number', () => {
    const { container } = render(
      <TentMarker displayNumber={null} color="#888" ariaLabel="Unbenannt" />,
    );
    expect(container.textContent).toBe('·');
  });

  it('variant="dot" renders a 24x24 hit-area with a 12x12 inner circle', () => {
    const { container } = render(
      <TentMarker
        displayNumber={42}
        color="#ef4444"
        ariaLabel="Stand 42"
        variant="dot"
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/\bh-6\b/);
    expect(outer.className).toMatch(/\bw-6\b/);
    const inner = outer.firstChild as HTMLElement;
    expect(inner.className).toMatch(/\bh-3\b/);
    expect(inner.className).toMatch(/\bw-3\b/);
    expect(inner.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('variant="dot" does NOT render the display number', () => {
    const { container } = render(
      <TentMarker
        displayNumber={42}
        color="#ef4444"
        ariaLabel="Stand 42"
        variant="dot"
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('defaults to variant="full" when omitted', () => {
    const { getByText } = render(
      <TentMarker displayNumber={7} color="#000" ariaLabel="Stand 7" />,
    );
    expect(getByText('7')).toBeInTheDocument();
  });

  it('full variant renders the icon SVG instead of the number when iconKey is set', () => {
    const { container, queryByText } = render(
      <TentMarker
        displayNumber={42}
        color="#000"
        ariaLabel="Pommesbude"
        iconKey="parking"
      />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(queryByText('42')).not.toBeInTheDocument();
  });

  it('falls back to the number for an unknown iconKey', () => {
    const { container, getByText } = render(
      <TentMarker
        displayNumber={42}
        color="#000"
        ariaLabel="Stand 42"
        iconKey="not-a-real-icon"
      />,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(getByText('42')).toBeInTheDocument();
  });

  it('dot variant stays a plain dot and ignores iconKey', () => {
    const { container } = render(
      <TentMarker
        displayNumber={42}
        color="#000"
        ariaLabel="Stand 42"
        variant="dot"
        iconKey="parking"
      />,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });
});
