// lesson-quiz.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule} from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { IQuizSet, IScoreUpdate } from '../app.model';
import { AppUtilityService } from '../app.utility.service';


@Component({
  selector: 'app-lesson-quiz',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, MatRadioModule, MatButtonModule, MatCardModule],
  templateUrl: './lesson-quiz.component.html',
  styleUrls: ['./lesson-quiz.component.css']
})
export class LessonQuizComponent implements OnInit {
  voice: SpeechSynthesisVoice | null = null;
  quizSet!: IQuizSet ;
  currentIndex = 0;
  selectedOption: string = '';
  history: { question: string, answer: string, userAnswer: string, isCorrect: boolean }[] = [];
  isShowingFeedback = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private quizService: AppDataService, 
    private utilityService: AppUtilityService,
    private voiceService: VoiceService,
    private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    this.quizService.getLessonQuiz(path).subscribe((data: IQuizSet) => {
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
    if (!this.quizSet) return;
    this.voiceService.speak(this.formatQuestionForSpeech());
  }

  readExplanation(isRight: boolean = true) {
    if (!this.voice || !this.quizSet) return;
    const text = isRight 
      ? `That is correct. ${this.quizSet.questions[this.currentIndex].explanation}`
      : `That is incorrect. ${this.quizSet.questions[this.currentIndex].explanation}`;
    this.voiceService.speak(text, () => this.nextQuestion());
  }

  submitAnswerVoice() {
    this.voiceService.listen((heard) => {
      this.processAnswer(heard);
    });
  }

  submitAnswer() {
    window.speechSynthesis.cancel();
    const currentQ = this.quizSet.questions[this.currentIndex];
    this.processAnswer(this.selectedOption);
  }

  processAnswer(userAnswer: string) {

    const currentQ = this.quizSet.questions[this.currentIndex];
    const answer = currentQ.answer.toLowerCase();
    const spoken = userAnswer.toLowerCase();

    //const similarity = this.utilityService.similarity(answer, spoken);
    this.quizService.compareTextToEmbedding(spoken, currentQ.answer_embedding!).subscribe(response => { 
      const isCorrect = response.match;

    this.isShowingFeedback = true; // Block the current card from showing inputs
    this.cdr.detectChanges();

    this.history.push({
          question: currentQ.question,
          answer: currentQ.answer,
          userAnswer: userAnswer,
          isCorrect: isCorrect
        });

      this.readExplanation(isCorrect);
    })
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


    navigateToNextPage() {
      // count how many answers in the history were marked correct
      const score = this.history.reduce((sum, h) => sum + (h.isCorrect ? 1 : 0), 0);

      // send the score back to the data service before navigating away
      // (adjust the method/parameters to whatever your AppDataService exposes)
      const path = this.route.snapshot.queryParams['path'];
      let scoreUpdate: IScoreUpdate = { quiz_score: score }
      this.quizService.updateScores(path, scoreUpdate).subscribe(
        () => {
          this.router.navigate(['/lesson-truefalse'], { queryParams: { path } });
        },
        err => {
          console.error('unable to update quiz score', err);
            this.router.navigate(['/']);
        }
      );
    }
}