import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CrearTrasbordoDto {
  @IsInt() @Min(1) viajeOrigenId!: number;
  @IsInt() @Min(1) viajeDestinoId!: number;
  @IsIn(['NORMAL', 'EMERGENCIA']) tipo!: 'NORMAL' | 'EMERGENCIA';
  @IsIn(['FIN_TURNO', 'FALLA_MECANICA', 'EMERGENCIA_CONDUCTOR', 'OTRA_EMERGENCIA']) motivo!: string;
  @IsOptional() @IsString() @MaxLength(2000) nota?: string;
  @IsOptional() @IsString() @MaxLength(2000) descripcionIncidente?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
}
