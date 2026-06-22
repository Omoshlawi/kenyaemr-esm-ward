import React from 'react';

/**
 * Keeps a Date in sync with the real clock, updating at each minute boundary
 * while the form is open.
 */
export function useLcgFormClock(isOpen: boolean): Date {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setNow(new Date());

    let intervalId: number | undefined;
    const syncNow = () => setNow(new Date());
    const timeoutId = window.setTimeout(
      () => {
        syncNow();
        intervalId = window.setInterval(syncNow, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isOpen]);

  return now;
}
