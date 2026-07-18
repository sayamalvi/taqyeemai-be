import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RewriteItemDto {
    @IsString()
    @IsNotEmpty()
    original: string;

    @IsString()
    @IsNotEmpty()
    rewritten: string;
}

export class ApplyRewritesDto {
    @IsString()
    @IsNotEmpty()
    baseVersionId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RewriteItemDto)
    rewrites: RewriteItemDto[];
}
