import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { CreateTaskRequest } from '../../shared/models/task.model';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.css',
})
export class TaskFormComponent {
  taskForm: FormGroup;
  loading = false;
  error = '';

  taskTypes = ['MYSELF', 'GROUP', 'SOMEONE_ELSE'];
  repeatTypes = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'ALTERNATE_DAYS', 'CUSTOM'];
  categories = ['Work', 'Personal', 'Health', 'Finance', 'Shopping', 'Other'];

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private router: Router,
  ) {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      dateTime: ['', Validators.required],
      timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone],
      taskType: ['MYSELF'],
      category: [''],
      notes: [''],
      repeatType: ['NONE'],
      repeatInterval: [null],
      repeatEndDate: [''],
      snoozeInterval: [null],
      snoozeMaxRetries: [null],
      assigneeIds: [''],
      attachments: this.fb.array([]),
    });
  }

  get attachments(): FormArray {
    return this.taskForm.get('attachments') as FormArray;
  }

  get showRepeatInterval(): boolean {
    return this.taskForm.get('repeatType')?.value === 'CUSTOM';
  }

  get showSnoozeConfig(): boolean {
    const interval = this.taskForm.get('snoozeInterval')?.value;
    return interval !== null && interval > 0;
  }

  addAttachment(): void {
    this.attachments.push(
      this.fb.group({
        fileUrl: ['', Validators.required],
        fileName: ['', Validators.required],
      }),
    );
  }

  removeAttachment(index: number): void {
    this.attachments.removeAt(index);
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';

    const formValue = this.taskForm.value;
    const request: CreateTaskRequest = {
      title: formValue.title,
      description: formValue.description || undefined,
      dateTime: new Date(formValue.dateTime).toISOString(),
      timezone: formValue.timezone || undefined,
      taskType: formValue.taskType || undefined,
      category: formValue.category || undefined,
      notes: formValue.notes || undefined,
      repeatType: formValue.repeatType !== 'NONE' ? formValue.repeatType : undefined,
      repeatInterval: formValue.repeatInterval || undefined,
      repeatEndDate: formValue.repeatEndDate
        ? new Date(formValue.repeatEndDate).toISOString()
        : undefined,
      snoozeInterval: formValue.snoozeInterval || undefined,
      snoozeMaxRetries: formValue.snoozeMaxRetries || undefined,
      assigneeIds: formValue.assigneeIds
        ? formValue.assigneeIds.split(',').map((id: string) => id.trim()).filter(Boolean)
        : undefined,
      attachments: formValue.attachments.length > 0 ? formValue.attachments : undefined,
    };

    this.taskService.create(request).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to create task';
        this.loading = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
