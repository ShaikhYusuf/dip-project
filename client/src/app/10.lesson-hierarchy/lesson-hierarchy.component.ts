import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationStart, RouterModule } from '@angular/router';

import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';

import { Router } from '@angular/router';
import { ILessonHierarchy } from '../app.model';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';


@Component({
  selector: 'app-lesson-hierarchy',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatExpansionModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule
  ],
  templateUrl: './lesson-hierarchy.component.html',
  styleUrls: ['./lesson-hierarchy.component.css']
})
export class LessonHierarchyComponent implements OnInit {

  hierarchy: ILessonHierarchy[] = [];
  topics: ILessonHierarchy[] = [];
  lessons: ILessonHierarchy[] = [];

  constructor(
    private router: Router,
    private voiceService: VoiceService,
    private getDataService: AppDataService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.voiceService.stopSpeaking();
      }
    });
  }

  ngOnInit(): void {
    this.loadHierarchy();
  }

  loadHierarchy() {
    this.getDataService.getLessonHierarchy().subscribe((data: ILessonHierarchy[]) => {
        this.hierarchy = data;
        this.topics = data.filter(x => x.parent_path === null);
        this.lessons = data.filter(x => x.parent_path !== null);
      });
  }

  getLessons(topicPath: string) {
    return this.lessons.filter(l => l.parent_path === topicPath);
  }

  openLesson(path: string) {
    this.router.navigate(['/lesson-content'], {
      queryParams: { path: path, next: "/lesson-quiz" }
    });
  }

  openRoute(path: string, currentRoute: string) {
    this.router.navigate([currentRoute], {
      queryParams: { path: path, next: "/lesson-hierarchy" }
    });
  }

}