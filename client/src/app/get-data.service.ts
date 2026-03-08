import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ILessonContent, IQuizSet, IShortQuestionSet, ITrueFalseSet } from './app.model';

@Injectable({
  providedIn: 'root'
})
export class GetDataService {

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
}
