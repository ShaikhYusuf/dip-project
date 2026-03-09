// app.routes.ts
import { Routes } from '@angular/router';
import { AppComponent } from './app.component';
import { VoiceSelectionComponent } from './voice-selection/voice-selection.component';

export const routes: Routes = [
  { path: '', component: VoiceSelectionComponent },
  { 
    path: 'lesson-content', 
    loadComponent: () => import('./lesson-content/lesson-content.component')
      .then(m => m.LessonContentComponent) 
  },
  { 
    path: 'lesson-quiz', 
    loadComponent: () => import('./lesson-quiz/lesson-quiz.component')
      .then(m => m.LessonQuizComponent) 
  },
  { 
    path: 'lesson-truefalse', 
    loadComponent: () => import('./lesson-truefalse/lesson-truefalse.component')
      .then(m => m.LessonTrueFalseComponent) 
  }
  ,
  { 
    path: 'lesson-shortquestion', 
    loadComponent: () => import('./lesson-shortquestion/lesson-shortquestion.component')
      .then(m => m.LessonShortQuestionComponent) 
  },
  { 
    path: 'lesson-hierarchy',
    loadComponent: () => import('./lesson-hierarchy/lesson-hierarchy.component')
      .then(m => m.LessonHierarchyComponent) 
  } 
];