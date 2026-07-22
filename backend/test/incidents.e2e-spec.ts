import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('IncidentsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdChuteId: string;
  let createdIncidentId: string;
  let loggedInUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Authenticate
    await request(app.getHttpServer())
      .post('/auth/request-otp')
      .send({ phone: '9391888104' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: '9391888104', otp: '123456' });
    authToken = loginRes.body.accessToken;
    loggedInUserId = loginRes.body.user._id;

    // Create a mock plant and chute first to link the incident to
    const plantRes = await request(app.getHttpServer())
      .post('/industry/plants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Incident Test Plant',
        location: 'Vizag Port',
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    const chuteRes = await request(app.getHttpServer())
      .post('/industry/chutes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Chute Incident Link',
        plantId: plantRes.body._id,
        gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      });

    createdChuteId = chuteRes.body._id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Incident Creation & Listing', () => {
    it('should successfully report a new incident', async () => {
      const res = await request(app.getHttpServer())
        .post('/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chuteId: createdChuteId,
          title: 'Severe Material Flow Stagnation',
          description:
            'Zone 3 radar reports continuous distance under 0.4m. Air blast fails to clear.',
          severity: 'Critical',
        })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.title).toBe('Severe Material Flow Stagnation');
      expect(res.body.status).toBe('Open');
      createdIncidentId = res.body._id;
    });

    it('should list incidents with filters', () => {
      return request(app.getHttpServer())
        .get(`/incidents?chuteId=${createdChuteId}&severity=Critical`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].severity).toBe('Critical');
        });
    });

    it('should retrieve incident details and timeline', () => {
      return request(app.getHttpServer())
        .get(`/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body._id).toBe(createdIncidentId);
          expect(res.body).toHaveProperty('timeline');
          expect(res.body.timeline.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Incident Workflow States', () => {
    it('should update incident assignment and root cause notes', () => {
      return request(app.getHttpServer())
        .put(`/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assignedTo: loggedInUserId,
          rootCause: 'Sticking clay content due to heavy rain humidity',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should successfully escalate the incident', () => {
      return request(app.getHttpServer())
        .post(`/incidents/${createdIncidentId}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ note: 'Requires manual mechanical cleanout' })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.newStatus).toBe('Investigating');
        });
    });

    it('should successfully close the incident', () => {
      return request(app.getHttpServer())
        .post(`/incidents/${createdIncidentId}/close`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rootCause: 'Sticking clay content',
          correctionAction:
            'Manual cleanout performed, adjusted blast schedule',
          note: 'Chute cleared and flow restored to 1200 t/h',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });
});
