import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AnalyzeResumeDto {
    @IsString()
    @IsNotEmpty()
    versionId: string;

    @IsString()
    @IsOptional()
    targetRole?: string;

    @IsString()
    @IsOptional()
    targetJobDescription?: string;
}
