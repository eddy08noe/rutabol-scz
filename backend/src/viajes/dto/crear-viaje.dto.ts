import { IsInt, Min } from 'class-validator';

export class CrearViajeDto {
  @IsInt() @Min(1) lineaId!: number;
  @IsInt() @Min(1) microId!: number;
  @IsInt() @Min(1) conductorId!: number;
}
