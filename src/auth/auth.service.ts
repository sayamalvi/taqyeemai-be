import { Injectable, ConflictException, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
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
        const tokens = await this.getTokens(user.id, user.email);
        this.logger.log(`Generating tokens for user: ${user.email}`);
        await this.updateRefreshToken(user.id, tokens.refreshToken)
        return tokens;
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
                    passwordHash,
                }
            });

            this.logger.log(`User ${user.email} created successfully.`);
            return this.login(user);

        } catch (error) {
            this.logger.error(`Failed to register user ${registerDto.email}`, error.stack);
            throw error
        }
    }

    private async getTokens(userId: string, email: string) {
        const payload = { sub: userId, email }
        const [accessToken, refreshToken] = await Promise.all(
            [this.jwtService.signAsync(payload, {
                secret: process.env.JWT_SECRET, expiresIn: '15m',
            }),
            this.jwtService.signAsync(payload, { secret: process.env.REFRESH_SECRET, expiresIn: '7d' })
            ])
        return { accessToken, refreshToken }
    }

    async updateRefreshToken(userId: string, refreshToken: string | null) {
        const salt = await bcrypt.genSalt(10);
        let hashedRefreshToken: string | null = null;
        if (refreshToken) {
            hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
        }


        await this.prisma.user.update({ where: { id: userId }, data: { hashedRefreshToken: hashedRefreshToken ?? null } })
    }

    async refreshTokens(refreshToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync(refreshToken, { secret: process.env.REFRESH_SECRET })
            const userId = payload.sub
            const user = await this.prisma.user.findUnique({ where: { id: userId } })

            if (!user || !user.hashedRefreshToken) {
                throw new BadRequestException("Access Denied")
            }

            const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.hashedRefreshToken)
            if (!isRefreshTokenValid) {
                throw new BadRequestException("Access Denied")
            }
            const tokens = await this.getTokens(user.id, user.email)
            await this.updateRefreshToken(user.id, tokens.refreshToken)
            return tokens;
        } catch (error) {
            throw new UnauthorizedException("Invalid or expired refresh token")
        }
    }

    async getUserProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                credits: true,
                tier: true,
                createdAt: true
            }
        })

        if (!user) {
            throw new UnauthorizedException(`User with ID ${userId} not found`);
        }
        return user
    }
}
