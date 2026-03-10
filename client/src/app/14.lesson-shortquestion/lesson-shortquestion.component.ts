// lesson-shortquestion.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { IScoreUpdate, IShortQuestionSet } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-shortquestion',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, MatInputModule, MatButtonModule, MatCardModule, MatFormFieldModule],
  templateUrl: './lesson-shortquestion.component.html',
  styleUrls: ['./lesson-shortquestion.component.css']
})
export class LessonShortQuestionComponent implements OnInit {
  sqSet!: IShortQuestionSet;
  currentIndex = 0;
  userAnswer: string = '';
  history: { question: string, answer: string, userAnswer: string , isCorrect: boolean}[] = [];
  isShowingFeedback = false;
  nextPage: string = '/lesson-hierarchy';

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
      }
    });
    }

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-hierarchy';
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

  submitAnswerVoice() {
    this.voiceService.listen((heard) => {
      this.processAnswer(heard);
    });
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    const currentQ = this.sqSet.questions[this.currentIndex];
    this.processAnswer(this.userAnswer);
  }

  processAnswer(userAnswer: string) {

    const currentQ = this.sqSet.questions[this.currentIndex];
    const answer = currentQ.answer;
    const spoken = userAnswer;

    //const similarity = this.utilityService.similarity(answer, spoken);
    this.sqService.compareTextToEmbedding(spoken, currentQ.answer_embedding!).subscribe(response => { 
      const isCorrect = response.match;
      this.isShowingFeedback = true; // Block the current card from showing inputs
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
        this.voiceService.speak(feedback, ()=> this.nextQuestion());
      });
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

  navigateToNextPage() {
      // count how many answers in the history were marked correct
      const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);
  
      // send the score back to the data service before navigating away
      // (adjust the method/parameters to whatever your AppDataService exposes)
      const path = this.route.snapshot.queryParams['path'];
      let scoreUpdate: IScoreUpdate = { truefalse_score: score }
      this.sqService.updateScores(path, scoreUpdate).subscribe(
        () => {
          this.router.navigate([this.nextPage], { queryParams: { path } });
        },
        err => {
          console.error('unable to update truefalse score', err);
          this.router.navigate([this.nextPage], { queryParams: { path } });
        }
      );
    }
}