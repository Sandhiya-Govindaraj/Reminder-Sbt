import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReminderService, REMINDER_QUEUE } from './reminder.service';
import { ReminderProcessor } from './reminder.processor';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: REMINDER_QUEUE,
    }),
    NotificationModule,
  ],
  providers: [ReminderService, ReminderProcessor],
  exports: [ReminderService],
})
export class ReminderModule {}
