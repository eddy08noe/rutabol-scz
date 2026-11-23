import { Module } from '@nestjs/common';
import { AbordajesController } from './abordajes.controller';
import { AbordajesService } from './abordajes.service';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [AbordajesController], providers: [AbordajesService, SessionGuard, RolesGuard] })
export class AbordajesModule {}
