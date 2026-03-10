// lesson-truefalse.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { IScoreUpdate, ITrueFalseSet } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-truefalse',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, MatRadioModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-truefalse.component.html',
  styleUrls: ['./lesson-truefalse.component.css']
})
export class LessonTrueFalseComponent implements OnInit {
  tfSet!: ITrueFalseSet;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, userAnswer: string, isCorrect: boolean }[] = [];
  isShowingFeedback = false;
  nextPage: string = '/lesson-shortquestion';

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
      }
    });
    }

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-shortquestion';
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

  submitAnswerVoice() {
    this.voiceService.listen((heard) => {
      const spoken = heard.toLowerCase();
      this.processAnswer(spoken);
    });
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    const currentQ = this.tfSet.questions[this.currentIndex];
    this.processAnswer(this.selectedOption);
  }

  processAnswer(userAnswer: string) {
    this.isShowingFeedback = true; // Block the current card from showing inputs
    this.cdr.detectChanges();

    const currentQ = this.tfSet.questions[this.currentIndex];
    const answer = currentQ.answer.toLowerCase();
    const spoken = userAnswer.toLowerCase();

    const similarity = this.utilityService.similarity(answer, spoken);
    const isCorrect = similarity >= 0.8;

    this.history.push({
      question: currentQ.question,
      userAnswer: userAnswer,
      isCorrect: isCorrect
    });

    const feedback = `Answer is, ${currentQ.answer}`;
    this.voiceService.speak(feedback, () => this.nextQuestion());
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
    // count how many answers in the history were marked correct
    const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);

    // send the score back to the data service before navigating away
    // (adjust the method/parameters to whatever your AppDataService exposes)
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