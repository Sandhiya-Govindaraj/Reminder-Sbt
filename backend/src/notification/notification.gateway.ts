import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

interface NotificationPayload {
  type: string;
  taskId: string;
  title: string;
  message: string;
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Store socket mapping
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user-${userId}`);
      client.data.userId = userId;

      this.logger.log(`Client ${client.id} connected (user: ${userId})`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('task-update')
  handleTaskUpdate(client: Socket, payload: { taskId: string; status: string }) {
    const userId = client.data?.userId;
    if (userId) {
      this.server.to(`user-${userId}`).emit('task-updated', payload);
    }
  }

  sendNotification(userId: string, payload: NotificationPayload) {
    this.server.to(`user-${userId}`).emit('notification', payload);
    this.logger.log(`Notification sent to user ${userId}: ${payload.type}`);
  }

  sendTaskUpdate(userId: string, task: Record<string, unknown>) {
    this.server.to(`user-${userId}`).emit('task-updated', task);
  }
}
