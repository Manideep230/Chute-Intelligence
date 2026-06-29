import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AdminController (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Log in as Super Admin to get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: '+919999999999', otp: '123456' })
      .expect(201);

    superAdminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully reset the database', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/reset-database')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ confirm: true, confirmPhrase: 'RESET' });

    console.log('RESET DB RESPONSE:', res.status, res.body);
    expect(res.status).toBe(200);
  });
});
