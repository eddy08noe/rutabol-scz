import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { RevisarEstudianteDto } from '../estudiantes/dto/revisar-estudiante.dto';
import { SolicitudBeneficioDto } from './dto/solicitud-beneficio.dto';
import { BeneficiosService } from './beneficios.service';

@Controller('beneficios-tarifarios')
@ApiTags('Beneficios tarifarios')
@UseGuards(SessionGuard, RolesGuard)
export class BeneficiosController {
  constructor(private readonly service: BeneficiosService) {}

  @Post() @Roles('PASAJERO') solicitar(@Req() req: Request, @Body() dto: SolicitudBeneficioDto) {
    return this.service.solicitar(req.session.usuarioId!, dto);
  }
  @Get('mios') @Roles('PASAJERO') mio(@Req() req: Request) { return this.service.mio(req.session.usuarioId!); }
  @Get('pendientes') @Roles('ADMIN', 'ORGANIZADOR') pendientes(@Req() req: Request) { return this.service.pendientes(req.session.usuarioId!, req.session.rol!); }
  @Patch(':id/revision') @Roles('ADMIN', 'ORGANIZADOR') revisar(
    @Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: RevisarEstudianteDto,
  ) { return this.service.revisar(id, req.session.usuarioId!, req.session.rol!, dto); }
}
