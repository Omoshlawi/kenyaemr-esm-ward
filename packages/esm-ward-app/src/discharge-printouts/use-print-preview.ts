import { useEffect, useState } from 'react';
import useSWR from 'swr';

/**
 * Fetches a server-generated document and returns a blob object URL suitable
 * for previewing/printing in an iframe. Uses the browser's cookie session
 * (same-origin) for authentication.
 */
async function fetchPrintPreview(url: string): Promise<Blob> {
  const response = await fetch(url, {
    headers: { Accept: 'application/pdf' },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to load document (status ${response.status})`);
  }
  return response.blob();
}

export function usePrintPreview(url: string | null) {
  const { data: blob, error, isLoading } = useSWR<Blob, Error>(url, fetchPrintPreview);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }
    const createdUrl = URL.createObjectURL(blob);
    setObjectUrl(createdUrl);
    return () => URL.revokeObjectURL(createdUrl);
  }, [blob]);

  return { data: objectUrl, isLoading, error };
}
