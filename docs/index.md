---
layout: home

hero:
  name: KunstmeileMap
  text: Dokumentation
  tagline: Interaktive Karte und Ausstellungs-Verzeichnis für die Kunstmeile – Installation, Verwaltung und Nutzung.
  actions:
    - theme: brand
      text: Installation & Deployment
      link: /installation/vercel-supabase
    - theme: alt
      text: Verwaltung (Admin)
      link: /admin/events
    - theme: alt
      text: Nutzung (Besucher)
      link: /user/map-basics

features:
  - icon: 🚀
    title: Installation & Deployment
    details: Schritt für Schritt auf Vercel + Supabase aufsetzen – plus Alternativen für Azure Static Web Apps und AWS S3 + CloudFront.
    link: /installation/vercel-supabase
    linkText: Loslegen
  - icon: 🛠️
    title: Verwaltung (Admin)
    details: Veranstaltungen, Stände, Kategorien, Fotos, Import/Export und Benutzerrollen im CMS pflegen.
    link: /admin/events
    linkText: Admin-Anleitungen
  - icon: 🗺️
    title: Nutzung (Besucher)
    details: Wie Besucher die Karte bedienen, Stände finden und auswählen – auf Smartphone und Desktop.
    link: /user/map-basics
    linkText: Bedienung
  - icon: 📖
    title: Referenz
    details: Umgebungsvariablen, Datenmodell und Fehlerbehebung zum Nachschlagen.
    link: /reference/env-vars
    linkText: Nachschlagen
---

## Über diese Dokumentation

Die **KunstmeileMap** ist eine Web-App, die Besuchern eine interaktive Karte der
Ausstellungsstände („Stände" / *Tents*) einer Kunstmeile-Veranstaltung zeigt.
Veranstalter pflegen die Inhalte über ein integriertes CMS (Admin-Bereich).

Diese Dokumentation ist in drei Bereiche gegliedert:

- **Installation & Deployment** – für alle, die die App betreiben (technisch).
- **Verwaltung (Admin)** – für Veranstalter, die Inhalte pflegen.
- **Nutzung (Besucher)** – für die Bedienung der öffentlichen Karte.

Die Dokumentation ist zweisprachig (Deutsch / English – Umschalter oben rechts)
und liegt sowohl als HTML-Website als auch als Markdown direkt im
[GitHub-Repository](https://github.com/jpoepke/KunstmeileMap/tree/main/docs) vor.
