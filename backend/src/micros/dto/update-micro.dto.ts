import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoMicro } from '../micro.interface';

export class UpdateMicroDto {
  @IsOptional() @IsString() @MaxLength(20)
  placa?: string;

  @IsOptional() @IsString() @MaxLength(20)
  interno?: string;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  capacidad?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  capacidadSentados?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  capacidadParadosAutorizada?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  capacidadOperativa?: number;

  @IsOptional() @IsIn(['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'])
  estado?: EstadoMicro;

  @IsOptional() @IsInt() @Min(1)
  lineaId?: number;
}
