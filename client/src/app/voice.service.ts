// voice.service.ts
import { Injectable } from '@angular/core';
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

  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SR) {
      this.recognition = new SR();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 3;
    }

    this.ensureDefaultVoice();
  }

  private ensureDefaultVoice() {

    const setDefault = () => {
      if (this.voiceSubject.value) return;

      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        this.voiceSubject.next(voices[0]);
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

  speak(text: string, onEnd?: () => void) {

    const voice = this.voiceSubject.value;
    if (!voice) return;

    window.speechSynthesis.cancel();
    this.stopListening();

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;

    utter.onend = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utter);
  }

  stopSpeaking() {
    window.speechSynthesis.cancel();
    this.stopListening();
  }

  listen(callback: (heard: string) => void, timeout = 3000) {

    if (!this.recognition) return;

    window.speechSynthesis.cancel();
    this.stopListening();

    let finished = false;
    let finalTranscript = '';
    let silenceTimer: any;

    const finish = (text: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(silenceTimer);
      this.stopListening();
      callback(text.trim());
    };

    const resetSilenceTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        finish(finalTranscript);
      }, timeout);
    };

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + ' ';
        }
      }
      resetSilenceTimer();
    };

    this.recognition.onerror = () => {
      finish(finalTranscript);
    };

    this.recognition.onend = () => {
      if (!finished && this.listening) {
        try { this.recognition.start(); } catch {}
      }
    };

    this.recognition.start();
    this.listening = true;

    resetSilenceTimer();
  }

  private stopListening() {
    if (!this.recognition || !this.listening) return;

    try { this.recognition.stop(); } catch {}
    this.listening = false;
  }

}