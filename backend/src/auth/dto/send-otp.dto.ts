import { IsEmail, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { OtpChannel } from '@prisma/client';

export class SendOtpDto {
  @IsEnum(OtpChannel)
  channel: OtpChannel;

  @ValidateIf((o) => o.channel === OtpChannel.EMAIL)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => o.channel === OtpChannel.PHONE)
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
