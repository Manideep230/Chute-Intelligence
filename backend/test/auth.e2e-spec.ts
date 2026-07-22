import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Register cookie-parser to parse refresh token cookies in E2E tests
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OTP Login Flow', () => {
    it('should request an OTP code successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/request-otp')
        .send({ phone: '9391888104' })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('OTP sent successfully');
        });
    });

    it('should fail verifying with an incorrect OTP code', () => {
      return request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ phone: '9391888104', otp: '000000' })
        .expect(401);
    });

    it('should successfully login via the dev backdoor OTP (939188)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/verify-otp')
        .send({ phone: '9391888104', otp: '939188' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.phone).toBe('9391888104');

      authToken = res.body.accessToken;

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookiesArray = Array.isArray(cookies) ? cookies : [cookies];
      const refreshMatch = cookiesArray.find(
        (c: string) => c && c.startsWith('ng_refresh='),
      );
      expect(refreshMatch).toBeDefined();
      refreshCookie = refreshMatch!.split(';')[0];
    });
  });

  describe('Session Management & Refresh', () => {
    it('should successfully rotate refresh tokens and get a new access token', async () => {
      // Wait 1 second to ensure iat (issued at) changes so we get a different JWT token signature
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.accessToken).not.toBe(authToken);

      authToken = res.body.accessToken;

      // Capture the rotated refresh token
      const cookies = res.headers['set-cookie'];
      const cookiesArray = Array.isArray(cookies) ? cookies : [cookies];
      const refreshMatch = cookiesArray.find(
        (c: string) => c && c.startsWith('ng_refresh='),
      );
      refreshCookie = refreshMatch ? refreshMatch.split(';')[0] : '';
    });

    it('should successfully access a protected route with the new access token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.phone).toBe('9391888104');
        });
    });

    it('should successfully logout and revoke the session', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', [refreshCookie])
        .expect(201);

      // Verify that using the old refresh token cookie now fails
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [refreshCookie])
        .expect(401);
    });
  });
});
