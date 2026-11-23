import { Module } from '@nestjs/common';
import { LineasController } from './lineas.controller';
import { LineasService } from './lineas.service';

@Module({
  controllers: [LineasController],
  providers: [LineasService],
  exports: [LineasService],
})
export class LineasModule {}
