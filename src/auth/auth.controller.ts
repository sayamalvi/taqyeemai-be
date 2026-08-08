import { Body, Controller, Get, Post, Request, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { Response } from 'express'
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
        const tokens = await this.authService.register(registerDto)
        this.setCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: "Registration Successful" };
    }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req, @Res({ passthrough: true }) res: Response) {
        const tokens = await this.authService.login(req.user)
        this.setCookies(res, tokens.accessToken, tokens.refreshToken);
        return { message: "Login Successful" };
    }

    @Post('refresh')
    async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
        const refreshToken = req.cookies?.['Refresh']
        if (!refreshToken) {
            throw new UnauthorizedException("No refresh token provided");
        }

        try {
            const tokens = await this.authService.refreshTokens(refreshToken)
            this.setCookies(res, tokens.accessToken, tokens.refreshToken)
            return { message: "Token refreshed." }
        } catch (error) {
            res.clearCookie('Authentication')
            res.clearCookie('Refresh')
            throw new UnauthorizedException("Session Expired");
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
        res.clearCookie('Refresh')
        res.clearCookie('Authentication')
        await this.authService.updateRefreshToken(req.user.userId, null)
        return { message: "Logout Successful" }
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getProfile(@Request() req) {
        return await this.authService.getUserProfile(req.user.userId)
    }

    private setCookies(res: Response, accessToken: string, refreshToken: string) {
        res.cookie('Authentication', accessToken, {
            httpOnly: true, secure: true, sameSite: 'none', maxAge: 15 * 60 * 1000
        })
        res.cookie('Refresh', refreshToken, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 })
    }

}
