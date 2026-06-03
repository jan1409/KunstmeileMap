# Benutzer & Rollen

Der Zugriff auf den Admin-Bereich wird pro Veranstaltung über **Rollen**
gesteuert. Diese Seite beschreibt die Rollen, das Einladen von Benutzern und die
Anmeldung.

## Anmeldung

Der Admin-Bereich wird über `/admin/login` per **Magic Link** (E-Mail) betreten:

![Admin-Anmeldung (Magic Link)](/assets/screenshots/admin/login.png)

1. E-Mail-Adresse eingeben.
2. Den per E-Mail erhaltenen Link anklicken.
3. Man landet im Admin-Dashboard.

![Admin-Dashboard](/assets/screenshots/admin/dashboard.png)

::: info Kein Zugriff?
Wer angemeldet ist, aber keiner Veranstaltung als Owner/Editor/Contributor
zugeordnet ist, sieht eine Hinweisseite („Kein Zugriff"). Ein Owner oder Admin
muss die Person dann einladen.
:::

## Rollenmodell

Es gibt zwei Ebenen: **globale** Rollen und **veranstaltungsbezogene** Rollen.

### Globale Rolle

| Rolle | Rechte |
|---|---|
| **admin** | Darf Veranstaltungen anlegen und verwalten |
| **editor** | Standard-Benutzer ohne globale Sonderrechte |

### Rolle je Veranstaltung

| Rolle | Rechte |
|---|---|
| **Owner** | Volle Kontrolle inkl. Einstellungen, Exporte und Benutzerverwaltung |
| **Editor** | Stände, Kategorien und Positionen bearbeiten |
| **Contributor** | Stände und Positionen ansehen/bearbeiten, Fotos hochladen (Kategorien nur lesen) |

## Benutzer verwalten

Auf der Benutzer-Seite (`/admin/events/:slug/users`, nur **Owner**) erscheinen
alle Mitglieder mit E-Mail, Name, Rolle und Einladungsstatus:

![Benutzer- und Rollenverwaltung](/assets/screenshots/admin/users-page.png)

Möglich sind:

- **Rolle ändern** – per Auswahl (Contributor ↔ Editor ↔ Owner)
- **Benutzer entfernen**
- **Einladung erneut senden** – für noch nicht bestätigte Benutzer

## Benutzer einladen

![Benutzer einladen](/assets/screenshots/admin/invite-user.png)

1. E-Mail-Adresse eingeben und **Rolle** wählen (Contributor / Editor / Owner).
2. Absenden – die Person erhält eine Einladung mit Magic Link und kann beim
   ersten Login ein Passwort setzen.

::: info Technischer Hintergrund
Das Einladen läuft über die Supabase Edge Function `invite-user`. Nur **Owner**
einer Veranstaltung (oder globale Admins) dürfen einladen. Die verschiedenen
Antwortzustände (eingeladen, bereits Mitglied, erneut gesendet …) sind in
`supabase/functions/invite-user/README.md` dokumentiert.
:::

## Weiter geht's

- [Veranstaltungen verwalten](/admin/events)
- [Stände verwalten](/admin/tents)
