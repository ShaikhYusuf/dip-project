// app.routes.ts
import { Routes } from '@angular/router';
import { LessonHierarchyComponent } from './10.lesson-hierarchy/lesson-hierarchy.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./20.dashboard/dashboard.component')
      .then(m => m.DashboardComponent)
  },
  { path: 'lesson-hierarchy', component: LessonHierarchyComponent },
  {
    path: 'settings',
    loadComponent: () => import('./01.voice-selection/voice-selection.component')
      .then(m => m.VoiceSelectionComponent)
  },
  {
    path: 'lesson-content',
    loadComponent: () => import('./11.lesson-content/lesson-content.component')
      .then(m => m.LessonContentComponent)
  },
  {
    path: 'lesson-quiz',
    loadComponent: () => import('./12.lesson-quiz/lesson-quiz.component')
      .then(m => m.LessonQuizComponent)
  },
  {
    path: 'lesson-truefalse',
    loadComponent: () => import('./13.lesson-truefalse/lesson-truefalse.component')
      .then(m => m.LessonTrueFalseComponent)
  },
  {
    path: 'lesson-shortquestion',
    loadComponent: () => import('./14.lesson-shortquestion/lesson-shortquestion.component')
      .then(m => m.LessonShortQuestionComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./30.admin/admin.component')
      .then(m => m.AdminComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./31.profile/profile.component')
      .then(m => m.ProfileComponent)
  },
];