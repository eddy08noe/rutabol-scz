import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';

export class CrearIncidenteDto {
  @IsIn(['FALLA_MECANICA', 'EMERGENCIA_CONDUCTOR', 'OTRA']) tipo!: 'FALLA_MECANICA' | 'EMERGENCIA_CONDUCTOR' | 'OTRA';
  @IsString() @MaxLength(2000) descripcion!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
}
