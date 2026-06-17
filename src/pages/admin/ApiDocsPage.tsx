import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Swagger UI is loaded from a CDN on demand rather than bundled, so it never
// ships in the public app bundle — only this lazy admin route pulls it in. It
// renders the canonical spec served at /openapi.json.
const SWAGGER_VERSION = '5.17.14';
const SWAGGER_CSS = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;
const SWAGGER_JS = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;

declare global {
  interface Window {
    SwaggerUIBundle?: (opts: Record<string, unknown>) => void;
  }
}

export default function ApiDocsPage() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !containerRef.current || !window.SwaggerUIBundle) return;
      window.SwaggerUIBundle({
        url: '/openapi.json',
        domNode: containerRef.current,
        deepLinking: true,
      });
    }

    if (!document.querySelector('link[data-swagger]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = SWAGGER_CSS;
      link.dataset.swagger = 'true';
      document.head.appendChild(link);
    }

    if (window.SwaggerUIBundle) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-swagger]');
      if (existing) {
        existing.addEventListener('load', render);
      } else {
        const script = document.createElement('script');
        script.src = SWAGGER_JS;
        script.dataset.swagger = 'true';
        script.addEventListener('load', render);
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{t('admin.api.heading')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-white/60">{t('admin.api.intro')}</p>
      <div ref={containerRef} data-testid="swagger-ui" className="rounded bg-white" />
    </div>
  );
}
