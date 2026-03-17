import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskService } from '../../core/services/task.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthService } from '../../core/services/auth.service';
import { Task, TaskStatus, Notification } from '../../shared/models/task.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  activeTab: TaskStatus = 'PENDING';
  loading = true;
  notifications: Notification[] = [];
  showNotification = false;
  currentNotification: Notification | null = null;

  private subscriptions = new Subscription();

  constructor(
    private taskService: TaskService,
    private wsService: WebSocketService,
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTasks();
    this.setupWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  get filteredTasks(): Task[] {
    return this.tasks.filter((t) => t.status === this.activeTab);
  }

  get userName(): string {
    const user = this.authService.currentUser;
    return user?.name || user?.email || user?.phone || 'User';
  }

  setTab(tab: TaskStatus): void {
    this.activeTab = tab;
  }

  loadTasks(): void {
    this.loading = true;
    this.taskService.findAll().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  markComplete(task: Task): void {
    this.taskService.updateStatus(task.id, 'COMPLETED').subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((t) => t.id === updated.id);
        if (idx !== -1) this.tasks[idx] = updated;
      },
    });
  }

  deleteTask(task: Task): void {
    if (!confirm('Are you sure you want to delete this task?')) return;
    this.taskService.delete(task.id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((t) => t.id !== task.id);
      },
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/tasks/create']);
  }

  dismissNotification(): void {
    this.showNotification = false;
    this.currentNotification = null;
  }

  logout(): void {
    this.authService.logout();
    this.wsService.disconnect();
    this.router.navigate(['/login']);
  }

  getStatusClass(status: TaskStatus): string {
    switch (status) {
      case 'PENDING': return 'status-pending';
      case 'COMPLETED': return 'status-completed';
      case 'MISSED': return 'status-missed';
      default: return '';
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  private setupWebSocket(): void {
    this.wsService.connect();

    this.subscriptions.add(
      this.wsService.notification$.subscribe((notification) => {
        this.notifications.unshift(notification);
        this.currentNotification = notification;
        this.showNotification = true;

        setTimeout(() => {
          if (this.currentNotification === notification) {
            this.showNotification = false;
          }
        }, 5000);

        this.loadTasks();
      }),
    );

    this.subscriptions.add(
      this.wsService.taskUpdate$.subscribe(() => {
        this.loadTasks();
      }),
    );
  }
}
