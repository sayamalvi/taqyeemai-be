import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { Resume } from 'generated/prisma/client';

export class CreateResumeDto implements Pick<Resume, 'title' | 'userId'> {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsUUID()
    @IsNotEmpty()
    userId: string;

}
