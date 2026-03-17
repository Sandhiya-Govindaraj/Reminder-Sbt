export interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SendOtpRequest {
  channel: 'EMAIL' | 'PHONE';
  email?: string;
  phone?: string;
  name?: string;
}

export interface VerifyOtpRequest {
  channel: 'EMAIL' | 'PHONE';
  email?: string;
  phone?: string;
  code: string;
}

export interface SendOtpResponse {
  message: string;
  otp?: string; // Only in dev mode
}
