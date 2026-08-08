import { HttpException, HttpStatus, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import puppeteer from 'puppeteer';
import { ActivityService } from 'src/activity/activity.service';

@Injectable()
export class ExportsService {
    constructor(private readonly prisma: PrismaService, private readonly activityService: ActivityService) { }
    async downloadPdf(userId: string, resumeId: string, versionId: string, authHeader?: string, cookieHeader?: string) {
        const analysis = await this.prisma.analysis.findUnique({
            where: { resumeVersionId: versionId }, include: { resumeVersion: { include: { resume: true } } }
        })

        if (!analysis || analysis.resumeVersion.resume.userId !== userId) {
            throw new NotFoundException("Analysis not found or unauthorized")
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })

        try {
            const page = await browser.newPage();
            const baseUrl = process.env.FRONTEND_URL
            const exportUrl = `${baseUrl}/export/${resumeId}/${versionId}`;
            const headersToInject: Record<string, string> = {};
            if (authHeader) headersToInject['Authorization'] = authHeader;
            await page.setExtraHTTPHeaders(headersToInject);

            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(pair => {
                    const [name, ...rest] = pair.trim().split('=');
                    return {
                        name,
                        value: rest.join('='),
                        url: baseUrl
                    };
                });
                await page.setCookie(...cookies);
            }

            // Use networkidle2 so it doesn't hang forever waiting for Next.js dev server websockets
            await page.goto(exportUrl, { waitUntil: 'networkidle2' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' }
            })

            // Log activity
            await this.activityService.logAction(userId, 'EXPORT', undefined, resumeId, versionId);

            return new StreamableFile(Buffer.from(pdfBuffer), {
                type: 'application/pdf',
                disposition: `attachment; filename="Resume_Optimized.pdf"`,
            });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            throw new HttpException("Failed to generate PDF", HttpStatus.INTERNAL_SERVER_ERROR)
        }
        finally {
            browser.close()
        }

    }
}
