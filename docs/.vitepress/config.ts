import { defineConfig } from 'vitepress'

// Shared site config. The German locale is the root (no URL prefix); English
// lives under /en/. Internal planning docs under docs/superpowers/ and the
// launch-readiness note stay in the repo but are excluded from the built site.
export default defineConfig({
  title: 'KunstmeileMap',
  description: 'Dokumentation für die Kunstmeile Web-App – Installation, Verwaltung und Nutzung.',
  lang: 'de-DE',

  // GitHub Pages project site is served from /KunstmeileMap/.
  base: '/KunstmeileMap/',

  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: false,

  srcExclude: ['superpowers/**', 'launch-readiness.md', '**/README.md'],

  head: [
    ['link', { rel: 'icon', href: '/KunstmeileMap/favicon.svg' }],
  ],

  themeConfig: {
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/jan1409/KunstmeileMap' },
    ],
  },

  locales: {
    root: {
      label: 'Deutsch',
      lang: 'de-DE',
      themeConfig: {
        nav: [
          { text: 'Installation', link: '/installation/vercel-supabase' },
          { text: 'Verwaltung', link: '/admin/events' },
          { text: 'Nutzung', link: '/user/map-basics' },
          { text: 'Referenz', link: '/reference/env-vars' },
        ],
        sidebar: {
          '/installation/': [
            {
              text: 'Installation & Deployment',
              items: [
                { text: 'Vercel + Supabase', link: '/installation/vercel-supabase' },
                { text: 'Alternative: Azure', link: '/installation/azure' },
                { text: 'Alternative: AWS', link: '/installation/aws' },
              ],
            },
          ],
          '/admin/': [
            {
              text: 'Verwaltung (Admin)',
              items: [
                { text: 'Veranstaltungen', link: '/admin/events' },
                { text: 'Stände (Tents)', link: '/admin/tents' },
                { text: 'Kategorien', link: '/admin/categories' },
                { text: 'Import & Export', link: '/admin/import-export' },
                { text: 'Fotos', link: '/admin/photos' },
                { text: 'Benutzer & Rollen', link: '/admin/users-roles' },
              ],
            },
          ],
          '/user/': [
            {
              text: 'Nutzung (Besucher)',
              items: [
                { text: 'Die Karte', link: '/user/map-basics' },
                { text: 'Einen Stand auswählen', link: '/user/select-tent' },
                { text: 'Auf dem Smartphone', link: '/user/mobile' },
                { text: 'Am Desktop', link: '/user/desktop' },
              ],
            },
          ],
          '/reference/': [
            {
              text: 'Referenz',
              items: [
                { text: 'Umgebungsvariablen', link: '/reference/env-vars' },
                { text: 'Datenmodell', link: '/reference/data-model' },
                { text: 'Fehlerbehebung', link: '/reference/troubleshooting' },
              ],
            },
          ],
        },
        docFooter: { prev: 'Zurück', next: 'Weiter' },
        outline: { label: 'Auf dieser Seite' },
        lastUpdatedText: 'Zuletzt aktualisiert',
        returnToTopLabel: 'Nach oben',
        darkModeSwitchLabel: 'Darstellung',
        sidebarMenuLabel: 'Menü',
      },
    },

    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Installation', link: '/en/installation/vercel-supabase' },
          { text: 'Admin', link: '/en/admin/events' },
          { text: 'Usage', link: '/en/user/map-basics' },
          { text: 'Reference', link: '/en/reference/env-vars' },
        ],
        sidebar: {
          '/en/installation/': [
            {
              text: 'Installation & Deployment',
              items: [
                { text: 'Vercel + Supabase', link: '/en/installation/vercel-supabase' },
                { text: 'Alternative: Azure', link: '/en/installation/azure' },
                { text: 'Alternative: AWS', link: '/en/installation/aws' },
              ],
            },
          ],
          '/en/admin/': [
            {
              text: 'Administration',
              items: [
                { text: 'Events', link: '/en/admin/events' },
                { text: 'Tents', link: '/en/admin/tents' },
                { text: 'Categories', link: '/en/admin/categories' },
                { text: 'Import & Export', link: '/en/admin/import-export' },
                { text: 'Photos', link: '/en/admin/photos' },
                { text: 'Users & Roles', link: '/en/admin/users-roles' },
              ],
            },
          ],
          '/en/user/': [
            {
              text: 'Usage (Visitors)',
              items: [
                { text: 'The Map', link: '/en/user/map-basics' },
                { text: 'Selecting a Tent', link: '/en/user/select-tent' },
                { text: 'On Mobile', link: '/en/user/mobile' },
                { text: 'On Desktop', link: '/en/user/desktop' },
              ],
            },
          ],
          '/en/reference/': [
            {
              text: 'Reference',
              items: [
                { text: 'Environment Variables', link: '/en/reference/env-vars' },
                { text: 'Data Model', link: '/en/reference/data-model' },
                { text: 'Troubleshooting', link: '/en/reference/troubleshooting' },
              ],
            },
          ],
        },
      },
    },
  },
})
