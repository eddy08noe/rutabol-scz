import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResultadoReembolsoDto {
  @IsIn(['CONFIRMADO', 'FALLIDO'])
  estado!: 'CONFIRMADO' | 'FALLIDO';

  @IsOptional() @IsString() @MaxLength(160)
  referenciaProveedor?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  detalleError?: string;
}
