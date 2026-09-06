import type { LanguageCode } from '../types/clinical';
import { SUPPORTED_LANGUAGES } from './i18n';

// Speech Synthesis & Recognition Service for Kiosk
class SpeechService {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
      }
    }
  }

  // Speaks given text in target language
  public speak(
    text: string,
    langCode: LanguageCode,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): void {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.stopSpeaking();

      const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      const targetLocale = langInfo ? langInfo.speechCode : 'en-IN';

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLocale;
      utterance.rate = 0.9; // slightly slower for elderly clarity
      utterance.pitch = 1.0;

      // Try selecting Indian voice if available
      const voices = this.synth.getVoices();
      const matchingVoice = voices.find(
        (v) => v.lang === targetLocale || v.lang.startsWith(langCode)
      );
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        if (onError) onError(e);
        if (onEnd) onEnd();
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      if (onEnd) onEnd();
    }
  }

  public stopSpeaking(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // Starts voice recognition
  public startListening(
    langCode: LanguageCode,
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: any) => void,
    onEnd?: () => void
  ): boolean {
    if (!this.recognition) {
      console.warn('Speech recognition not supported in this browser.');
      return false;
    }

    try {
      this.stopListening();

      const langInfo = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      this.recognition.lang = langInfo ? langInfo.speechCode : 'hi-IN';

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          onResult(finalTranscript, true);
        } else if (interimTranscript) {
          onResult(interimTranscript, false);
        }
      };

      this.recognition.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        this.isListening = false;
        if (onError) onError(err);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('Failed to start recognition:', err);
      this.isListening = false;
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
    }
  }

  public isSpeechSupported(): boolean {
    return !!this.synth;
  }

  public isRecognitionSupported(): boolean {
    return !!this.recognition;
  }
}

export const speech = new SpeechService();
