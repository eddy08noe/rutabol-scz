import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarConductorDto {
  @IsOptional() @IsString() @MaxLength(100) nombres?: string;
  @IsOptional() @IsString() @MaxLength(100) apellidos?: string;
  @IsOptional() @IsString() @MaxLength(40) licencia?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
