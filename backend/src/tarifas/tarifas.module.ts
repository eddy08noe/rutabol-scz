import { Module } from '@nestjs/common';
import { TarifasController } from './tarifas.controller';
import { TarifasService } from './tarifas.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [TarifasController], providers: [TarifasService, SessionGuard, RolesGuard] })
export class TarifasModule {}
