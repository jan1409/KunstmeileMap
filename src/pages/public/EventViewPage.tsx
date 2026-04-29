import { SplatViewer } from '../../components/SplatViewer';

// Placeholder splat for development before A2-T13 wires up event.splat_url.
// Local file in public/ (gitignored — see .gitignore).
const PLACEHOLDER_SPLAT = '/OldTrainStation.splat';

export default function EventViewPage() {
  return (
    <main className="h-screen w-screen">
      <SplatViewer splatUrl={PLACEHOLDER_SPLAT} />
    </main>
  );
}
