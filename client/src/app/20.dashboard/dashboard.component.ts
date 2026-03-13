import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Chart, registerables } from 'chart.js';
import { AppDataService } from '../app-data.service';
import { ILessonHierarchy } from '../app.model';

Chart.register(...registerables);

interface TopicSummary {
    path: string;
    title: string;
    totalSections: number;
    completedSections: number;
    progressPercent: number;
    avgQuiz: number;
    avgTrueFalse: number;
    avgShortQ: number;
    lessons: LessonSummary[];
}

interface LessonSummary {
    path: string;
    title: string;
    sections: { path: string; quiz: number; tf: number; sq: number }[];
    avgScore: number;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressBarModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
    topics: TopicSummary[] = [];
    overallProgress = 0;
    totalSections = 0;
    completedSections = 0;
    recentSections: { path: string; score: number }[] = [];
    lastVisitedPath: string | null = null;
    greeting = '';
    chartsReady = false;

    @ViewChild('progressChart') progressChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('scoreChart') scoreChartRef!: ElementRef<HTMLCanvasElement>;

    private progressChartInstance: Chart | null = null;
    private scoreChartInstance: Chart | null = null;

    constructor(
        private router: Router,
        private dataService: AppDataService
    ) { }

    ngOnInit(): void {
        this.greeting = this.getGreeting();
        this.lastVisitedPath = localStorage.getItem('lastVisitedPath');

        this.dataService.getLessonHierarchy().subscribe((hierarchy: ILessonHierarchy[]) => {
            this.buildDashboard(hierarchy);
            this.chartsReady = true;
            // Charts need the canvas to be in the DOM, so render after a tick
            setTimeout(() => this.renderCharts(), 100);
        });
    }

    ngAfterViewInit(): void {
        // Charts will be rendered after data loads
    }

    private getGreeting(): string {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }

    getProgressColor(percent: number): string {
        if (percent >= 100) return 'green';
        if (percent >= 31) return 'yellow';
        return 'red';
    }

    getProgressBarClass(percent: number): string {
        if (percent >= 100) return 'progress-bar-green';
        if (percent >= 31) return 'progress-bar-yellow';
        return 'progress-bar-red';
    }

    isCompleted(percent: number): boolean {
        return percent >= 100;
    }

    private buildDashboard(hierarchy: ILessonHierarchy[]) {
        const topicItems = hierarchy.filter(h => h.parent_path === null);
        const lessonItems = hierarchy.filter(h => h.parent_path !== null);

        this.topics = topicItems.map(topic => {
            const lessons: LessonSummary[] = lessonItems
                .filter(l => l.parent_path === topic.path)
                .map(lesson => {
                    const sections = lesson.sections.map(s => ({
                        path: s.path,
                        quiz: s.quiz_score,
                        tf: s.truefalse_score,
                        sq: s.shortquestion_score,
                    }));
                    const total = sections.reduce((sum, s) => sum + s.quiz + s.tf + s.sq, 0);
                    const maxPossible = sections.length * 15;
                    return {
                        path: lesson.path,
                        title: lesson.title,
                        sections,
                        avgScore: maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0,
                    };
                });

            const allSections = lessons.flatMap(l => l.sections);
            const totalSec = allSections.length;
            const completedSec = allSections.filter(
                s => s.quiz > 0 || s.tf > 0 || s.sq > 0
            ).length;

            const totalQuiz = allSections.reduce((s, sec) => s + sec.quiz, 0);
            const totalTf = allSections.reduce((s, sec) => s + sec.tf, 0);
            const totalSq = allSections.reduce((s, sec) => s + sec.sq, 0);

            return {
                path: topic.path,
                title: topic.title,
                totalSections: totalSec,
                completedSections: completedSec,
                progressPercent: totalSec > 0 ? Math.round((completedSec / totalSec) * 100) : 0,
                avgQuiz: totalSec > 0 ? Math.round(totalQuiz / totalSec) : 0,
                avgTrueFalse: totalSec > 0 ? Math.round(totalTf / totalSec) : 0,
                avgShortQ: totalSec > 0 ? Math.round(totalSq / totalSec) : 0,
                lessons,
            } as TopicSummary;
        });

        this.totalSections = this.topics.reduce((s, t) => s + t.totalSections, 0);
        this.completedSections = this.topics.reduce((s, t) => s + t.completedSections, 0);
        this.overallProgress = this.totalSections > 0
            ? Math.round((this.completedSections / this.totalSections) * 100)
            : 0;

        const allSec = this.topics.flatMap(t => t.lessons.flatMap(l => l.sections));
        this.recentSections = allSec
            .filter(s => s.quiz > 0 || s.tf > 0 || s.sq > 0)
            .map(s => ({ path: s.path, score: s.quiz + s.tf + s.sq }))
            .slice(0, 5);
    }

    private renderCharts() {
        this.renderProgressChart();
        this.renderScoreChart();
    }

    private renderProgressChart() {
        if (!this.progressChartRef) return;
        const ctx = this.progressChartRef.nativeElement.getContext('2d');
        if (!ctx) return;

        if (this.progressChartInstance) {
            this.progressChartInstance.destroy();
        }

        const completed = this.completedSections;
        const remaining = this.totalSections - completed;
        const isDark = document.body.classList.contains('dark-theme');

        this.progressChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{
                    data: [completed, remaining],
                    backgroundColor: [
                        '#10b981',
                        isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                    ],
                    borderWidth: 0,
                    borderRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        titleColor: isDark ? '#f1f5f9' : '#1e293b',
                        bodyColor: isDark ? '#94a3b8' : '#64748b',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 12,
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1200,
                }
            }
        });
    }

    private renderScoreChart() {
        if (!this.scoreChartRef) return;
        const ctx = this.scoreChartRef.nativeElement.getContext('2d');
        if (!ctx) return;

        if (this.scoreChartInstance) {
            this.scoreChartInstance.destroy();
        }

        const isDark = document.body.classList.contains('dark-theme');
        const labels = this.topics.map(t => t.title);
        const quizData = this.topics.map(t => t.avgQuiz);
        const tfData = this.topics.map(t => t.avgTrueFalse);
        const sqData = this.topics.map(t => t.avgShortQ);

        this.scoreChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Quiz',
                        data: quizData,
                        backgroundColor: 'rgba(99, 102, 241, 0.7)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'True/False',
                        data: tfData,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: 'Short Q',
                        data: sqData,
                        backgroundColor: 'rgba(245, 158, 11, 0.7)',
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: isDark ? '#94a3b8' : '#64748b',
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 12,
                            font: { family: 'Inter', size: 12, weight: 600 as const }
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        titleColor: isDark ? '#f1f5f9' : '#1e293b',
                        bodyColor: isDark ? '#94a3b8' : '#64748b',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 12,
                    }
                },
                scales: {
                    x: {
                        ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Inter' } },
                        grid: { display: false },
                    },
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: { color: isDark ? '#94a3b8' : '#64748b', stepSize: 1, font: { family: 'Inter' } },
                        grid: { color: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.6)' },
                    }
                },
                animation: {
                    duration: 1000,
                }
            }
        });
    }

    openTopics() {
        this.router.navigate(['/lesson-hierarchy']);
    }

    openLesson(sectionPath: string) {
        this.router.navigate(['/lesson-content'], {
            queryParams: { path: sectionPath, next: '/lesson-quiz' },
        });
    }

    resumeLastLesson() {
        if (this.lastVisitedPath) {
            this.router.navigate(['/lesson-content'], {
                queryParams: { path: this.lastVisitedPath, next: '/lesson-quiz' },
            });
        }
    }
}
