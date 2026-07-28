import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExportsService],
  exports: [ExportsService]
})
export class ExportsModule { }
