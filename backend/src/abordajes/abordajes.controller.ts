import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { RegistrarAbordajeDto } from './dto/registrar-abordaje.dto';
import { RegistrarDescensoDto } from './dto/registrar-descenso.dto';
import { AbordajesService } from './abordajes.service';

@Controller('abordajes')
@ApiTags('Abordajes y aforo')
@UseGuards(SessionGuard, RolesGuard)
export class AbordajesController {
  constructor(private readonly service: AbordajesService) {}
  @Post() @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') registrar(@Req() req: Request, @Body() dto: RegistrarAbordajeDto) {
    return this.service.registrar(req.session.usuarioId!, req.session.rol!, dto);
  }
  @Patch(':id/descenso') @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') descender(
    @Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: RegistrarDescensoDto,
  ) { return this.service.descender(id, req.session.usuarioId!, req.session.rol!, dto); }
  @Get('viaje/:viajeId') @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') delViaje(
    @Param('viajeId', ParseIntPipe) viajeId: number, @Req() req: Request,
  ) { return this.service.delViaje(viajeId, req.session.usuarioId!, req.session.rol!); }
}
