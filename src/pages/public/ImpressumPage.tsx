export default function ImpressumPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-neutral-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-semibold">Impressum</h1>

      <h2 className="mt-6 text-lg font-semibold">Diensteanbieter</h2>
      <address className="not-italic">
        Jan Poepke
        <br />
        Klosterhoern 3
        <br />
        27419 Sittensen
        <br />
        Deutschland
      </address>

      <h2 className="mt-6 text-lg font-semibold">Kontakt</h2>
      <p>
        Telefon:{' '}
        <a className="underline" href="tel:+4915111359012">
          +49 1511 1359012
        </a>
        <br />
        E-Mail:{' '}
        <a className="underline" href="mailto:jan.poepke@outlook.de">
          jan.poepke@outlook.de
        </a>
      </p>

      <h2 className="mt-6 text-lg font-semibold">
        Verantwortlich i.S.d. § 18 Abs. 2 MStV
      </h2>
      <p>Jan Poepke (Anschrift wie oben)</p>

      <h2 className="mt-6 text-lg font-semibold">Haftung für Inhalte</h2>
      <p className="text-sm leading-relaxed">
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
        auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
        §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
        verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
        überwachen oder nach Umständen zu forschen, die auf eine
        rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
        oder Sperrung der Nutzung von Informationen nach den allgemeinen
        Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist
        jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
        Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
        Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Haftung für Links</h2>
      <p className="text-sm leading-relaxed">
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
        fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
        verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
        der Seiten verantwortlich. Bei Bekanntwerden von Rechtsverletzungen
        werden wir derartige Links umgehend entfernen.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Urheberrecht</h2>
      <p className="text-sm leading-relaxed">
        Die durch den Diensteanbieter erstellten Inhalte und Werke auf
        diesen Seiten unterliegen dem deutschen Urheberrecht. Beiträge
        Dritter sind als solche gekennzeichnet. Die Vervielfältigung,
        Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
        Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
        des jeweiligen Autors bzw. Erstellers.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Online-Streitbeilegung</h2>
      <p className="text-sm leading-relaxed">
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{' '}
        <a
          className="underline"
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://ec.europa.eu/consumers/odr
        </a>
        . Wir sind nicht bereit oder verpflichtet, an
        Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>
    </main>
  );
}
