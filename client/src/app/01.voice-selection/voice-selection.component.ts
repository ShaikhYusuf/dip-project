// voice-selection.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VoiceService } from '../voice.service';

@Component({
  selector: 'app-voice-selection',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule, MatCardModule],
  templateUrl: './voice-selection.component.html',
  styleUrl: './voice-selection.component.css'
})
export class VoiceSelectionComponent {

  voices: SpeechSynthesisVoice[] = [];
  selectedVoice: SpeechSynthesisVoice | null = null;
  textToRead: string = "The only way to do great work is to love what you do.";

  constructor(private voiceService: VoiceService, private router: Router) {}

  ngOnInit() {
    this.loadVoices();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }

    this.voiceService.selectedVoice$.subscribe(v => {
      if (v && !this.selectedVoice) {
        this.selectedVoice = v;
      }
    });
  }

  loadVoices() {
    const allVoices = window.speechSynthesis.getVoices();
    this.voices = allVoices;

    if (this.voices.length > 0 && !this.selectedVoice) {
      this.selectedVoice = this.voices[0];
      this.voiceService.setVoice(this.selectedVoice);
    }
  }

  speak() {

    if (!this.selectedVoice || !this.textToRead) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(this.textToRead);
    utterance.voice = this.selectedVoice;
    window.speechSynthesis.speak(utterance);
  }

  navigateToLesson() {

    if (this.selectedVoice) {
      this.voiceService.setVoice(this.selectedVoice);
    }

    this.router.navigate(['/']);
  }
}