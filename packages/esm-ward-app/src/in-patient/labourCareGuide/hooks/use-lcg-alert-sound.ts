import React from 'react';

export function useLcgAlertSound() {
  const [isBeepActive, setIsBeepActive] = React.useState(false);
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = React.useState<boolean>(true);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const beepIntervalRef = React.useRef<number | null>(null);

  const stopAlertBeep = React.useCallback(() => {
    setIsBeepActive(false);
    if (beepIntervalRef.current !== null) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  const startAlertBeep = React.useCallback(() => {
    setIsBeepActive(true);
  }, []);

  React.useEffect(() => {
    if (!isAlertSoundEnabled) {
      stopAlertBeep();
    }
  }, [isAlertSoundEnabled, stopAlertBeep]);

  React.useEffect(() => {
    if (!isBeepActive || !isAlertSoundEnabled) {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
      return;
    }

    const playSingleBeep = () => {
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
          context.resume().catch(() => {
            // Ignore browser gesture policy errors.
          });
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
        // Ignore audio device/runtime failures.
      }
    };

    playSingleBeep();
    beepIntervalRef.current = window.setInterval(playSingleBeep, 700);

    return () => {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [isAlertSoundEnabled, isBeepActive]);

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
        audioContextRef.current.resume().catch(() => {
          // Ignore resume failures.
        });
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
  }, [isAlertSoundEnabled, isBeepActive]);

  React.useEffect(() => {
    return () => {
      if (beepIntervalRef.current !== null) {
        window.clearInterval(beepIntervalRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // Ignore close failures.
        });
      }
    };
  }, []);

  return {
    isAlertSoundEnabled,
    setIsAlertSoundEnabled,
    startAlertBeep,
    stopAlertBeep,
  };
}
