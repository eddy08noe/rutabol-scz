import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseFloatPipe, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MicrosService } from './micros.service';
import { CreateMicroDto } from './dto/create-micro.dto';
import { UpdateMicroDto } from './dto/update-micro.dto';
import { SessionGuard } from '../auth/session.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import type { Request } from 'express';

@Controller('micros')
@ApiTags('Micros')
export class MicrosController {
  constructor(private readonly service: MicrosService) {}

  @Get() findAll(@Req() req: Request) { return this.service.findAll(req.session?.usuarioId, req.session?.rol); }
  @Get('cercanos') cercanos(@Query('lat', ParseFloatPipe) lat: number, @Query('lng', ParseFloatPipe) lng: number) {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('Coordenadas fuera de rango');
    return this.service.cercanos(lat, lng);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') create(@Req() req: Request, @Body() dto: CreateMicroDto) { return this.service.create(dto, req.session.usuarioId!, req.session.rol!); }
  @Patch(':id') @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') update(@Param('id', ParseIntPipe) id: number, @Req() req: Request, @Body() dto: UpdateMicroDto) { return this.service.update(id, dto, req.session.usuarioId!, req.session.rol!); }
  @Delete(':id') @HttpCode(204) @UseGuards(SessionGuard, RolesGuard) @Roles('ADMIN', 'ORGANIZADOR') remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.remove(id, req.session.usuarioId!, req.session.rol!); }
}
