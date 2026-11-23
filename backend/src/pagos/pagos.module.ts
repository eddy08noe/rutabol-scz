import { Module } from '@nestjs/common';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [PagosController], providers: [PagosService, SessionGuard, RolesGuard], exports: [PagosService] })
export class PagosModule {}
