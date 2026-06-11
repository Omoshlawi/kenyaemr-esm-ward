import React from 'react';
import { Button, InlineNotification } from '@carbon/react';
import { useGlobalCdsAlert } from './global-cds-alert-context';

const GlobalCdsAlertDisplay: React.FC = () => {
  const { activeAlert, isAlertSoundEnabled, setIsAlertSoundEnabled, dismissAlert } = useGlobalCdsAlert();
  const [timeRemaining, setTimeRemaining] = React.useState<string>('');

  React.useEffect(() => {
    if (!activeAlert) {
      setTimeRemaining('');
      return;
    }
    const updateTimer = () => {
      const msRemaining = Math.max(0, activeAlert.expiresAtMs - Date.now());
      if (msRemaining <= 0) {
        setTimeRemaining('EXPIRED');
        return;
      }
      const min = Math.floor(msRemaining / 60_000);
      const sec = Math.floor((msRemaining % 60_000) / 1_000);
      setTimeRemaining(min > 0 ? `${min}m ${sec}s` : `${sec}s`);
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(id);
  }, [activeAlert]);

  if (!activeAlert) return null;

  const handleNavigateToPatient = () => {
    const summaryEncoded = encodeURIComponent(activeAlert.summary);
    const sourceNameEncoded = encodeURIComponent(activeAlert.sourcePatientName);
    const targetPath = `/openmrs/spa/patient/${activeAlert.sourcePatientUuid}/chart/clinical-encounter?lcgCdsPatient=${activeAlert.sourcePatientUuid}&lcgCdsPatientName=${sourceNameEncoded}&lcgCdsTrigger=${activeAlert.triggerTimeMs}&lcgCdsSummary=${summaryEncoded}`;
    window.location.assign(targetPath);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 10000,
        maxWidth: '420px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '4px',
      }}>
      <InlineNotification
        kind="error"
        title={`Critical Alert for ${activeAlert.sourcePatientName}`}
        subtitle={`${activeAlert.summary} Time window closing: ${timeRemaining}`}
        onCloseButtonClick={dismissAlert}
        style={{ marginBottom: 0 }}
      />
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e0e0e0',
        }}>
        <Button kind="primary" size="sm" onClick={handleNavigateToPatient} style={{ flex: 1 }}>
          Open Patient Page
        </Button>
        <Button
          kind="ghost"
          size="sm"
          onClick={() => setIsAlertSoundEnabled(!isAlertSoundEnabled)}
          aria-label={isAlertSoundEnabled ? 'Mute alarm' : 'Unmute alarm'}>
          {isAlertSoundEnabled ? '🔔' : '🔕'}
        </Button>
      </div>
    </div>
  );
};

export default GlobalCdsAlertDisplay;
