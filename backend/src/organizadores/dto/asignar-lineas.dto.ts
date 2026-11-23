import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class AsignarLineasDto {
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) lineaIds!: number[];
}
