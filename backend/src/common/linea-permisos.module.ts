import { Global, Module } from '@nestjs/common';
import { LineaPermisosService } from './linea-permisos.service';

@Global()
@Module({ providers: [LineaPermisosService], exports: [LineaPermisosService] })
export class LineaPermisosModule {}
