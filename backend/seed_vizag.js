const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nigha-chute';

console.log('Connecting to database:', mongoUri);

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Connected to MongoDB.');
    await seedVizag();
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });

async function seedVizag() {
  const db = mongoose.connection.db;

  // 1. Get default Organization and Region
  const org = await db.collection('organizations').findOne({ domain: 'holcim.com' });
  const region = await db.collection('regions').findOne({ name: 'APAC' });

  const orgId = org ? org._id : null;
  const regionId = region ? region._id : null;

  // 2. Create Vizag Steel Plant if it doesn't exist
  let plant = await db.collection('plants').findOne({ name: 'Vizag Steel Plant' });
  if (!plant) {
    console.log('Creating Vizag Steel Plant...');
    const result = await db.collection('plants').insertOne({
      name: 'Vizag Steel Plant',
      location: 'Visakhapatnam, India',
      gpsCoordinates: { lat: 17.6258, lng: 83.1557 },
      description: 'Integrated steel producer facility in Visakhapatnam, Andhra Pradesh, India.',
      organizationId: orgId,
      regionId: regionId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    plant = { _id: result.insertedId, name: 'Vizag Steel Plant' };
  } else {
    console.log('Vizag Steel Plant already exists.');
  }

  // 3. Define 5 Chutes to add
  const chutesToSeed = [
    { name: 'Vizag RMHS Chute #1', materialType: 'iron_ore', lat: 17.6260, lng: 83.1560 },
    { name: 'Vizag RMHS Chute #2', materialType: 'coal', lat: 17.6265, lng: 83.1565 },
    { name: 'Vizag Sinter Plant Chute #1', materialType: 'limestone', lat: 17.6270, lng: 83.1570 },
    { name: 'Vizag Blast Furnace #1 Feed Chute', materialType: 'iron_ore', lat: 17.6250, lng: 83.1550 },
    { name: 'Vizag Blast Furnace #2 Feed Chute', materialType: 'coal', lat: 17.6245, lng: 83.1545 }
  ];

  for (const chuteInfo of chutesToSeed) {
    let chute = await db.collection('chutes').findOne({ name: chuteInfo.name, plantId: plant._id });
    if (!chute) {
      console.log(`Seeding chute: ${chuteInfo.name}...`);
      const result = await db.collection('chutes').insertOne({
        name: chuteInfo.name,
        plantId: plant._id,
        gpsCoordinates: { lat: chuteInfo.lat, lng: chuteInfo.lng },
        status: 'Normal',
        totalBlasts: 0,
        consecutiveFailedBlasts: 0,
        materialType: chuteInfo.materialType,
        lastSyncTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const chuteId = result.insertedId;

      // Seed 4 radars
      for (let i = 1; i <= 4; i++) {
        await db.collection('radars').insertOne({
          chuteId,
          zone: i,
          distance: i === 1 ? 3.5 : i === 2 ? 3.4 : i === 3 ? 3.6 : 3.5,
          buildupDetected: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Seed 4 air blasters
      for (let i = 1; i <= 4; i++) {
        await db.collection('airblasters').insertOne({
          chuteId,
          blasterNumber: i,
          totalBlasts: 0,
          lifespanBlasts: 20000,
          healthScore: 100,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Seed 8 solenoids
      for (let i = 1; i <= 8; i++) {
        await db.collection('solenoids').insertOne({
          chuteId,
          valveNumber: i,
          totalCycles: 0,
          lifespanCycles: 50000,
          healthScore: 100,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // Seed 1 compressor
      await db.collection('compressors').insertOne({
        chuteId,
        pressure: 110,
        runtimeHours: 120,
        refillDuration: 42,
        refillFrequency: 1.5,
        motorTemperature: 32,
        efficiency: 99,
        healthScore: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Seed hub health
      await db.collection('hubhealths').insertOne({
        chuteId,
        isOnline: true,
        localLogsCount: 0,
        lastPing: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Seed AI predictions
      await db.collection('aipredictions').insertOne({
        chuteId,
        blockageProbability: 5,
        compressorFailureProbability: 2,
        solenoidWearProbability: 0,
        airBlasterMaintenanceProbability: 0,
        recommendedActions: ['System Operating Normally.'],
        buildupRatePerMin: 0,
        overallTrend: 'stable',
        lastBlastEffectivenessScore: -1,
        consecutiveFailedBlasts: 0,
        uptimePercent24h: 100,
        blockageMinutesToday: 0,
        airLitresToday: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Audit Log entry
      await db.collection('auditlogs').insertOne({
        action: 'Chute Creation',
        details: `Seeded chute ${chuteInfo.name} in Vizag Steel Plant via script`,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`Finished seeding hardware components for chute: ${chuteInfo.name}`);
    } else {
      console.log(`Chute ${chuteInfo.name} already exists.`);
    }
  }
}
