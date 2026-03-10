// lesson-content.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { ILessonContent } from '../app.model';


@Component({
  selector: 'app-lesson-content',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './lesson-content.component.html'
})
export class LessonContentComponent implements OnInit {
  content!: ILessonContent ;
  nextPage: string = '/lesson-quiz';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private getDataService: AppDataService,
    private voiceService: VoiceService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.voiceService.stopSpeaking();
      }
    });
  }

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-quiz';
    this.getDataService.getLessonContent(path).subscribe((data: ILessonContent) => {
      this.content = data;
      this.readContent();
    });
  }

  readContent() {
    if ( !this.content) return;
    this.voiceService.speak(this.content.explanation, () => {
      this.voiceService.speak(this.content.examples.join('\n'));
    })
  }

  navigateToNextPage() {
    const path = this.route.snapshot.queryParams['path'];
    this.router.navigate([this.nextPage], { queryParams: { path } });
  }
}