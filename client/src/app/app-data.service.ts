import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ILessonContent, ILessonHierarchy, IQuizSet, IScoreUpdate, IShortQuestionSet, ITrueFalseSet } from './app.model';

@Injectable({
  providedIn: 'root'
})
export class AppDataService {

  private readonly baseUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  getLessonContent(path: string): Observable<ILessonContent> {
    return this.http.get<ILessonContent>(`${this.baseUrl}/lesson`, { params: { path } });
  }

  getLessonQuiz(path: string): Observable<IQuizSet> {
    return this.http.get<IQuizSet>(`${this.baseUrl}/quizzes`, { params: { path } });
  }

  getLessonTrueFalse(path: string): Observable<ITrueFalseSet> {
    return this.http.get<ITrueFalseSet>(`${this.baseUrl}/truefalses`, { params: { path } });
  }

  getLessonShortQuestions(path: string): Observable<IShortQuestionSet> {
    return this.http.get<IShortQuestionSet>(`${this.baseUrl}/shortquestions`, { params: { path } });
  }

  compareTextToEmbedding(text: string, embedding: number[]): Observable<{ match: boolean }> {
    return this.http.post<{ match: boolean }>(`${this.baseUrl}/compare_text_to_embedding`, {
      text,
      embedding
    });
  }

  getLessonHierarchy(): Observable<ILessonHierarchy[]> {
    return this.http.get<ILessonHierarchy[]>(`${this.baseUrl}//lesson_hierarchy`);
  }

  updateScores(path: string, scores: Partial<IScoreUpdate>): Observable<{ message: string; updated: Record<string, string> }> {
    return this.http.post<{ message: string; updated: Record<string, string> }>(
      `${this.baseUrl}/update_scores`,
      { path, ...scores }
    );
  }
}
