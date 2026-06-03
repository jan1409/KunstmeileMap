---
layout: home

hero:
  name: KunstmeileMap
  text: Documentation
  tagline: Interactive map and exhibitor directory for the Kunstmeile – installation, administration and usage.
  actions:
    - theme: brand
      text: Installation & Deployment
      link: /en/installation/vercel-supabase
    - theme: alt
      text: Administration
      link: /en/admin/events
    - theme: alt
      text: Usage (Visitors)
      link: /en/user/map-basics

features:
  - icon: 🚀
    title: Installation & Deployment
    details: Set up step by step on Vercel + Supabase – plus alternatives for Azure Static Web Apps and AWS S3 + CloudFront.
    link: /en/installation/vercel-supabase
    linkText: Get started
  - icon: 🛠️
    title: Administration
    details: Manage events, tents, categories, photos, import/export and user roles in the CMS.
    link: /en/admin/events
    linkText: Admin guides
  - icon: 🗺️
    title: Usage (Visitors)
    details: How visitors use the map, find and select tents – on mobile and desktop.
    link: /en/user/map-basics
    linkText: Usage
  - icon: 📖
    title: Reference
    details: Environment variables, data model and troubleshooting.
    link: /en/reference/env-vars
    linkText: Look it up
---

## About this documentation

**KunstmeileMap** is a web app that shows visitors an interactive map of the
exhibition booths (“tents”) of a Kunstmeile event. Organizers maintain the
content through a built-in CMS (admin area).

The documentation has three parts:

- **Installation & Deployment** – for whoever runs the app (technical).
- **Administration** – for organizers maintaining content.
- **Usage (Visitors)** – for operating the public map.

It is bilingual (German / English – switch at the top right) and available both
as an HTML site and as Markdown directly in the
[GitHub repository](https://github.com/jan1409/KunstmeileMap/tree/main/docs).
