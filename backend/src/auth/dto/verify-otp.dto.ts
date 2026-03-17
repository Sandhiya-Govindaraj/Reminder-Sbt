import { IsEmail, IsEnum, IsString, ValidateIf, Length } from 'class-validator';
import { OtpChannel } from '@prisma/client';

export class VerifyOtpDto {
  @IsEnum(OtpChannel)
  channel: OtpChannel;

  @ValidateIf((o) => o.channel === OtpChannel.EMAIL)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => o.channel === OtpChannel.PHONE)
  @IsString()
  phone?: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
