import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  AuthResponse,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
} from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  get isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  get currentToken(): string | null {
    return this.tokenSubject.value;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  sendOtp(request: SendOtpRequest): Observable<SendOtpResponse> {
    return this.http.post<SendOtpResponse>(
      `${this.apiUrl}/auth/send-otp`,
      request,
    );
  }

  verifyOtp(request: VerifyOtpRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/verify-otp`, request)
      .pipe(
        tap((response) => {
          this.setSession(response);
        }),
      );
  }

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/profile`).pipe(
      tap((user) => {
        this.currentUserSubject.next(user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  private setSession(authResponse: AuthResponse): void {
    localStorage.setItem('access_token', authResponse.accessToken);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    this.tokenSubject.next(authResponse.accessToken);
    this.currentUserSubject.next(authResponse.user);
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');

    if (token) {
      this.tokenSubject.next(token);
    }
    if (userStr) {
      try {
        this.currentUserSubject.next(JSON.parse(userStr));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }
}
