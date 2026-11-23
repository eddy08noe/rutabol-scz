import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PagosService } from './pagos.service';
import { ResultadoReembolsoDto } from './dto/resultado-reembolso.dto';

@Controller('pagos')
@ApiTags('Pagos y reembolsos')
@UseGuards(SessionGuard, RolesGuard)
export class PagosController {
  constructor(private readonly service: PagosService) {}
  @Post('pasajes/:pasajeId/checkout') @Roles('PASAJERO', 'ADMIN') checkout(
    @Param('pasajeId', ParseIntPipe) pasajeId: number, @Req() req: Request,
  ) { return this.service.iniciarCheckout(pasajeId, req.session.usuarioId!, req.session.rol!); }
  @Get() @Roles('PASAJERO', 'ADMIN') listar(@Req() req: Request) {
    return this.service.listar(req.session.usuarioId!, req.session.rol!);
  }
  @Get('reembolsos') @Roles('PASAJERO', 'ADMIN') reembolsos(@Req() req: Request) {
    return this.service.reembolsos(req.session.usuarioId!, req.session.rol!);
  }
  @Patch('reembolsos/:id/resultado') @Roles('ADMIN') resultadoReembolso(
    @Param('id', ParseIntPipe) id: number, @Body() dto: ResultadoReembolsoDto,
  ) { return this.service.registrarResultadoReembolso(id, dto); }
  @Get('reporte-ingresos') @Roles('ADMIN') reporteIngresos(@Query() query: {
    desde?: string; hasta?: string; agrupacion?: string; lineaId?: string; conductorId?: string; microId?: string;
  }) { return this.service.reporteIngresos(query); }
  @Get(':id') @Roles('PASAJERO', 'ADMIN') detalle(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.detalle(id, req.session.usuarioId!, req.session.rol!);
  }
}
