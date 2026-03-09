// lesson-content.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { AppDataService } from '../app-data.service';
import { VoiceService } from '../voice.service';
import { ILessonContent } from '../app.model';

@Component({
  selector: 'app-lesson-content',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './lesson-content.component.html'
})
export class LessonContentComponent implements OnInit {
  voice: SpeechSynthesisVoice | null = null;
  content!: ILessonContent ;
  

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private getDataService: AppDataService,
    private voiceService: VoiceService
  ) {}

  ngOnInit() {
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    const path = this.route.snapshot.queryParams['path'];
    this.getDataService.getLessonContent(path).subscribe((data: ILessonContent) => {
      this.content = data;
      this.readContent();
    });
  }

  readContent() {
    if (!this.voice || !this.content) return;
    this.voiceService.speak(this.content.explanation, () => {
      this.voiceService.speak(this.content.examples.join('\n'));
    })
  }

  navigateToNextPage() {
    const path = this.route.snapshot.queryParams['path'];
    this.router.navigate(['/lesson-quiz'], { queryParams: { path } });
  }
}