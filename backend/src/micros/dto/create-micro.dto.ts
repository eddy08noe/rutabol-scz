import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EstadoMicro } from '../micro.interface';

export class CreateMicroDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  placa!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  interno!: string;

  @IsInt() @Min(1) @Max(100)
  capacidad!: number;

  @IsInt() @Min(1) @Max(100)
  capacidadSentados!: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  capacidadParadosAutorizada?: number;

  @IsOptional() @IsInt() @Min(1) @Max(100)
  capacidadOperativa?: number;

  @IsIn(['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'])
  estado!: EstadoMicro;

  @IsInt() @Min(1)
  lineaId!: number;
}
