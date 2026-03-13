// lesson-quiz.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { IQuizSet, IScoreUpdate } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-quiz',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, FormsModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-quiz.component.html',
  styleUrls: ['./lesson-quiz.component.css']
})
export class LessonQuizComponent implements OnInit, OnDestroy {
  quizSet!: IQuizSet;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, answer: string, userAnswer: string, isCorrect: boolean, explanation: string }[] = [];
  isShowingFeedback = false;
  isListening = false;
  isSpeaking = false;
  nextPage: string = '/lesson-truefalse';

  // Timer
  timerSeconds = 0;
  timerInterval: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private quizService: AppDataService,
    private utilityService: AppUtilityService,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.voiceService.stopSpeaking();
        this.stopTimer();
      }
    });
  }

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-truefalse';

    if (path) {
      localStorage.setItem('lastVisitedPath', path);
    }

    this.quizService.getLessonQuiz(path).subscribe((data: IQuizSet) => {
      this.quizSet = data;
      this.readCurrentQuestion();
      this.history = [];
      this.startTimer();
    });
  }

  ngOnDestroy() {
    this.voiceService.stopSpeaking();
    this.stopTimer();
  }

  // ── Timer ──
  startTimer() {
    this.timerSeconds = 0;
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.cdr.detectChanges();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  get formattedTimer(): string {
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    if (!this.quizSet) return;
    this.isSpeaking = true;
    this.voiceService.speak(this.formatQuestionForSpeech(), () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    });
  }

  readExplanation(isRight: boolean = true) {
    if (!this.quizSet) return;
    const text = isRight
      ? `That is correct. ${this.quizSet.questions[this.currentIndex].explanation}`
      : `That is incorrect. ${this.quizSet.questions[this.currentIndex].explanation}`;
    this.isSpeaking = true;
    this.cdr.detectChanges();
    this.voiceService.speak(text, () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
      this.nextQuestion();
    });
  }

  /** Skip the spoken explanation and go straight to next question */
  skipToNext() {
    this.voiceService.stopSpeaking();
    this.isSpeaking = false;
    this.nextQuestion();
  }

  stopSpeaking() {
    this.voiceService.stopSpeaking();
    this.isSpeaking = false;
    this.cdr.detectChanges();
  }

  replaySpeaking() {
    this.voiceService.stopSpeaking();
    if (this.isShowingFeedback) {
      // Replay explanation
      const item = this.history[this.history.length - 1];
      if (item) {
        this.isSpeaking = true;
        this.voiceService.speak(item.explanation, () => {
          this.isSpeaking = false;
          this.cdr.detectChanges();
        });
      }
    } else {
      this.readCurrentQuestion();
    }
  }

  submitAnswerVoice() {
    this.isListening = true;
    this.cdr.detectChanges();
    this.voiceService.listen((heard) => {
      this.isListening = false;
      this.cdr.detectChanges();
      this.processAnswer(heard);
    });
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    this.processAnswer(this.selectedOption);
  }

  processAnswer(userAnswer: string) {
    const currentQ = this.quizSet.questions[this.currentIndex];
    const spoken = userAnswer.toLowerCase();

    this.quizService.compareTextToEmbedding(spoken, currentQ.answer_embedding!).subscribe(response => {
      const isCorrect = response.match;

      this.isShowingFeedback = true;
      this.cdr.detectChanges();

      this.history.push({
        question: currentQ.question,
        answer: currentQ.answer,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        explanation: currentQ.explanation
      });

      this.readExplanation(isCorrect);
    });
  }

  nextQuestion() {
    this.currentIndex++;
    this.selectedOption = '';
    this.isShowingFeedback = false;
    this.cdr.detectChanges();
    if (this.currentIndex < this.quizSet.questions.length) {
      this.readCurrentQuestion();
    } else {
      this.stopTimer();
    }
  }


  navigateToNextPage() {
    const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);
    const path = this.route.snapshot.queryParams['path'];
    let scoreUpdate: IScoreUpdate = { quiz_score: score };
    this.quizService.updateScores(path, scoreUpdate).subscribe(
      () => {
        this.router.navigate([this.nextPage], { queryParams: { path } });
      },
      err => {
        console.error('unable to update quiz score', err);
        this.router.navigate(['/']);
      }
    );
  }
}