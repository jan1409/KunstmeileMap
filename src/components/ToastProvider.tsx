import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type Level = 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  level: Level;
}

interface ToastApi {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const TIMEOUTS: Record<Level, number> = { success: 4000, error: 8000 };

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timeoutsRef.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, level: Level) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, level }]);
      const handle = setTimeout(() => dismiss(id), TIMEOUTS[level]);
      timeoutsRef.current.set(id, handle);
    },
    [dismiss],
  );

  // Cleanup pending timeouts on unmount.
  useEffect(() => {
    const map = timeoutsRef.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  const api: ToastApi = {
    showSuccess: (m) => show(m, 'success'),
    showError: (m) => show(m, 'error'),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isError = toast.level === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex max-w-sm items-start gap-2 rounded px-3 py-2 text-sm text-white shadow-lg backdrop-blur ${
        isError ? 'bg-red-500/90' : 'bg-emerald-500/90'
      }`}
    >
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-white/80 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- useToast co-located with context for cohesion; HMR fallback to full reload is acceptable for this top-level provider (matches the AuthProvider pattern).
export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
