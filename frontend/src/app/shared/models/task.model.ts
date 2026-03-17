export type TaskStatus = 'PENDING' | 'COMPLETED' | 'MISSED';
export type TaskType = 'MYSELF' | 'GROUP' | 'SOMEONE_ELSE';
export type RepeatType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALTERNATE_DAYS' | 'CUSTOM';

export interface Attachment {
  id?: string;
  fileUrl: string;
  fileName: string;
}

export interface TaskAssignment {
  id: string;
  userId: string;
  user: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dateTime: string;
  timezone: string;
  status: TaskStatus;
  taskType: TaskType;
  category?: string;
  notes?: string;
  repeatType: RepeatType;
  repeatInterval?: number;
  repeatEndDate?: string;
  snoozeInterval?: number;
  snoozeMaxRetries?: number;
  snoozeCount: number;
  creatorId: string;
  creator: {
    id: string;
    name?: string;
    email?: string;
  };
  attachments: Attachment[];
  taskAssignments: TaskAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  dateTime: string;
  timezone?: string;
  taskType?: TaskType;
  category?: string;
  notes?: string;
  repeatType?: RepeatType;
  repeatInterval?: number;
  repeatEndDate?: string;
  snoozeInterval?: number;
  snoozeMaxRetries?: number;
  assigneeIds?: string[];
  attachments?: { fileUrl: string; fileName: string }[];
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

export interface Notification {
  type: string;
  taskId: string;
  title: string;
  message: string;
  timestamp: string;
}
