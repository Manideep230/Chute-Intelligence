import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminController } from './admin.controller';
import { JwtStrategy } from './jwt.strategy';
import { DatabaseModule } from '../database/database.module';
import { MultiTenantGuard } from './multi-tenant.guard';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'nigha-radar-secret-key-12345',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy, MultiTenantGuard],
  controllers: [AuthController, AdminController],
  exports: [AuthService, JwtStrategy, PassportModule, MultiTenantGuard],
})
export class AuthModule {}
