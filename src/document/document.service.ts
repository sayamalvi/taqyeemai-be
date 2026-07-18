import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class DocumentService {
    async extractTextFromPDF(buffer: Buffer): Promise<string> {
        try {
            const parser = new PDFParse({
                data: buffer,
            })
            const result = await parser.getText()
            return result.text

        } catch (error) {
            console.error("Error parsing PDF:", error);
            throw new HttpException('Failed to parse PDF file', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
