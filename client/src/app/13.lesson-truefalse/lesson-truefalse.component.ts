// lesson-truefalse.component.ts
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
import { IScoreUpdate, ITrueFalseSet } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-truefalse',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, FormsModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-truefalse.component.html',
  styleUrls: ['./lesson-truefalse.component.css']
})
export class LessonTrueFalseComponent implements OnInit, OnDestroy {
  tfSet!: ITrueFalseSet;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, userAnswer: string, isCorrect: boolean, answer: string }[] = [];
  isShowingFeedback = false;
  isListening = false;
  isSpeaking = false;
  nextPage: string = '/lesson-shortquestion';

  // Timer
  timerSeconds = 0;
  timerInterval: any = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tfService: AppDataService,
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
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-shortquestion';

    if (path) {
      localStorage.setItem('lastVisitedPath', path);
    }

    this.tfService.getLessonTrueFalse(path).subscribe((data: ITrueFalseSet) => {
      this.tfSet = data;
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
    if (!this.tfSet) return;
    const q = this.tfSet.questions[this.currentIndex];
    this.isSpeaking = true;
    this.voiceService.speak(q.question, () => {
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
        this.voiceService.speak(`Answer is, ${item.answer}`, () => {
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
      this.processAnswer(heard.toLowerCase());
    });
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    this.processAnswer(this.selectedOption);
  }

  processAnswer(userAnswer: string) {
    this.isShowingFeedback = true;
    this.cdr.detectChanges();

    const currentQ = this.tfSet.questions[this.currentIndex];
    const answer = currentQ.answer.toLowerCase();
    const spoken = userAnswer.toLowerCase();

    const similarity = this.utilityService.similarity(answer, spoken);
    const isCorrect = similarity >= 0.8;

    this.history.push({
      question: currentQ.question,
      userAnswer: userAnswer,
      isCorrect: isCorrect,
      answer: currentQ.answer
    });

    const feedback = `Answer is, ${currentQ.answer}`;
    this.isSpeaking = true;
    this.cdr.detectChanges();
    this.voiceService.speak(feedback, () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
      this.nextQuestion();
    });
  }

  nextQuestion() {
    this.currentIndex++;
    this.selectedOption = '';
    this.isShowingFeedback = false;
    this.cdr.detectChanges();
    if (this.currentIndex < this.tfSet.questions.length) {
      this.readCurrentQuestion();
    } else {
      this.stopTimer();
    }
  }

  navigateToNextPage() {
    const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);
    const path = this.route.snapshot.queryParams['path'];
    let scoreUpdate: IScoreUpdate = { truefalse_score: score }
    this.tfService.updateScores(path, scoreUpdate).subscribe(
      () => {
        this.router.navigate([this.nextPage], { queryParams: { path } });
      },
      err => {
        console.error('unable to update truefalse score', err);
        this.router.navigate(['/']);
      }
    );
  }
}