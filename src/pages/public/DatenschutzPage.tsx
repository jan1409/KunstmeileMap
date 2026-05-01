import { useTranslation } from 'react-i18next';

export default function DatenschutzPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de';
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-neutral-950 p-6 text-white">
      {lang === 'en' ? <En /> : <De />}
    </main>
  );
}

function De() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Datenschutzerklärung</h1>
      <p className="text-sm leading-relaxed">
        Diese Seite verwendet ausschließlich technisch notwendige Cookies und
        lokale Speicherung für Spracheinstellungen und (im Admin-Bereich)
        Login-Sitzungen.
      </p>

      <h2 className="mt-6 text-lg font-semibold">1. Verantwortlicher</h2>
      <address className="not-italic">
        Jan Poepke
        <br />
        Klosterhoern 3
        <br />
        27419 Sittensen
        <br />
        Deutschland
        <br />
        E-Mail:{' '}
        <a className="underline" href="mailto:jan.poepke@outlook.de">
          jan.poepke@outlook.de
        </a>
      </address>

      <h2 className="mt-6 text-lg font-semibold">2. Eingesetzte Dienstleister</h2>
      <ul className="list-disc pl-6 text-sm leading-relaxed">
        <li>
          Vercel Inc. (Frontend-Hosting; USA, Standardvertragsklauseln nach
          Art. 46 DSGVO)
        </li>
        <li>
          Supabase, Inc. (Datenbank, Authentifizierung und Foto-Speicher;
          Region Frankfurt, EU)
        </li>
        <li>
          Cloudflare, Inc. (Hosting der 3D-Szenendateien über Cloudflare R2;
          EU-Edge)
        </li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">3. Erhobene Daten</h2>
      <p className="text-sm leading-relaxed">
        Beim Besuch der öffentlichen Seite werden keine personenbezogenen
        Daten erhoben. Im Admin-Bereich werden E-Mail-Adresse und Passwort
        verwendet, um Login-Sitzungen zu erstellen. Hochgeladene Standfotos
        werden im Auftrag des Verantwortlichen verarbeitet.
      </p>

      <h2 className="mt-6 text-lg font-semibold">4. Rechtsgrundlage</h2>
      <p className="text-sm leading-relaxed">
        Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO
        (Vertragserfüllung; Admin-Login zum Bearbeiten der Veranstaltungsdaten)
        und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren
        Betrieb der Seite).
      </p>

      <h2 className="mt-6 text-lg font-semibold">5. Speicherdauer</h2>
      <p className="text-sm leading-relaxed">
        Admin-Sitzungen werden nur so lange gespeichert, wie es die Anmeldung
        erfordert. Standfotos und Veranstaltungsdaten werden gespeichert,
        solange die jeweilige Veranstaltung in der Anwendung geführt wird.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Rechte der Betroffenen</h2>
      <p className="text-sm leading-relaxed">
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung,
        Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
        sowie das Recht, sich bei einer Aufsichtsbehörde zu beschweren. Bitte
        richten Sie entsprechende Anfragen an die oben genannte
        Kontaktadresse.
      </p>
    </>
  );
}

function En() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm leading-relaxed">
        This site uses only strictly necessary cookies and local storage for
        language preferences and (in the admin area) login sessions.
      </p>

      <h2 className="mt-6 text-lg font-semibold">1. Controller</h2>
      <address className="not-italic">
        Jan Poepke
        <br />
        Klosterhoern 3
        <br />
        27419 Sittensen
        <br />
        Germany
        <br />
        Email:{' '}
        <a className="underline" href="mailto:jan.poepke@outlook.de">
          jan.poepke@outlook.de
        </a>
      </address>

      <h2 className="mt-6 text-lg font-semibold">2. Processors</h2>
      <ul className="list-disc pl-6 text-sm leading-relaxed">
        <li>
          Vercel Inc. (frontend hosting; USA, EU Standard Contractual Clauses
          under Art. 46 GDPR)
        </li>
        <li>
          Supabase, Inc. (database, authentication, and photo storage;
          Frankfurt EU region)
        </li>
        <li>
          Cloudflare, Inc. (3D scene file hosting via Cloudflare R2; EU edge)
        </li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">3. Data collected</h2>
      <p className="text-sm leading-relaxed">
        No personal data is collected when visiting the public site. The admin
        area uses email and password to create login sessions. Uploaded tent
        photos are processed on behalf of the controller.
      </p>

      <h2 className="mt-6 text-lg font-semibold">4. Legal basis</h2>
      <p className="text-sm leading-relaxed">
        Processing is based on Art. 6(1)(b) GDPR (contract; admin login to
        edit event data) and Art. 6(1)(f) GDPR (legitimate interest in secure
        operation of the site).
      </p>

      <h2 className="mt-6 text-lg font-semibold">5. Retention</h2>
      <p className="text-sm leading-relaxed">
        Admin sessions are kept only as long as necessary for sign-in. Tent
        photos and event data are kept as long as the respective event is
        maintained in the application.
      </p>

      <h2 className="mt-6 text-lg font-semibold">6. Your rights</h2>
      <p className="text-sm leading-relaxed">
        You have the right to access, rectification, erasure, restriction,
        data portability, and to object, as well as the right to lodge a
        complaint with a supervisory authority. Please direct requests to the
        contact address above.
      </p>
    </>
  );
}
