import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VoiceService } from '../voice.service';

@Component({
  selector: 'app-voice-selection',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule],
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
  }

  loadVoices() {
    const allVoices = window.speechSynthesis.getVoices();
    this.voices = allVoices;
    
    if (this.voices.length > 0 && !this.selectedVoice) {
      // Default to the first voice available
      this.selectedVoice = this.voices[0];
    }
  }

  speak() {
    if (!this.selectedVoice || !this.textToRead) return;
    
    // Stop any current speech before starting new one
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(this.textToRead);
    utterance.voice = this.selectedVoice;
    window.speechSynthesis.speak(utterance);
  }

  navigateToLesson() {
    if (this.selectedVoice) {
      this.voiceService.setVoice(this.selectedVoice);
      this.router.navigate(['/lesson-hierarchy']);
    }
  }
}
