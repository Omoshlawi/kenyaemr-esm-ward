import React from 'react';
import { Button, InlineNotification } from '@carbon/react';

const GLOBAL_CDS_ALERT_STORAGE_KEY = 'lcp.global.cds.alert.v1';

type CdsAlertPayload = {
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

function readValidAlert(): CdsAlertPayload | null {
  try {
    const stored = window.localStorage.getItem(GLOBAL_CDS_ALERT_STORAGE_KEY);
    if (!stored) return null;
    const payload = JSON.parse(stored) as CdsAlertPayload;
    if (!payload || payload.type !== 'lcg-cds-critical') return null;
    const nowMs = Date.now();
    if (nowMs < payload.activatesAtMs || nowMs >= payload.expiresAtMs) return null;
    return payload;
  } catch {
    return null;
  }
}

type Props = {
  patientUuid: string;
};

const GlobalCdsAlertBanner: React.FC<Props> = ({ patientUuid }) => {
  const [alert, setAlert] = React.useState<CdsAlertPayload | null>(() => {
    const a = readValidAlert();
    if (a && a.sourcePatientUuid === patientUuid) return null;
    return a;
  });
  const [timeRemaining, setTimeRemaining] = React.useState<string>('');
  const [isSoundEnabled, setIsSoundEnabled] = React.useState(true);
  const [isDismissed, setIsDismissed] = React.useState(false);

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const beepIntervalRef = React.useRef<number | null>(null);
  const playSingleBeep = React.useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new Ctx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx.state !== 'running') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.56);
    } catch {
      // Audio playback may be blocked until the user interacts with the page.
    }
  }, []);

  const startBeep = React.useCallback(() => {
    if (beepIntervalRef.current !== null) return;
    playSingleBeep();
    beepIntervalRef.current = window.setInterval(playSingleBeep, 700);
  }, [playSingleBeep]);

  const stopBeep = React.useCallback(() => {
    if (beepIntervalRef.current !== null) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);
  React.useEffect(() => {
    if (!alert || !isSoundEnabled) return;
    const unlock = () => {
      if (!audioContextRef.current) return;
      if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [alert, isSoundEnabled]);
  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== GLOBAL_CDS_ALERT_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as CdsAlertPayload;
        if (!payload || payload.type !== 'lcg-cds-critical') return;
        const nowMs = Date.now();
        if (nowMs < payload.activatesAtMs || nowMs >= payload.expiresAtMs) return;
        if (payload.sourcePatientUuid === patientUuid) return;
        setIsDismissed(false);
        setAlert(payload);
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', handleStorage);
    const pollId = window.setInterval(() => {
      const a = readValidAlert();
      if (!a || a.sourcePatientUuid === patientUuid) {
        setAlert((prev) => {
          if (prev) stopBeep();
          return null;
        });
        return;
      }
      setAlert((prev) => {
        if (prev && prev.sourcePatientUuid === a.sourcePatientUuid && prev.triggerTimeMs === a.triggerTimeMs) {
          return prev;
        }
        setIsDismissed(false);
        return a;
      });
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(pollId);
    };
  }, [patientUuid, stopBeep]);
  React.useEffect(() => {
    if (alert && !isDismissed && isSoundEnabled) {
      startBeep();
    } else {
      stopBeep();
    }
    return () => stopBeep();
  }, [alert, isDismissed, isSoundEnabled, startBeep, stopBeep]);
  React.useEffect(() => {
    if (!alert) {
      setTimeRemaining('');
      return;
    }
    const tick = () => {
      const ms = Math.max(0, alert.expiresAtMs - Date.now());
      if (ms <= 0) {
        setTimeRemaining('EXPIRED');
        setAlert(null);
        stopBeep();
        return;
      }
      const min = Math.floor(ms / 60_000);
      const sec = Math.floor((ms % 60_000) / 1_000);
      setTimeRemaining(min > 0 ? `${min}m ${sec}s` : `${sec}s`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [alert, stopBeep]);
  React.useEffect(() => {
    return () => {
      stopBeep();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopBeep]);

  if (!alert || isDismissed) return null;

  const handleNavigate = () => {
    stopBeep();
    const summaryEncoded = encodeURIComponent(alert.summary);
    const nameEncoded = encodeURIComponent(alert.sourcePatientName);
    const targetPath = `/openmrs/spa/patient/${alert.sourcePatientUuid}/chart/clinical-encounter?lcgCdsPatient=${alert.sourcePatientUuid}&lcgCdsPatientName=${nameEncoded}&lcgCdsTrigger=${alert.triggerTimeMs}&lcgCdsSummary=${summaryEncoded}`;
    window.location.assign(targetPath);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    stopBeep();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 10000,
        maxWidth: '420px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        borderRadius: '4px',
      }}>
      <InlineNotification
        kind="error"
        title={`Critical Alert — ${alert.sourcePatientName}`}
        subtitle={`${alert.summary} | Time window closing: ${timeRemaining}`}
        onCloseButtonClick={handleDismiss}
        style={{ marginBottom: 0 }}
      />
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e0e0e0',
          borderRadius: '0 0 4px 4px',
        }}>
        <Button kind="primary" size="sm" onClick={handleNavigate} style={{ flex: 1 }}>
          Go to {alert.sourcePatientName}
        </Button>
        <Button
          kind="ghost"
          size="sm"
          onClick={() => setIsSoundEnabled((v) => !v)}
          aria-label={isSoundEnabled ? 'Mute' : 'Unmute'}>
          {isSoundEnabled ? '🔔' : '🔕'}
        </Button>
      </div>
    </div>
  );
};

export default GlobalCdsAlertBanner;
