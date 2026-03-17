import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { ReminderService, REMINDER_QUEUE } from './reminder.service';
import { TaskStatus, RepeatType } from '@prisma/client';

interface ReminderJobData {
  taskId: string;
  creatorId: string;
  title: string;
  snoozeInterval?: number;
  snoozeMaxRetries?: number;
  snoozeCount: number;
  isSnoozed?: boolean;
}

interface RepeatJobData {
  taskId: string;
  creatorId: string;
  title: string;
  repeatType: RepeatType;
  repeatInterval?: number;
  repeatEndDate?: string;
  snoozeInterval?: number;
  snoozeMaxRetries?: number;
}

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly reminderService: ReminderService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData | RepeatJobData>) {
    this.logger.log(`Processing job ${job.name} for task ${job.data.taskId}`);

    switch (job.name) {
      case 'trigger-reminder':
        return this.handleReminder(job as Job<ReminderJobData>);
      case 'schedule-repeat':
        return this.handleRepeat(job as Job<RepeatJobData>);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleReminder(job: Job<ReminderJobData>) {
    const { taskId, creatorId, title, snoozeInterval, snoozeMaxRetries, snoozeCount } =
      job.data;

    // Idempotency check: verify task still exists and is pending
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      this.logger.warn(`Task ${taskId} not found, skipping reminder`);
      return;
    }

    if (task.status === TaskStatus.COMPLETED) {
      this.logger.log(`Task ${taskId} already completed, skipping`);
      return;
    }

    // Send notification via WebSocket
    this.notificationGateway.sendNotification(creatorId, {
      type: 'REMINDER',
      taskId,
      title,
      message: job.data.isSnoozed
        ? `Snoozed reminder: ${title} (attempt ${snoozeCount})`
        : `Reminder: ${title}`,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Notification sent for task ${taskId}`);

    // Handle snooze if configured
    if (snoozeInterval && snoozeMaxRetries && snoozeCount < snoozeMaxRetries) {
      await this.reminderService.scheduleSnooze(
        taskId,
        creatorId,
        title,
        snoozeInterval,
        snoozeMaxRetries,
        snoozeCount,
      );

      // Update snooze count in database
      await this.prisma.task.update({
        where: { id: taskId },
        data: { snoozeCount: snoozeCount + 1 },
      });
    } else if (snoozeMaxRetries && snoozeCount >= snoozeMaxRetries) {
      // Mark as missed after max snooze retries
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.MISSED },
      });

      this.notificationGateway.sendNotification(creatorId, {
        type: 'TASK_MISSED',
        taskId,
        title,
        message: `Task missed: ${title}`,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Task ${taskId} marked as MISSED`);
    }
  }

  private async handleRepeat(job: Job<RepeatJobData>) {
    const {
      taskId,
      creatorId,
      title,
      repeatType,
      repeatInterval,
      repeatEndDate,
      snoozeInterval,
      snoozeMaxRetries,
    } = job.data;

    // Check if repeat should end
    if (repeatEndDate && new Date(repeatEndDate) < new Date()) {
      this.logger.log(`Repeat ended for task ${taskId}`);
      return;
    }

    // Verify task still exists
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      this.logger.warn(`Task ${taskId} not found, stopping repeat`);
      return;
    }

    // Send notification for this repeat occurrence
    this.notificationGateway.sendNotification(creatorId, {
      type: 'REMINDER',
      taskId,
      title,
      message: `Recurring reminder: ${title}`,
      timestamp: new Date().toISOString(),
    });

    // Schedule next repeat occurrence
    const nextDelay = this.getRepeatDelay(repeatType, repeatInterval);
    if (nextDelay) {
      await this.reminderService.scheduleNextRepeat(
        taskId,
        creatorId,
        title,
        repeatType,
        repeatInterval,
        repeatEndDate,
        snoozeInterval,
        snoozeMaxRetries,
        nextDelay,
      );
    }
  }

  private getRepeatDelay(
    repeatType: RepeatType,
    customInterval?: number,
  ): number | null {
    const DAY_MS = 24 * 60 * 60 * 1000;

    switch (repeatType) {
      case RepeatType.DAILY:
        return DAY_MS;
      case RepeatType.WEEKLY:
        return 7 * DAY_MS;
      case RepeatType.MONTHLY:
        return 30 * DAY_MS;
      case RepeatType.ALTERNATE_DAYS:
        return 2 * DAY_MS;
      case RepeatType.CUSTOM:
        return customInterval ? customInterval * DAY_MS : null;
      default:
        return null;
    }
  }
}
