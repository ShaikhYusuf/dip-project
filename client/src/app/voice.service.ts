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
}