import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevisarEstudianteDto {
  @IsIn(['APROBADO', 'RECHAZADO'])
  estado!: 'APROBADO' | 'RECHAZADO';
  @IsOptional() @IsString() @MaxLength(1000)
  motivoRechazo?: string;
}
