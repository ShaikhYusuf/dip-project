// lesson-truefalse.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GetDataService } from '../get-data.service';
import { VoiceService } from '../voice.service';
import { ITrueFalseSet } from '../app.model';


@Component({
  selector: 'app-lesson-truefalse',
  standalone: true,
  imports: [CommonModule, FormsModule, MatRadioModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-truefalse.component.html',
  styleUrls: ['./lesson-truefalse.component.css']
})
export class LessonTrueFalseComponent implements OnInit {
  voice: SpeechSynthesisVoice | null = null;
  tfSet!: ITrueFalseSet;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, selected: string, isCorrect: boolean }[] = [];
  isShowingFeedback = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tfService: GetDataService,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    this.tfService.getLessonTrueFalse(path).subscribe((data: ITrueFalseSet) => {
      this.tfSet = data;
      this.readCurrentQuestion();
      this.history = []; // Clear history when loading new lesson
    });
  }

  readCurrentQuestion() {
    if (!this.tfSet) return;
    const q = this.tfSet.questions[this.currentIndex];
    const text = `${q.question}`;
    this.voiceService.speak(text);
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    this.isShowingFeedback = true; // Block the current card from showing inputs
    const currentQ = this.tfSet.questions[this.currentIndex];
    const isCorrect = this.selectedOption === currentQ.answer;

    this.history.push({
      question: currentQ.question,
      selected: this.selectedOption,
      isCorrect: isCorrect
    });
    const feedback = `Answer is, ${currentQ.answer}`;
    this.voiceService.speak(feedback, ()=> this.nextQuestion());
  }

  nextQuestion() {
    this.currentIndex++;
    this.selectedOption = '';
    this.isShowingFeedback = false; // Allow new card to show
    this.cdr.detectChanges();
    if (this.currentIndex < this.tfSet.questions.length) {
      this.readCurrentQuestion();
    }
  }

  navigateToNextPage() {
    const path = this.route.snapshot.queryParams['path'];
    this.router.navigate(['/lesson-shortquestion'], { queryParams: { path } });
  }
}