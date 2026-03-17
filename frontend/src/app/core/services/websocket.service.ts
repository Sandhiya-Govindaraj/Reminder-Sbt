import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Notification } from '../../shared/models/task.model';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;

  private notificationSubject = new Subject<Notification>();
  private taskUpdateSubject = new Subject<Record<string, unknown>>();

  notification$ = this.notificationSubject.asObservable();
  taskUpdate$ = this.taskUpdateSubject.asObservable();

  constructor(private authService: AuthService) {}

  connect(): void {
    const token = this.authService.currentToken;
    if (!token || this.socket?.connected) return;

    this.socket = io(environment.wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('notification', (data: Notification) => {
      this.notificationSubject.next(data);
    });

    this.socket.on('task-updated', (data: Record<string, unknown>) => {
      this.taskUpdateSubject.next(data);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
