import { IsInt, IsOptional, Min } from 'class-validator';

export class RegistrarDescensoDto {
  @IsOptional() @IsInt() @Min(1) paradaBajadaId?: number;
}
