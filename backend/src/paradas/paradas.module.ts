import { Module } from '@nestjs/common';
import { ParadasController } from './paradas.controller';
import { ParadasService } from './paradas.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [ParadasController], providers: [ParadasService, SessionGuard, RolesGuard] })
export class ParadasModule {}
