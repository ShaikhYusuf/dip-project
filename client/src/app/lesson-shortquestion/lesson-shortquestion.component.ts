// lesson-shortquestion.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { GetDataService } from '../get-data.service';
import { VoiceService } from '../voice.service';
import { IShortQuestionSet } from '../app.model';


@Component({
  selector: 'app-lesson-shortquestion',
  standalone: true,
  imports: [CommonModule, FormsModule, MatInputModule, MatButtonModule, MatCardModule, MatFormFieldModule],
  templateUrl: './lesson-shortquestion.component.html',
  styleUrls: ['./lesson-shortquestion.component.css']
})
export class LessonShortQuestionComponent implements OnInit {
  voice: SpeechSynthesisVoice | null = null;
  sqSet!: IShortQuestionSet;
  currentIndex = 0;
  userAnswer: string = '';
  history: { question: string, answer: string, userAnswer: string }[] = [];
  isShowingFeedback = false;

  constructor(
    private sqService: GetDataService,
    private route: ActivatedRoute,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    this.sqService.getLessonShortQuestions(path).subscribe((data: IShortQuestionSet) => {
      this.sqSet = data;
      this.readCurrentQuestion();
      this.history = []; // Clear history when loading new lesson
    });
  }

  readCurrentQuestion() {
    if (!this.sqSet) return;
    const text = this.sqSet.questions[this.currentIndex].question;
    this.voiceService.speak(text);
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    this.isShowingFeedback = true; // Block the current card from showing inputs
    this.cdr.detectChanges();

    const currentQ = this.sqSet.questions[this.currentIndex];
    this.history.push({
      question: currentQ.question,
      answer: currentQ.answer,
      userAnswer: this.userAnswer
    });
    const feedback = `The correct answer is, ${currentQ.answer}`;
    this.voiceService.speak(feedback, () => this.nextQuestion());
  }

  nextQuestion() {
    this.currentIndex++;
    this.userAnswer = '';
    this.isShowingFeedback = false; // Allow new card to show
    this.cdr.detectChanges();
    if (this.currentIndex < this.sqSet.questions.length) {
      this.readCurrentQuestion();
    }
  }
}