import { useParams } from 'react-router-dom';

export default function EventViewPage() {
  const { eventSlug, tentSlug } = useParams();
  return (
    <main className="p-6">
      <h1 className="text-2xl">EventViewPage (placeholder)</h1>
      <p className="mt-2 text-sm text-white/60">event: {eventSlug ?? '(featured)'}</p>
      <p className="text-sm text-white/60">tent: {tentSlug ?? '(none)'}</p>
    </main>
  );
}
