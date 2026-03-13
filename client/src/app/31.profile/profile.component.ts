import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AppDataService, IUserProfile } from '../app-data.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  profile: IUserProfile | null = null;
  editName = '';
  editAvatar = '';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  message = '';
  messageType: 'success' | 'error' = 'success';
  loading = false;
  showPasswordForm = false;

  constructor(private dataService: AppDataService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.loading = true;
    this.dataService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.editName = profile.name;
        this.editAvatar = profile.avatar_url || '';
        this.loading = false;
      },
      error: (err) => {
        this.message = err.message;
        this.messageType = 'error';
        this.loading = false;
      },
    });
  }

  saveProfile() {
    if (!this.editName.trim()) {
      this.showMsg('Name cannot be empty', 'error');
      return;
    }
    this.dataService.updateProfile({
      name: this.editName.trim(),
      avatar_url: this.editAvatar.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.profile = updated;
        this.showMsg('Profile updated successfully!', 'success');
      },
      error: (err) => this.showMsg(err.message, 'error'),
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.showMsg('Passwords do not match', 'error');
      return;
    }
    if (this.newPassword.length < 6) {
      this.showMsg('Password must be at least 6 characters', 'error');
      return;
    }
    this.dataService.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: () => {
        this.showMsg('Password changed successfully!', 'success');
        this.oldPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showPasswordForm = false;
      },
      error: (err) => this.showMsg(err.message, 'error'),
    });
  }

  showMsg(msg: string, type: 'success' | 'error') {
    this.message = msg;
    this.messageType = type;
    setTimeout(() => { this.message = ''; }, 5000);
  }

  getInitials(): string {
    if (!this.profile) return '?';
    return this.profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}
