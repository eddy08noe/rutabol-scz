import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLineaDto {
  @IsOptional() @IsString() @MaxLength(100)
  nombre?: string;
  @IsOptional() @IsString() @MaxLength(80)
  zona?: string;
  @IsOptional() @IsString() @MaxLength(2000)
  descripcion?: string;
  @IsOptional() @IsHexColor()
  color?: string;
  @IsOptional() @IsBoolean()
  activa?: boolean;
}
