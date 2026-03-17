import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpChannel } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const { channel, email, phone, name } = dto;

    if (channel === OtpChannel.EMAIL && !email) {
      throw new BadRequestException('Email is required for EMAIL channel');
    }
    if (channel === OtpChannel.PHONE && !phone) {
      throw new BadRequestException('Phone is required for PHONE channel');
    }

    // Find or create user
    const identifier = channel === OtpChannel.EMAIL ? { email } : { phone };
    let user = await this.prisma.user.findFirst({ where: identifier });

    if (!user) {
      user = await this.prisma.user.create({
        data: { ...identifier, name },
      });
      this.logger.log(`New user created: ${user.id}`);
    }

    // Generate 6-digit OTP
    const otpCode = this.generateOtp();
    const hashedCode = await bcrypt.hash(otpCode, 10);
    const expiryMinutes = this.configService.get<number>('otp.expiryMinutes', 5);

    // Invalidate previous OTPs for this user/channel
    await this.prisma.otp.updateMany({
      where: {
        userId: user.id,
        channel,
        verified: false,
      },
      data: { verified: true },
    });

    // Store new OTP
    await this.prisma.otp.create({
      data: {
        userId: user.id,
        code: hashedCode,
        channel,
        expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      },
    });

    // In production, send OTP via SMS/Email service
    // For development, log the OTP
    this.logger.log(`OTP for ${email || phone}: ${otpCode}`);

    return {
      message: `OTP sent successfully via ${channel}`,
      // Remove in production - only for development
      otp: this.configService.get('nodeEnv') === 'development' ? otpCode : undefined,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { channel, email, phone, code } = dto;

    const identifier = channel === OtpChannel.EMAIL ? { email } : { phone };
    const user = await this.prisma.user.findFirst({ where: identifier });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Find latest unverified OTP
    const otp = await this.prisma.otp.findFirst({
      where: {
        userId: user.id,
        channel,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    // Verify OTP
    const isValid = await bcrypt.compare(code, otp.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Mark OTP as verified
    await this.prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    // Generate JWT
    const payload = { sub: user.id, email: user.email, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User ${user.id} authenticated successfully`);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }
}
