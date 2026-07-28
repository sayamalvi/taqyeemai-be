import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ResumeModule } from './resume/resume.module';
import { DocumentModule } from './document/document.module';
import { ScoringModule } from './scoring/scoring.module';
import { LlmModule } from './llm/llm.module';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from 'nestjs-pino';
import { ExportsModule } from './exports/exports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      }
    }),
    PrismaModule,
    ResumeModule,
    DocumentModule,
    ScoringModule,
    LlmModule,
    AuthModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
