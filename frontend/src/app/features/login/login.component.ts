import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loginForm: FormGroup;
  otpForm: FormGroup;
  channel: 'EMAIL' | 'PHONE' = 'EMAIL';
  otpSent = false;
  loading = false;
  error = '';
  devOtp = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.loginForm = this.fb.group({
      channel: ['EMAIL', Validators.required],
      email: ['', [Validators.email]],
      phone: [''],
      name: [''],
    });

    this.otpForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });
  }

  onChannelChange(): void {
    this.channel = this.loginForm.get('channel')?.value;
    this.error = '';
  }

  sendOtp(): void {
    this.loading = true;
    this.error = '';

    const request = {
      channel: this.channel,
      ...(this.channel === 'EMAIL'
        ? { email: this.loginForm.get('email')?.value }
        : { phone: this.loginForm.get('phone')?.value }),
      name: this.loginForm.get('name')?.value || undefined,
    };

    this.authService.sendOtp(request).subscribe({
      next: (response) => {
        this.otpSent = true;
        this.loading = false;
        if (response.otp) {
          this.devOtp = response.otp;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to send OTP';
        this.loading = false;
      },
    });
  }

  verifyOtp(): void {
    this.loading = true;
    this.error = '';

    const request = {
      channel: this.channel,
      ...(this.channel === 'EMAIL'
        ? { email: this.loginForm.get('email')?.value }
        : { phone: this.loginForm.get('phone')?.value }),
      code: this.otpForm.get('code')?.value,
    };

    this.authService.verifyOtp(request).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Invalid OTP';
        this.loading = false;
      },
    });
  }

  resetForm(): void {
    this.otpSent = false;
    this.devOtp = '';
    this.otpForm.reset();
    this.error = '';
  }
}
