// voice.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  private voiceSubject = new BehaviorSubject<SpeechSynthesisVoice | null>(null);
  selectedVoice$ = this.voiceSubject.asObservable();

  setVoice(voice: SpeechSynthesisVoice) {
    this.voiceSubject.next(voice);
  }

  speak (text: string,  onEndCallback?: () => void) {
    const currentVoice = this.voiceSubject.value;
    if (!currentVoice) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = currentVoice;
    if (onEndCallback) {
      utterance.onend = onEndCallback;
    }
    window.speechSynthesis.speak(utterance);
  }
}