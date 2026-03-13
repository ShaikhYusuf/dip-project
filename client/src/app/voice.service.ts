// voice.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

@Injectable({ providedIn: 'root' })
export class VoiceService {

  private voiceSubject = new BehaviorSubject<SpeechSynthesisVoice | null>(null);
  selectedVoice$ = this.voiceSubject.asObservable();

  private recognition: any = null;
  private listening = false;

  /** Speech rate: 0.5 = slow, 1 = normal, 1.5 = fast */
  private speechRate = 1;

  constructor(private ngZone: NgZone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SR) {
      this.recognition = new SR();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 3; // Improved: try more alternatives for accuracy
    }

    this.ensureDefaultVoice();
  }

  private ensureDefaultVoice() {

    const setDefault = () => {
      if (this.voiceSubject.value) return;

      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer an English voice for better clarity
        const englishVoice = voices.find(v => v.lang.startsWith('en') && v.localService);
        this.voiceSubject.next(englishVoice || voices[0]);
      }
    };

    setDefault();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => setDefault();
    }
  }

  setVoice(voice: SpeechSynthesisVoice) {
    this.voiceSubject.next(voice);
  }

  /** Set speech rate: 0.5 (slow), 1 (normal), 1.25, 1.5 (fast) */
  setRate(rate: number) {
    this.speechRate = Math.max(0.25, Math.min(2, rate));
  }

  getRate(): number {
    return this.speechRate;
  }

  speak(text: string, onEnd?: () => void) {

    const voice = this.voiceSubject.value;
    if (!voice) return;

    window.speechSynthesis.cancel();
    this.stopListening();

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.rate = this.speechRate;

    utter.onend = () => {
      this.ngZone.run(() => {
        onEnd?.();
      });
    };

    window.speechSynthesis.speak(utter);
  }

  stopSpeaking() {
    window.speechSynthesis.cancel();
    this.stopListening();
  }

  /**
   * Listen for speech input.
   * - Waits at least `minSilenceMs` (default 3000ms) of silence before closing.
   * - Dynamically extends listening while the user is actively speaking.
   * - Tries up to `maxAlternatives` = 3 for improved accuracy.
   */
  listen(callback: (heard: string) => void, minSilenceMs = 3000) {

    if (!this.recognition) {
       console.warn('SpeechRecognition API not available.');
       callback('');
       return;
    }

    window.speechSynthesis.cancel();
    this.stopListening();

    let finished = false;
    let finalTranscript = '';
    let interimTranscript = '';
    let silenceTimer: any;
    let userHasSpoken = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(silenceTimer);
      this.stopListening();

      // Pick the best transcript
      const result = finalTranscript || interimTranscript;
      console.log('Voice recognized:', result);

      this.ngZone.run(() => {
        callback(result.trim());
      });
    };

    const resetSilenceTimer = () => {
      clearTimeout(silenceTimer);
      // If user has spoken, use the configured silence timeout
      // If user has NOT spoken yet, use a longer initial wait
      const timeout = userHasSpoken ? minSilenceMs : Math.max(minSilenceMs, 5000);
      silenceTimer = setTimeout(() => {
        finish();
      }, timeout);
    };

    this.recognition.onresult = (event: any) => {
      interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Pick the best alternative (highest confidence)
        let bestTranscript = result[0].transcript;
        let bestConfidence = result[0].confidence || 0;
        for (let j = 1; j < result.length; j++) {
          if ((result[j].confidence || 0) > bestConfidence) {
            bestTranscript = result[j].transcript;
            bestConfidence = result[j].confidence;
          }
        }

        if (result.isFinal) {
          finalTranscript += bestTranscript + ' ';
        } else {
          interimTranscript += bestTranscript + ' ';
        }
      }
      userHasSpoken = true;
      resetSilenceTimer(); // Reset timer every time we get speech input
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (['not-allowed', 'audio-capture', 'service-not-allowed'].includes(event.error)) {
         finish();
      }
      // For 'no-speech' error, don't finish — let the silence timer handle it
    };

    this.recognition.onend = () => {
      if (!finished && this.listening) {
        // Auto-restart to keep listening if not finished
        try { this.recognition.start(); } catch {}
      } else if (!finished) {
        finish();
      }
    };

    const startRecognition = () => {
        try {
            this.recognition.start();
            this.listening = true;
            resetSilenceTimer();
        } catch (e: any) {
            console.error('Recognition start failed:', e);
            if (e.name === 'InvalidStateError') {
                 setTimeout(() => {
                     if (!finished) {
                         try { this.recognition.stop(); this.recognition.start(); this.listening = true; } catch (err) { finish(); }
                     }
                 }, 400);
            } else {
                 finish();
            }
        }
    };

    startRecognition();
  }

  private stopListening() {
    if (!this.recognition || !this.listening) return;

    try { this.recognition.stop(); } catch {}
    this.listening = false;
  }
}