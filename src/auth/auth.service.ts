import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private prisma: PrismaService, private jwtService: JwtService) { }

    async validateUser(email: string, password: string): Promise<any> {
        this.logger.log(`Attempting login for email: ${email}`);

        const user = await this.prisma.user.findUnique({ where: { email } });

        if (user && await bcrypt.compare(password, user.passwordHash)) {
            const { passwordHash, ...result } = user;
            this.logger.log(`User ${email} successfully validated.`);
            return result;
        }

        this.logger.warn(`Failed login attempt for email: ${email}`);
        return null;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id };
        this.logger.log(`Generating JWT for user: ${user.email}`);

        return {
            accessToken: this.jwtService.sign(payload)
        };
    }

    async register(registerDto: RegisterDto) {
        this.logger.log(`Registering new user with email: ${registerDto.email}`);

        const existingUser = await this.prisma.user.findUnique({
            where: { email: registerDto.email }
        });

        if (existingUser) {
            this.logger.warn(`Registration failed: User ${registerDto.email} already exists.`);
            throw new ConflictException('A user with this email already exists');
        }

        try {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(registerDto.password, salt);

            const user = await this.prisma.user.create({
                data: {
                    email: registerDto.email,
                    name: registerDto.name,
                    passwordHash
                }
            });

            this.logger.log(`User ${user.email} created successfully.`);
            return this.login(user);

        } catch (error) {
            this.logger.error(`Failed to register user ${registerDto.email}`, error.stack);
            throw error
        }
    }
}
