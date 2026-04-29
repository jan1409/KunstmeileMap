import { SplatViewer } from '../../components/SplatViewer';

const PLACEHOLDER_SPLAT = 'https://sparkjs.dev/sample/garden.splat';

export default function EventViewPage() {
  return (
    <main className="h-screen w-screen">
      <SplatViewer splatUrl={PLACEHOLDER_SPLAT} />
    </main>
  );
}
