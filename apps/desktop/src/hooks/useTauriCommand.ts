import { useCallback, useState } from 'react';

/**
 * Hook for calling Tauri commands with loading/error state.
 * Falls back gracefully when running in a browser (non-Tauri) context.
 */
export function useTauriCommand<T>(commandName: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<T>(commandName, args);
        setData(result);
        setLoading(false);
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setLoading(false);
        return null;
      }
    },
    [commandName]
  );

  return { data, loading, error, execute };
}
