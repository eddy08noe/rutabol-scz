import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearUbicacionDto } from './dto/crear-ubicacion.dto';
import { UbicacionesService } from './ubicaciones.service';

@Controller('ubicaciones')
@ApiTags('Ubicaciones GPS')
export class UbicacionesController {
  constructor(private readonly service: UbicacionesService) {}
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR', 'CHOFER') registrar(@Req() req: Request, @Body() dto: CrearUbicacionDto) {
    return this.service.registrar(req.session.usuarioId!, req.session.rol!, dto);
  }
  @Get('micros/:microId') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') historial(
    @Param('microId', ParseIntPipe) microId: number, @Req() req: Request, @Query('limite') limite?: string,
  ) { return this.service.historialMicro(microId, req.session.usuarioId!, req.session.rol!, limite ? Number(limite) : 100); }
}
