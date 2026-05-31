import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '../../../src/lib/i18n';

import { MapStyleToggle } from '../../../src/components/MapStyleToggle';

describe('MapStyleToggle', () => {
  it('renders two buttons (OSM + satellite)', () => {
    render(<MapStyleToggle value="osm" onChange={() => {}} />);
    // Both i18n locales: DE Karte/Satellit, EN Map/Satellite.
    expect(
      screen.getByRole('button', { name: /Karte|^Map$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Satellit|Satellite/i }),
    ).toBeInTheDocument();
  });

  it("marks the active button with aria-pressed=true and the other with aria-pressed=false", () => {
    render(<MapStyleToggle value="osm" onChange={() => {}} />);
    const osmBtn = screen.getByRole('button', { name: /Karte|^Map$/i });
    const satBtn = screen.getByRole('button', { name: /Satellit|Satellite/i });
    expect(osmBtn).toHaveAttribute('aria-pressed', 'true');
    expect(satBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it("flips aria-pressed when value is 'satellite'", () => {
    render(<MapStyleToggle value="satellite" onChange={() => {}} />);
    expect(
      screen.getByRole('button', { name: /Karte|^Map$/i }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: /Satellit|Satellite/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it("calls onChange('satellite') when the inactive satellite button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MapStyleToggle value="osm" onChange={onChange} />);
    await user.click(
      screen.getByRole('button', { name: /Satellit|Satellite/i }),
    );
    expect(onChange).toHaveBeenCalledWith('satellite');
  });

  it("calls onChange('osm') when the inactive OSM button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MapStyleToggle value="satellite" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Karte|^Map$/i }));
    expect(onChange).toHaveBeenCalledWith('osm');
  });
});
