import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../src/lib/i18n';
import ApiDocsPage from '../../../src/pages/admin/ApiDocsPage';

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ApiDocsPage />
    </I18nextProvider>,
  );
}

afterEach(() => {
  delete window.SwaggerUIBundle;
});

describe('ApiDocsPage', () => {
  it('renders the heading and a Swagger container', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /API[- ]?Dokumentation|API documentation/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('swagger-ui')).toBeInTheDocument();
  });

  it('initializes Swagger UI against /openapi.json when the bundle is present', () => {
    const bundle = vi.fn();
    window.SwaggerUIBundle = bundle;
    renderPage();
    expect(bundle).toHaveBeenCalledTimes(1);
    expect(bundle.mock.calls[0]![0]).toMatchObject({ url: '/openapi.json' });
  });
});
