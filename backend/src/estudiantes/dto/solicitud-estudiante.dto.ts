import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CATEGORIAS_ESTUDIANTE, CategoriaEstudiante } from '../../common/categorias-tarifa';

export class SolicitudEstudianteDto {
  @IsInt()
  lineaId!: number;
  @IsIn(CATEGORIAS_ESTUDIANTE)
  tipo!: CategoriaEstudiante;
  @IsOptional() @IsString() @MaxLength(40)
  codigoRude?: string;
  @IsOptional() @IsString() @MaxLength(40)
  codigoUniversitario?: string;
  @IsOptional() @IsString() @MaxLength(254)
  correoInstitucional?: string;
  @IsString() @IsNotEmpty() @MaxLength(1000)
  evidenciaRef!: string;
}
