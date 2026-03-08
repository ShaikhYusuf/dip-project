// lesson-quiz.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GetDataService } from '../get-data.service';
import { VoiceService } from '../voice.service';


@Component({
  selector: 'app-lesson-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule, MatRadioModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-quiz.component.html',
  styleUrls: ['./lesson-quiz.component.css']
})
export class LessonQuizComponent implements OnInit {
  voice: SpeechSynthesisVoice | null = null;
  quizSet: any;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, selected: string, answer: string, isCorrect: boolean }[] = [];
  isShowingFeedback = false;

  constructor(
    private quizService: GetDataService, 
    private route: ActivatedRoute,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    this.quizService.getLessonQuiz(path).subscribe(data => {
      this.quizSet = data;
      this.readCurrentQuestion();
      this.history = []; // Clear history when loading new lesson
    });
  }

  formatQuestionForSpeech(): string {
    const q = this.quizSet.questions[this.currentIndex];
    let speech = `${this.currentIndex + 1}. ${q.question}. `;
    q.options.forEach((opt: string, index: number) => {
      speech += `${index + 1}: ${opt}. `;
    });
    return speech;
  }

  readCurrentQuestion() {
    if (!this.voice || !this.quizSet) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(this.formatQuestionForSpeech());
    utterance.voice = this.voice;
    window.speechSynthesis.speak(utterance);
  }
  readExplanation(isRight: boolean = true) {
    if (!this.voice || !this.quizSet) return;
    const text = isRight 
      ? `That is correct. ${this.quizSet.questions[this.currentIndex].explanation}`
      : `That is incorrect. ${this.quizSet.questions[this.currentIndex].explanation}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    window.speechSynthesis.speak(utterance);
    utterance.onend = () => {
      this.nextQuestion();
    };
  }
  submitAnswer() {
    window.speechSynthesis.cancel();
    this.isShowingFeedback = true; // Block the current card from showing inputs
    this.cdr.detectChanges();
    const currentQ = this.quizSet.questions[this.currentIndex];
    const isCorrect = this.selectedOption === currentQ.answer;

      this.history.push({
        question: currentQ.question,
        selected: this.selectedOption,
        answer: currentQ.answer,
        isCorrect: isCorrect
      });

      this.readExplanation(isCorrect);
  }

  nextQuestion() {
    this.currentIndex++;
    this.selectedOption = '';
    this.isShowingFeedback = false; // Allow new card to show
    this.cdr.detectChanges();
    if (this.currentIndex < this.quizSet.questions.length) {
      this.readCurrentQuestion();
    }
  }
}