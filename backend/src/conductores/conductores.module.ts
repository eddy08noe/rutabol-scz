import { Module } from '@nestjs/common';
import { ConductoresController } from './conductores.controller';
import { ConductoresService } from './conductores.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [ConductoresController], providers: [ConductoresService, SessionGuard, RolesGuard] })
export class ConductoresModule {}
