// lesson-shortquestion.component.ts
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
import { IScoreUpdate, IShortQuestionSet } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-shortquestion',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, FormsModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-shortquestion.component.html',
  styleUrls: ['./lesson-shortquestion.component.css']
})
export class LessonShortQuestionComponent implements OnInit, OnDestroy {
  sqSet!: IShortQuestionSet;
  currentIndex = 0;
  userAnswer: string = '';
  history: { question: string, answer: string, userAnswer: string, isCorrect: boolean }[] = [];
  isShowingFeedback = false;
  isListening = false;
  isTextareaFocused = false;
  isSpeaking = false;
  nextPage: string = '/lesson-hierarchy';

  // Timer
  timerSeconds = 0;
  timerInterval: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private sqService: AppDataService,
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
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-hierarchy';

    if (path) {
      localStorage.setItem('lastVisitedPath', path);
    }

    this.sqService.getLessonShortQuestions(path).subscribe((data: IShortQuestionSet) => {
      this.sqSet = data;
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

  readCurrentQuestion() {
    if (!this.sqSet) return;
    const text = this.sqSet.questions[this.currentIndex].question;
    this.isSpeaking = true;
    this.voiceService.speak(text, () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    });
  }

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
      const item = this.history[this.history.length - 1];
      if (item) {
        this.isSpeaking = true;
        const feedback = `The answer is, ${item.answer}`;
        this.voiceService.speak(feedback, () => {
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
    this.processAnswer(this.userAnswer);
  }

  processAnswer(userAnswer: string) {
    const currentQ = this.sqSet.questions[this.currentIndex];
    const spoken = userAnswer;

    this.sqService.compareTextToEmbedding(spoken, currentQ.answer_embedding!).subscribe(response => {
      const isCorrect = response.match;
      this.isShowingFeedback = true;
      this.cdr.detectChanges();

      this.history.push({
        question: currentQ.question,
        answer: currentQ.answer,
        userAnswer: userAnswer,
        isCorrect: isCorrect
      });

      const feedback = isCorrect
        ? `That is correct. The answer is, ${currentQ.answer}`
        : `That is incorrect. The answer is, ${currentQ.answer}`;
      this.isSpeaking = true;
      this.cdr.detectChanges();
      this.voiceService.speak(feedback, () => {
        this.isSpeaking = false;
        this.cdr.detectChanges();
        this.nextQuestion();
      });
    });
  }

  nextQuestion() {
    this.currentIndex++;
    this.userAnswer = '';
    this.isShowingFeedback = false;
    this.cdr.detectChanges();
    if (this.currentIndex < this.sqSet.questions.length) {
      this.readCurrentQuestion();
    } else {
      this.stopTimer();
    }
  }

  navigateToNextPage() {
    const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);
    const path = this.route.snapshot.queryParams['path'];
    let scoreUpdate: IScoreUpdate = { shortquestion_score: score };
    this.sqService.updateScores(path, scoreUpdate).subscribe(
      () => {
        this.router.navigate([this.nextPage], { queryParams: { path } });
      },
      err => {
        console.error('unable to update short question score', err);
        this.router.navigate([this.nextPage], { queryParams: { path } });
      }
    );
  }
}