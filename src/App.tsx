import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function App() {
  const [status, setStatus] = useState('connecting...');

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ error }) => {
        setStatus(error ? `error: ${error.message}` : 'connected');
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`error: ${msg}`);
      });
  }, []);

  return (
    <main className="flex h-full items-center justify-center">
      <p className="text-xl">Supabase: {status}</p>
    </main>
  );
}
