import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  idToken!: string;
}

export class AppleSignInDto {
  @IsString()
  idToken!: string;
}

export class RequestEmailOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyEmailOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits.' })
  code!: string;
}

export class RequestOtpDto {
  @IsString()
  @Length(7, 15)
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Length(7, 15)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits.' })
  code!: string;
}
