// lesson-content.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { GetDataService } from '../get-data.service';
import { VoiceService } from '../voice.service';

@Component({
  selector: 'app-lesson-content',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './lesson-content.component.html'
})
export class LessonContentComponent implements OnInit {
  content: any;
  voice: SpeechSynthesisVoice | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private getDataService: GetDataService,
    private voiceService: VoiceService
  ) {}

  ngOnInit() {
    this.voiceService.selectedVoice$.subscribe(v => this.voice = v);
    const path = this.route.snapshot.queryParams['path'];
    this.getDataService.getLessonContent(path).subscribe(data => {
      this.content = data;
      this.readContent();
    });
  }

  readContent() {
    if (!this.voice || !this.content) return;
    const exp = new SpeechSynthesisUtterance(this.content.explanation);
    const ex = new SpeechSynthesisUtterance(this.content.example);
    exp.voice = this.voice;
    ex.voice = this.voice;
    exp.onend = () => window.speechSynthesis.speak(ex);
    window.speechSynthesis.speak(exp);
  }

  navigateToQuiz() {
  const path = this.route.snapshot.queryParams['path'];
  this.router.navigate(['/lesson-quiz'], { queryParams: { path } });
}
}