import { Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';
import { responseFormat } from 'src/resume/utils';
import { ResumeTemplateV1 } from './latex-template';

export interface LLMProvider {
    analyze(systemPrompt: string, userPrompt: string): Promise<any>
    generateText(systemPrompt: string, userPrompt: string): Promise<string>
}

export class OpenAiProvider implements LLMProvider {
    private client: OpenAI;
    constructor() {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    async analyze(systemPrompt: string, userPrompt: string): Promise<any> {
        const response = await this.client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            response_format: responseFormat,
            temperature: 0
        });
        return JSON.parse(response.choices[0]!.message.content!);
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0
        });
        return response.choices[0]!.message.content!;
    }
}

export class GroqProvider implements LLMProvider {
    private client: OpenAI;
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });
    }

    async analyze(systemPrompt: string, userPrompt: string): Promise<any> {
        const groqSystemPrompt = systemPrompt + `\n\nCRITICAL: You MUST return ONLY valid JSON. The JSON must exactly match this schema: ${JSON.stringify(responseFormat.json_schema.schema)}`;
        const response = await this.client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: groqSystemPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_object" },
            temperature: 0
        });
        return JSON.parse(response.choices[0]!.message.content!);
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        const groqSystemPrompt = systemPrompt + `\n\nCRITICAL: You MUST return ONLY valid JSON. The JSON must exactly match this schema: ${JSON.stringify(responseFormat.json_schema.schema)}`;
        const response = await this.client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: groqSystemPrompt }, { role: "user", content: userPrompt }],
            response_format: { type: "json_object" },
            temperature: 0
        });
        return response.choices[0]!.message.content!;
    }
}

@Injectable()
export class LLMService {
    private provider: LLMProvider;
    constructor() {
        // Dynamically inject the provider based on environment variables!
        if (process.env.GROQ_API_KEY) {
            console.log("[LlmService] Routing traffic to Groq...");
            this.provider = new GroqProvider();
        } else if (process.env.OPENAI_API_KEY) {
            console.log("[LlmService] Routing traffic to OpenAI...");
            this.provider = new OpenAiProvider();
        } else {
            throw new InternalServerErrorException("No LLM API keys found in environment.");
        }
    }

    async analyzeText(systemPrompt: string, userPrompt: string): Promise<any> {
        return this.provider.analyze(systemPrompt, userPrompt);
    }

    async generateLatex(resumeData: any): Promise<string> {
        const systemPrompt = `You are an expert LaTeX resume formatter.
        Your job is to take the provided structured resume data and populate it exactly into the following LaTeX template.
        DO NOT output any markdown blocks like \`\`\`latex. Output ONLY the raw LaTeX code.
        Make sure to escape special characters like %, &, $, _ where appropriate.

        TEMPLATE:
        ${ResumeTemplateV1}`;

        const userPrompt = `Here is the structured resume data. Populate the template with it:\n\n${JSON.stringify(resumeData, null, 2)}`;

        return this.provider.generateText(systemPrompt, userPrompt);
    }

}
