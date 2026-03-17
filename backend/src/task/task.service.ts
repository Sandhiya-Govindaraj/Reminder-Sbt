import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReminderService } from '../reminder/reminder.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto, UpdateTaskStatusDto } from './dto/update-task.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderService: ReminderService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const { assigneeIds, attachments, dateTime, repeatEndDate, ...taskData } =
      dto;

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        dateTime: new Date(dateTime),
        repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : undefined,
        creatorId: userId,
        taskAssignments: assigneeIds
          ? {
              create: assigneeIds.map((id) => ({ userId: id })),
            }
          : undefined,
        attachments: attachments
          ? {
              create: attachments,
            }
          : undefined,
      },
      include: {
        attachments: true,
        taskAssignments: { include: { user: true } },
        creator: true,
      },
    });

    // Schedule reminder
    await this.reminderService.scheduleReminder(task);
    this.logger.log(`Task created: ${task.id}`);

    return task;
  }

  async findAll(userId: string, status?: TaskStatus) {
    const where = {
      OR: [
        { creatorId: userId },
        { taskAssignments: { some: { userId } } },
      ],
      ...(status && { status }),
    };

    return this.prisma.task.findMany({
      where,
      include: {
        attachments: true,
        taskAssignments: { include: { user: true } },
        creator: true,
      },
      orderBy: { dateTime: 'asc' },
    });
  }

  async findOne(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        attachments: true,
        taskAssignments: { include: { user: true } },
        creator: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    this.validateAccess(userId, task);
    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.findOne(userId, taskId);

    if (existing.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can update this task');
    }

    const { assigneeIds, attachments, dateTime, repeatEndDate, ...updateData } =
      dto;

    // Handle assignee updates
    if (assigneeIds) {
      await this.prisma.taskAssignment.deleteMany({ where: { taskId } });
    }

    // Handle attachment updates
    if (attachments) {
      await this.prisma.attachment.deleteMany({ where: { taskId } });
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...updateData,
        ...(dateTime && { dateTime: new Date(dateTime) }),
        ...(repeatEndDate && { repeatEndDate: new Date(repeatEndDate) }),
        taskAssignments: assigneeIds
          ? { create: assigneeIds.map((id) => ({ userId: id })) }
          : undefined,
        attachments: attachments ? { create: attachments } : undefined,
      },
      include: {
        attachments: true,
        taskAssignments: { include: { user: true } },
        creator: true,
      },
    });

    // Reschedule reminder if date changed
    if (dateTime) {
      await this.reminderService.cancelReminder(taskId);
      await this.reminderService.scheduleReminder(task);
    }

    return task;
  }

  async updateStatus(
    userId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const existing = await this.findOne(userId, taskId);
    this.validateAccess(userId, existing);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
      include: {
        attachments: true,
        taskAssignments: { include: { user: true } },
        creator: true,
      },
    });

    // Cancel reminder if completed
    if (dto.status === TaskStatus.COMPLETED) {
      await this.reminderService.cancelReminder(taskId);
    }

    return task;
  }

  async remove(userId: string, taskId: string) {
    const existing = await this.findOne(userId, taskId);

    if (existing.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can delete this task');
    }

    await this.reminderService.cancelReminder(taskId);
    await this.prisma.task.delete({ where: { id: taskId } });

    return { message: 'Task deleted successfully' };
  }

  private validateAccess(userId: string, task: { creatorId: string; taskAssignments: { userId: string }[] }) {
    const isCreator = task.creatorId === userId;
    const isAssignee = task.taskAssignments.some((a) => a.userId === userId);

    if (!isCreator && !isAssignee) {
      throw new ForbiddenException('Access denied');
    }
  }
}
