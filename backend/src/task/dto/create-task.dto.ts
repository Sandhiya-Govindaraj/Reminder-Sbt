import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskType, RepeatType } from '@prisma/client';

export class AttachmentDto {
  @IsString()
  fileUrl: string;

  @IsString()
  fileName: string;
}

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dateTime: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(TaskType)
  taskType?: TaskType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RepeatType)
  repeatType?: RepeatType;

  @IsOptional()
  @IsInt()
  @Min(1)
  repeatInterval?: number;

  @IsOptional()
  @IsDateString()
  repeatEndDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  snoozeInterval?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  snoozeMaxRetries?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
