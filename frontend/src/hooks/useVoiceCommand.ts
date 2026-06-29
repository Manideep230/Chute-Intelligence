import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceCommandCallback = (command: string, transcript: string) => void;

export interface VoiceConfig {
  lang?: string;        // 'en-US' | 'hi-IN'
  onCommand?: VoiceCommandCallback;
  speak?: (msg: string) => void;
}

/** Fuzzy-match transcript against a list of patterns */
function matchCommand(transcript: string, patterns: string[]): boolean {
  const t = transcript.toLowerCase().trim();
  return patterns.some(p => t.includes(p.toLowerCase()));
}

/** Simple TTS */
export function speakText(msg: string, lang = 'en-US') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(msg);
  utt.lang = lang;
  utt.rate = 1.05;
  window.speechSynthesis.speak(utt);
}

export interface UseVoiceCommandReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  isSupported: boolean;
}

/**
 * useVoiceCommand — Wraps the Web Speech API for the Nigha Radar voice command system.
 *
 * Supported commands (case-insensitive, partial match):
 *  - "show chute health" / "chute health"
 *  - "open maintenance" / "maintenance"
 *  - "show alerts" / "alerts" / "notifications"
 *  - "generate report" / "export report" / "download report"
 *  - "switch chute" / "next chute" / "change chute"
 *  - "AI insights" / "open AI" / "predictions"
 *  - "go to profile" / "profile" / "settings"
 *  - "night mode" / "dark mode" / "day mode" / "light mode"
 *  - "sign out" / "logout" / "log out"
 *  - "fire valve [N]" / "blast valve [N]"
 *  - "open incidents" / "incidents"
 *  - "open analytics" / "fleet analytics"
 */
export function useVoiceCommand(config: VoiceConfig = {}): UseVoiceCommandReturn {
  const { lang = 'en-US', onCommand } = config;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const pendingBlastRef = useRef<number | null>(null);

  const SpeechRecognition =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const speak = useCallback((msg: string) => {
    speakText(msg, lang);
  }, [lang]);

  const handleResult = useCallback((rawTranscript: string) => {
    const t = rawTranscript.toLowerCase().trim();
    setTranscript(rawTranscript);

    // ── Wake word pass-through (listening is already ON) ──
    // Pending blast confirmation
    if (pendingBlastRef.current !== null) {
      if (matchCommand(t, ['confirm', 'yes', 'proceed', 'fire'])) {
        onCommand?.('confirm-blast', `${pendingBlastRef.current}`);
        speak(`Firing valve ${pendingBlastRef.current} now.`);
        pendingBlastRef.current = null;
      } else if (matchCommand(t, ['cancel', 'abort', 'no', 'stop'])) {
        speak('Blast cancelled.');
        pendingBlastRef.current = null;
      }
      return;
    }

    // ── Command matching ──
    if (matchCommand(t, ['chute health', 'show health', 'health score'])) {
      speak('Opening chute health overview.');
      onCommand?.('health', t);
    } else if (matchCommand(t, ['open maintenance', 'maintenance panel', 'maintenance hub', 'go to maintenance'])) {
      speak('Opening maintenance hub.');
      onCommand?.('maintenance', t);
    } else if (matchCommand(t, ['show alerts', 'active alerts', 'notifications', 'alert timeline'])) {
      speak('Showing active alerts.');
      onCommand?.('timeline', t);
    } else if (matchCommand(t, ['generate report', 'export report', 'download report', 'create report'])) {
      speak('Generating operational report.');
      onCommand?.('report', t);
    } else if (matchCommand(t, ['switch chute', 'next chute', 'change chute'])) {
      speak('Switching chute.');
      onCommand?.('switch-chute', t);
    } else if (matchCommand(t, ['ai insight', 'open ai', 'predictions', 'ai analytics', 'open analytics'])) {
      speak('Opening AI insights panel.');
      onCommand?.('ai', t);
    } else if (matchCommand(t, ['go to profile', 'profile settings', 'my profile', 'settings'])) {
      speak('Opening profile settings.');
      onCommand?.('profile', t);
    } else if (matchCommand(t, ['night mode', 'dark mode', 'night ops'])) {
      speak('Switching to Night Ops mode.');
      onCommand?.('theme-dark', t);
    } else if (matchCommand(t, ['day mode', 'light mode', 'day shift'])) {
      speak('Switching to Day Shift mode.');
      onCommand?.('theme-light', t);
    } else if (matchCommand(t, ['sign out', 'log out', 'logout', 'sign me out'])) {
      speak('Signing out. Goodbye.');
      onCommand?.('logout', t);
    } else if (matchCommand(t, ['open incidents', 'incident center', 'incidents'])) {
      speak('Opening incident center.');
      onCommand?.('incidents', t);
    } else if (matchCommand(t, ['throughput', 'flow rate', 'open throughput'])) {
      speak('Opening throughput details.');
      onCommand?.('throughput', t);
    } else if (matchCommand(t, ['environment', 'temperature', 'humidity'])) {
      speak('Opening environmental panel.');
      onCommand?.('environment', t);
    } else {
      // Check for "fire valve N" / "blast valve N"
      const valveMatch = t.match(/(?:fire|blast|trigger|activate)\s+(?:valve|sv|solenoid)?\s*([1-8])/);
      if (valveMatch) {
        const valveNo = parseInt(valveMatch[1]);
        pendingBlastRef.current = valveNo;
        speak(`You said fire valve ${valveNo}. Say "confirm" to proceed or "cancel" to abort.`);
        onCommand?.('confirm-blast-pending', `${valveNo}`);
      } else {
        // Unrecognized — give hint
        speak('Command not recognized. Try: show chute health, open maintenance, fire valve 3, or generate report.');
      }
    }
  }, [onCommand, speak]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Use Chrome or Edge.');
      return;
    }
    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      handleResult(text);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError('Could not start microphone. Check browser permissions.');
    }
  }, [SpeechRecognition, isListening, lang, handleResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { isListening, transcript, error, startListening, stopListening, toggleListening, isSupported };
}
