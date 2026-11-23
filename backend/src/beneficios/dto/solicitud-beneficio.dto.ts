import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CATEGORIAS_BENEFICIO, CategoriaBeneficio } from '../../common/categorias-tarifa';

export class SolicitudBeneficioDto {
  @IsInt()
  lineaId!: number;
  @IsIn(CATEGORIAS_BENEFICIO)
  categoria!: CategoriaBeneficio;

  @IsString() @IsNotEmpty() @MaxLength(1000)
  evidenciaRef!: string;

  @IsOptional() @IsDateString()
  fechaNacimiento?: string;
}
