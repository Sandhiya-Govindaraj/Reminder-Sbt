import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Task, RepeatType } from '@prisma/client';

export const REMINDER_QUEUE = 'reminder-queue';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue,
  ) {}

  async scheduleReminder(task: Task) {
    const delay = new Date(task.dateTime).getTime() - Date.now();

    if (delay <= 0) {
      this.logger.warn(`Task ${task.id} date is in the past, scheduling immediately`);
    }

    const jobId = `reminder-${task.id}`;

    await this.reminderQueue.add(
      'trigger-reminder',
      {
        taskId: task.id,
        creatorId: task.creatorId,
        title: task.title,
        snoozeInterval: task.snoozeInterval,
        snoozeMaxRetries: task.snoozeMaxRetries,
        snoozeCount: 0,
      },
      {
        jobId,
        delay: Math.max(delay, 0),
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Reminder scheduled for task ${task.id} with delay ${delay}ms`);

    // Schedule repeat jobs if configured
    if (task.repeatType !== RepeatType.NONE) {
      await this.scheduleRepeatJobs(task);
    }
  }

  async cancelReminder(taskId: string) {
    const jobId = `reminder-${taskId}`;

    try {
      const job = await this.reminderQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Reminder cancelled for task ${taskId}`);
      }

      // Cancel repeat jobs
      const repeatJobId = `repeat-${taskId}`;
      const repeatJob = await this.reminderQueue.getJob(repeatJobId);
      if (repeatJob) {
        await repeatJob.remove();
      }
    } catch (error) {
      this.logger.warn(`Failed to cancel reminder for task ${taskId}: ${error}`);
    }
  }

  async scheduleSnooze(
    taskId: string,
    creatorId: string,
    title: string,
    snoozeInterval: number,
    snoozeMaxRetries: number,
    currentSnoozeCount: number,
  ) {
    if (currentSnoozeCount >= snoozeMaxRetries) {
      this.logger.log(`Max snooze retries reached for task ${taskId}`);
      return false;
    }

    const jobId = `snooze-${taskId}-${currentSnoozeCount + 1}`;
    const delay = snoozeInterval * 60 * 1000; // Convert minutes to ms

    await this.reminderQueue.add(
      'trigger-reminder',
      {
        taskId,
        creatorId,
        title,
        snoozeInterval,
        snoozeMaxRetries,
        snoozeCount: currentSnoozeCount + 1,
        isSnoozed: true,
      },
      {
        jobId,
        delay,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Snooze scheduled for task ${taskId} (attempt ${currentSnoozeCount + 1}/${snoozeMaxRetries})`,
    );
    return true;
  }

  private async scheduleRepeatJobs(task: Task) {
    const repeatMs = this.getRepeatInterval(task.repeatType, task.repeatInterval);
    if (!repeatMs) return;

    const repeatJobId = `repeat-${task.id}`;
    const baseDelay = new Date(task.dateTime).getTime() - Date.now();

    await this.reminderQueue.add(
      'schedule-repeat',
      {
        taskId: task.id,
        creatorId: task.creatorId,
        title: task.title,
        repeatType: task.repeatType,
        repeatInterval: task.repeatInterval,
        repeatEndDate: task.repeatEndDate?.toISOString(),
        snoozeInterval: task.snoozeInterval,
        snoozeMaxRetries: task.snoozeMaxRetries,
      },
      {
        jobId: repeatJobId,
        delay: Math.max(baseDelay, 0) + repeatMs,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    this.logger.log(`Repeat job scheduled for task ${task.id}`);
  }

  private getRepeatInterval(
    repeatType: RepeatType,
    customInterval?: number | null,
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
