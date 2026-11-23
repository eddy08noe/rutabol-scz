import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  username!: string;

  @IsString() @MinLength(12) @MaxLength(128)
  password!: string;

  @IsString() @IsNotEmpty() @MaxLength(160)
  nombreCompleto!: string;

  @IsEmail() @MaxLength(254)
  correo!: string;
}
