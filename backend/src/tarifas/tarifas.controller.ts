import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CrearTarifaDto } from './dto/crear-tarifa.dto';
import { TarifasService } from './tarifas.service';

@Controller('tarifas')
@ApiTags('Tarifas')
export class TarifasController {
  constructor(private readonly service: TarifasService) {}
  @Get() listar(@Req() req: Request, @Query('lineaId') lineaId?: string, @Query('categoria') categoria?: string) {
    return this.service.listar(lineaId ? Number(lineaId) : undefined, categoria, req.session?.usuarioId, req.session?.rol);
  }
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') crear(@Body() dto: CrearTarifaDto, @Req() req: Request) {
    return this.service.crear(dto, req.session.usuarioId!, req.session.rol!);
  }
  @Delete(':id') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') desactivar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.desactivar(id, req.session.usuarioId!, req.session.rol!);
  }
}
