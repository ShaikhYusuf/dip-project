import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AppDataService, IUserProfile } from '../app-data.service';
import { ILessonHierarchy } from '../app.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, MatChipsModule,
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  activeTab: 'users' | 'lessons' = 'users';
  users: IUserProfile[] = [];
  lessons: ILessonHierarchy[] = [];
  loading = false;
  message = '';

  constructor(private dataService: AppDataService) {}

  ngOnInit() {
    this.loadUsers();
  }

  switchTab(tab: 'users' | 'lessons') {
    this.activeTab = tab;
    this.message = '';
    if (tab === 'users') this.loadUsers();
    else this.loadLessons();
  }

  // ── Users ──
  loadUsers() {
    this.loading = true;
    this.dataService.adminListUsers().subscribe({
      next: (users) => { this.users = users; this.loading = false; },
      error: (err) => { this.message = err.message; this.loading = false; },
    });
  }

  updateRole(user: IUserProfile, role: string) {
    this.dataService.adminUpdateRole(user.id, role).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx >= 0) this.users[idx] = updated;
        this.message = `Role updated for ${updated.name}`;
      },
      error: (err) => { this.message = err.message; },
    });
  }

  deleteUser(user: IUserProfile) {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;
    this.dataService.adminDeleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.message = `User ${user.name} deleted`;
      },
      error: (err) => { this.message = err.message; },
    });
  }

  // ── Lessons ──
  loadLessons() {
    this.loading = true;
    this.dataService.adminListLessons().subscribe({
      next: (data) => { this.lessons = data; this.loading = false; },
      error: (err) => { this.message = err.message; this.loading = false; },
    });
  }

  resetScores(sectionPath: string) {
    if (!confirm(`Reset all scores for ${sectionPath}?`)) return;
    this.dataService.adminResetScores(sectionPath).subscribe({
      next: () => { this.message = `Scores reset for ${sectionPath}`; this.loadLessons(); },
      error: (err) => { this.message = err.message; },
    });
  }

  getTopics() { return this.lessons.filter(l => !l.parent_path); }
  getLessonsForTopic(topicPath: string) { return this.lessons.filter(l => l.parent_path === topicPath); }
}
