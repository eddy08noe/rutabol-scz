import { Module } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';
import { BeneficiosController } from './beneficios.controller';
import { BeneficiosService } from './beneficios.service';

@Module({ controllers: [BeneficiosController], providers: [BeneficiosService, SessionGuard, RolesGuard] })
export class BeneficiosModule {}
