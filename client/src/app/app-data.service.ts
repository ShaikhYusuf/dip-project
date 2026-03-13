import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, catchError, throwError } from 'rxjs';
import { ILessonContent, ILessonHierarchy, IQuizSet, IScoreUpdate, IShortQuestionSet, ITrueFalseSet } from './app.model';

/** Standard API response envelope returned by the Flask backend. */
interface ApiResponse<T> {
  status: string;
  data: T;
  message: string;
}

export interface IUserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export interface IAnalyticsSummary {
  total_sections: number;
  completed_sections: number;
  progress_percent: number;
  scores: {
    quiz: { total: number; average: number };
    truefalse: { total: number; average: number };
    shortquestion: { total: number; average: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class AppDataService {

  private readonly baseUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) { }

  // ── Error handler ──
  private handleError(error: any) {
    let message = 'An unexpected error occurred';
    if (error?.error?.message) {
      message = error.error.message;
    } else if (error?.message) {
      message = error.message;
    }
    console.error('API Error:', message, error);
    return throwError(() => new Error(message));
  }

  // ════════════ Lesson APIs ════════════
  getLessonContent(path: string): Observable<ILessonContent> {
    return this.http.get<ApiResponse<ILessonContent>>(`${this.baseUrl}/api/lessons/content`, { params: { path } })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  getLessonQuiz(path: string): Observable<IQuizSet> {
    return this.http.get<ApiResponse<IQuizSet>>(`${this.baseUrl}/api/lessons/quizzes`, { params: { path } })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  getLessonTrueFalse(path: string): Observable<ITrueFalseSet> {
    return this.http.get<ApiResponse<ITrueFalseSet>>(`${this.baseUrl}/api/lessons/truefalse`, { params: { path } })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  getLessonShortQuestions(path: string): Observable<IShortQuestionSet> {
    return this.http.get<ApiResponse<IShortQuestionSet>>(`${this.baseUrl}/api/lessons/shortquestions`, { params: { path } })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  compareTextToEmbedding(text: string, embedding: number[]): Observable<{ match: boolean }> {
    return this.http.post<ApiResponse<{ match: boolean }>>(`${this.baseUrl}/api/lessons/compare`, {
      text,
      embedding
    }).pipe(map(res => res.data), catchError(this.handleError));
  }

  getLessonHierarchy(): Observable<ILessonHierarchy[]> {
    return this.http.get<ApiResponse<ILessonHierarchy[]>>(`${this.baseUrl}/api/lessons/hierarchy`)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  updateScores(path: string, scores: Partial<IScoreUpdate>): Observable<{ message: string; updated: Record<string, string> }> {
    return this.http.post<ApiResponse<{ updated: Record<string, string> }>>(
      `${this.baseUrl}/api/lessons/scores`,
      { path, ...scores }
    ).pipe(map(res => ({ message: res.message, updated: res.data.updated })), catchError(this.handleError));
  }

  // ════════════ Profile APIs ════════════
  getProfile(): Observable<IUserProfile> {
    return this.http.get<ApiResponse<IUserProfile>>(`${this.baseUrl}/api/profile`)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  updateProfile(data: { name?: string; avatar_url?: string }): Observable<IUserProfile> {
    return this.http.put<ApiResponse<IUserProfile>>(`${this.baseUrl}/api/profile`, data)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/api/profile/password`, {
      old_password: oldPassword,
      new_password: newPassword,
    }).pipe(map(res => res), catchError(this.handleError));
  }

  // ════════════ Analytics APIs ════════════
  getAnalyticsSummary(): Observable<IAnalyticsSummary> {
    return this.http.get<ApiResponse<IAnalyticsSummary>>(`${this.baseUrl}/api/analytics/summary`)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  // ════════════ Admin APIs ════════════
  adminListUsers(): Observable<IUserProfile[]> {
    return this.http.get<ApiResponse<IUserProfile[]>>(`${this.baseUrl}/api/admin/users`)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  adminDeleteUser(userId: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/api/admin/users/${userId}`)
      .pipe(map(res => res), catchError(this.handleError));
  }

  adminUpdateRole(userId: number, role: string): Observable<IUserProfile> {
    return this.http.put<ApiResponse<IUserProfile>>(`${this.baseUrl}/api/admin/users/${userId}/role`, { role })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  adminListLessons(): Observable<ILessonHierarchy[]> {
    return this.http.get<ApiResponse<ILessonHierarchy[]>>(`${this.baseUrl}/api/admin/lessons`)
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  adminUpdateSection(sectionPath: string, content: string): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/api/admin/sections/${sectionPath}`, { content })
      .pipe(map(res => res), catchError(this.handleError));
  }

  adminResetScores(sectionPath: string): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/api/admin/scores/reset/${sectionPath}`, {})
      .pipe(map(res => res), catchError(this.handleError));
  }
}
