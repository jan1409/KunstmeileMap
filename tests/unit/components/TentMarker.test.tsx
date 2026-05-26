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
});
