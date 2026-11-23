import { IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CrearConductorDto {
  @IsString() @IsNotEmpty() @MaxLength(100) nombres!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) apellidos!: string;
  @IsString() @IsNotEmpty() @MaxLength(40) licencia!: string;
  @ValidateIf((dto: CrearConductorDto) => Boolean(dto.username))
  @IsEmail() @MaxLength(254) correo?: string;
  @IsOptional() @IsNumber() usuarioId?: number;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) username?: string;
  @IsOptional() @IsString() @MinLength(12) @MaxLength(128) password?: string;
  @IsOptional() @IsInt() lineaId?: number;
}
