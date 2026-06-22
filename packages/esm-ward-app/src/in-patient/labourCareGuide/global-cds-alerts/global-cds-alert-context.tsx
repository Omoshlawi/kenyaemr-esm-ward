import React from 'react';

export type GlobalCdsAlertPayload = {
  type: 'lcg-cds-critical';
  sourcePatientUuid: string;
  sourcePatientName: string;
  triggerTimeMs: number;
  expiresAtMs: number;
  activatesAtMs: number;
  summary: string;
  items: Array<{ section: string; code: string; guidance: string }>;
  detectedAtMs: number;
};

type GlobalCdsAlertContextType = {
  activeAlert: GlobalCdsAlertPayload | null;
  isBeepActive: boolean;
  isAlertSoundEnabled: boolean;
  setIsAlertSoundEnabled: (enabled: boolean) => void;
  dismissAlert: () => void;
  broadcastAlert: (payload: GlobalCdsAlertPayload) => void;
  startGlobalBeep: () => void;
  stopGlobalBeep: () => void;
};

const GlobalCdsAlertContext = React.createContext<GlobalCdsAlertContextType | undefined>(undefined);
const GLOBAL_CDS_ALERT_STORAGE_KEY = 'lcp.global.cds.alert.v1';
const GLOBAL_BEEP_ACTIVE_STORAGE_KEY = 'lcp.global.beep.active.v1';

export const GlobalCdsAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAlert, setActiveAlert] = React.useState<GlobalCdsAlertPayload | null>(() => {
    try {
      const stored = window.localStorage.getItem(GLOBAL_CDS_ALERT_STORAGE_KEY);
      if (!stored) return null;
      const payload = JSON.parse(stored) as GlobalCdsAlertPayload;
      if (!payload || payload.type !== 'lcg-cds-critical') return null;
      const nowMs = Date.now();
      if (payload.activatesAtMs == null || nowMs < payload.activatesAtMs || nowMs >= payload.expiresAtMs) return null;
      return payload;
    } catch {
      return null;
    }
  });
  const [isBeepActive, setIsBeepActive] = React.useState(false);
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = React.useState(true);

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const beepIntervalRef = React.useRef<number | null>(null);
  const lastProcessedAlertKeyRef = React.useRef<string | null>(null);
  const playSingleBeep = React.useCallback(() => {
    try {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextConstructor) {
        return;
      }

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextConstructor();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      if (context.state !== 'running') {
        return;
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1000, context.currentTime);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.55, context.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.56);
    } catch {
      // Audio playback may be blocked until the user interacts with the page.
    }
  }, []);

  const startGlobalBeep = React.useCallback(() => {
    if (isBeepActive) {
      return;
    }
    setIsBeepActive(true);
  }, [isBeepActive]);

  const stopGlobalBeep = React.useCallback(() => {
    setIsBeepActive(false);
    if (beepIntervalRef.current !== null) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);
  React.useEffect(() => {
    if (!isBeepActive || !isAlertSoundEnabled) {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
      return;
    }

    playSingleBeep();
    beepIntervalRef.current = window.setInterval(playSingleBeep, 700);

    return () => {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [isBeepActive, isAlertSoundEnabled, playSingleBeep]);

  React.useEffect(() => {
    if (!isBeepActive || !isAlertSoundEnabled) {
      return;
    }

    const unlockAudio = () => {
      if (!audioContextRef.current) {
        const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        audioContextRef.current = new AudioContextConstructor();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isBeepActive, isAlertSoundEnabled]);
  React.useEffect(() => {
    return () => {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const dismissAlert = React.useCallback(() => {
    setActiveAlert(null);
    stopGlobalBeep();
  }, [stopGlobalBeep]);

  const broadcastAlert = React.useCallback(
    (payload: GlobalCdsAlertPayload) => {
      try {
        window.localStorage.setItem(GLOBAL_CDS_ALERT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }

      setActiveAlert(payload);
      startGlobalBeep();
    },
    [startGlobalBeep],
  );

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== GLOBAL_CDS_ALERT_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const payload = JSON.parse(event.newValue) as GlobalCdsAlertPayload;
        if (!payload || payload.type !== 'lcg-cds-critical') {
          return;
        }

        const nowMs = Date.now();
        if (payload.activatesAtMs == null || nowMs < payload.activatesAtMs || nowMs >= payload.expiresAtMs) {
          return;
        }
        const alertKey = `${payload.sourcePatientUuid}-${payload.triggerTimeMs}-${payload.summary}`;
        if (lastProcessedAlertKeyRef.current === alertKey) {
          return;
        }

        lastProcessedAlertKeyRef.current = alertKey;
        setActiveAlert({ ...payload, detectedAtMs: nowMs });
        startGlobalBeep();
      } catch {
        // Ignore malformed or unavailable cross-tab alert payloads.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [startGlobalBeep]);

  React.useEffect(() => {
    if (!activeAlert) {
      return;
    }

    const nowMs = Date.now();
    if (nowMs >= activeAlert.expiresAtMs) {
      dismissAlert();
      return;
    }

    const msUntilExpiry = activeAlert.expiresAtMs - nowMs;
    const timeoutId = window.setTimeout(() => {
      dismissAlert();
    }, msUntilExpiry);

    return () => window.clearTimeout(timeoutId);
  }, [activeAlert, dismissAlert]);

  const value: GlobalCdsAlertContextType = {
    activeAlert,
    isBeepActive,
    isAlertSoundEnabled,
    setIsAlertSoundEnabled,
    dismissAlert,
    broadcastAlert,
    startGlobalBeep,
    stopGlobalBeep,
  };

  return <GlobalCdsAlertContext.Provider value={value}>{children}</GlobalCdsAlertContext.Provider>;
};

const noop = () => {};
const noopFallback: GlobalCdsAlertContextType = {
  activeAlert: null,
  isBeepActive: false,
  isAlertSoundEnabled: true,
  setIsAlertSoundEnabled: noop,
  dismissAlert: noop,
  broadcastAlert: noop,
  startGlobalBeep: noop,
  stopGlobalBeep: noop,
};

export const useGlobalCdsAlert = (): GlobalCdsAlertContextType => {
  const context = React.useContext(GlobalCdsAlertContext);
  return context ?? noopFallback;
};
