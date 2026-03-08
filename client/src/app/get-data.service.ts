import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GetDataService {

  private readonly baseUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  getLessonContent(path: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/lesson`, { params: { path } });
  }

  getLessonQuiz(path: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/quizzes`, { params: { path } });
  }

  getLessonTrueFalse(path: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/truefalses`, { params: { path } });
  }

  getLessonShortQuestions(path: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/shortquestions`, { params: { path } });
  }
}
