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
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }
  }

  setVoice(voice: SpeechSynthesisVoice) {
    this.voiceSubject.next(voice);
  }

  speak(text: string, onEnd?: () => void) {

    const voice = this.voiceSubject.value;
    if (!voice) return;

    // cancel previous speech and listening
    window.speechSynthesis.cancel();
    this.stopListening();

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;

    utter.onend = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utter);
  }

  listen(callback: (heard: string) => void, timeout = 5000) {

    if (!this.recognition) return;

    // cancel speaking and previous listening
    window.speechSynthesis.cancel();
    this.stopListening();

    let finished = false;

    const finish = (text: string) => {
      if (finished) return;
      finished = true;
      this.stopListening();
      callback(text);
    };

    const timer = setTimeout(() => {
      finish('');
    }, timeout);

    this.recognition.onresult = (event: any) => {
      clearTimeout(timer);
      const transcript = event.results[0][0].transcript.trim();
      finish(transcript);
    };

    this.recognition.onerror = () => {
      clearTimeout(timer);
      finish('');
    };

    this.recognition.start();
    this.listening = true;
  }

  private stopListening() {
    if (!this.recognition || !this.listening) return;

    try { this.recognition.stop(); } catch {}
    this.listening = false;
  }

}