import { Module } from '@nestjs/common';
import { ResumeService } from './resume.service';
import { ResumeController } from './resume.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [ResumeController],
  providers: [ResumeService],
  imports: [PrismaModule]
})
export class ResumeModule { }
