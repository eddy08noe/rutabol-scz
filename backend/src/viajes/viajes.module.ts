import { Module } from '@nestjs/common';
import { ViajesController } from './viajes.controller';
import { ViajesService } from './viajes.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [ViajesController], providers: [ViajesService, SessionGuard, RolesGuard] })
export class ViajesModule {}
