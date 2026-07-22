import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('IndustryController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdPlantId: string;
  let createdChuteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Acquire authentication token via dev backdoor
    await request(app.getHttpServer())
      .post('/auth/request-otp')
      .send({ phone: '9391888104' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: '9391888104', otp: '123456' }); // Super Admin user
    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Plants Operations', () => {
    it('should retrieve list of plants', () => {
      return request(app.getHttpServer())
        .get('/industry/plants')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should successfully create a new industrial plant', async () => {
      const res = await request(app.getHttpServer())
        .post('/industry/plants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Hardened Plant',
          location: 'Nevada Desert Sector G',
          gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
        })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Test Hardened Plant');
      createdPlantId = res.body._id;
    });
  });

  describe('Chutes & Telemetry Operations', () => {
    it('should successfully create a new chute in the plant', async () => {
      const res = await request(app.getHttpServer())
        .post('/industry/chutes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Main Conveyor Chute Alpha',
          plantId: createdPlantId,
          materialType: 'coal',
          criticalLevel: 80,
          gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
        })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Main Conveyor Chute Alpha');
      createdChuteId = res.body._id;
    });

    it('should list chutes filtering by plantId', () => {
      return request(app.getHttpServer())
        .get(`/industry/chutes?plantId=${createdPlantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].plantId).toBe(createdPlantId);
        });
    });

    it('should retrieve full chute detail including radars and compressor', () => {
      return request(app.getHttpServer())
        .get(`/industry/chutes/${createdChuteId}/detail`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('chute');
          expect(res.body).toHaveProperty('radars');
          expect(res.body).toHaveProperty('compressor');
          expect(res.body.radars.length).toBe(4);
          expect(res.body.chute.name).toBe('Main Conveyor Chute Alpha');
        });
    });
  });

  describe('Hardware manual triggers & OPC-UA configs', () => {
    it('should successfully dispatch manual air blast command', () => {
      return request(app.getHttpServer())
        .post(`/industry/chutes/${createdChuteId}/blast`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ blasterNumber: 1 })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toContain('Manual blast command published');
        });
    });

    it('should save and retrieve plant OPC-UA configuration mappings', async () => {
      // Save
      await request(app.getHttpServer())
        .post(`/industry/opc-ua/${createdPlantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          endpointUrl: 'opc.tcp://192.168.12.100:4840',
          namespaceUri: 'urn:nigha-plc:chute-alpha',
          registerMappings: {
            radar1: 'ns=2;s=Chute1.RadarDistance1',
            compressorTemp: 'ns=2;s=Compressor.MotorTemperature',
          },
          isActive: true,
        })
        .expect(201);

      // Retrieve
      await request(app.getHttpServer())
        .get(`/industry/opc-ua/${createdPlantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.endpointUrl).toBe('opc.tcp://192.168.12.100:4840');
          expect(res.body.registerMappings).toHaveProperty('radar1');
        });
    });
  });
});
