import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AnalyzeResumeDto {
    @IsString()
    @IsNotEmpty()
    versionId: string;

    @IsString()
    @IsNotEmpty()
    targetRole: string;

    @IsString()
    @IsNotEmpty()
    targetJobDescription: string;
}
