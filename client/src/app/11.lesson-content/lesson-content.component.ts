// lesson-content.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationStart, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { ILessonContent } from '../app.model';


@Component({
  selector: 'app-lesson-content',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './lesson-content.component.html',
  styleUrls: ['./lesson-content.component.css']
})
export class LessonContentComponent implements OnInit, OnDestroy {
  content!: ILessonContent;
  nextPage: string = '/lesson-quiz';
  isSpeaking = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private getDataService: AppDataService,
    private voiceService: VoiceService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.voiceService.stopSpeaking();
        this.isSpeaking = false;
      }
    });
  }

  ngOnInit() {
    const path = this.route.snapshot.queryParams['path'];
    this.nextPage = this.route.snapshot.queryParams['next'] || '/lesson-quiz';

    // Save progress for resume feature
    if (path) {
      localStorage.setItem('lastVisitedPath', path);
    }

    this.getDataService.getLessonContent(path).subscribe((data: ILessonContent) => {
      this.content = data;
      this.readContent(); // Keep auto-play per user request
    });
  }

  ngOnDestroy() {
    this.voiceService.stopSpeaking();
    this.isSpeaking = false;
  }

  readContent() {
    if (!this.content) return;
    this.isSpeaking = true;
    this.voiceService.speak(this.content.explanation, () => {
      this.voiceService.speak(this.content.examples.join('\n'), () => {
        this.isSpeaking = false;
      });
    });
  }

  stopSpeaking() {
    this.voiceService.stopSpeaking();
    this.isSpeaking = false;
  }

  replaySpeaking() {
    this.voiceService.stopSpeaking();
    this.readContent();
  }

  navigateToNextPage() {
    const path = this.route.snapshot.queryParams['path'];
    this.router.navigate([this.nextPage], { queryParams: { path } });
  }
}