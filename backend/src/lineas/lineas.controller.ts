import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LineasService } from './lineas.service';
import { CreateLineaDto } from './dto/create-linea.dto';
import { UpdateLineaDto } from './dto/update-linea.dto';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import type { Request } from 'express';

@Controller('lineas')
@ApiTags('Líneas')
export class LineasController {
  constructor(private readonly service: LineasService) {}
  @Get() findAll(@Req() req: Request) { return this.service.findAll(req.session?.usuarioId, req.session?.rol); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN') crear(@Body() dto: CreateLineaDto) { return this.service.crear(dto); }
  @Patch(':id') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN') actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLineaDto) { return this.service.actualizar(id, dto); }
  @Delete(':id') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN') desactivar(@Param('id', ParseIntPipe) id: number) { return this.service.desactivar(id); }
}
