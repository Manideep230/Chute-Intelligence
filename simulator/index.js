import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Robust local .env file loader for the simulator
function loadEnv() {
  try {
    let envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
      envPath = path.resolve(__dirname, '../.env'); // Look in the workspace root
    }
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const index = trimmed.indexOf('=');
          if (index !== -1) {
            const key = trimmed.substring(0, index).trim();
            let val = trimmed.substring(index + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    console.warn('Warning: Failed to load .env file:', err.message);
  }
}
loadEnv();

const BACKEND_URL = 'http://localhost:5000';
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtts://g292ae11.ala.asia-southeast1.emqxsl.com:8883';

let token = '';
let chuteId = '';
let mqttClient = null;
let hasSubscribed = false; // Guard against duplicate subscriptions on reconnect
const processedSignatures = new Set();

// ─── RADAR STATE ──────────────────────────────────────────────────────────────
// Production mode: sensors drift slightly around baseline distances (no automatic blockages)
// Blockages are ONLY introduced via:
//   1. override_radar MQTT command (Manual/Simulation Mode from dashboard)
//   2. Real PLC/Edge Gateway hardware in production
const DEFAULT_DISTANCES = [3.5, 3.4, 3.6, 3.5]; // Baseline clear-chute distances per zone
let radarDistances = [...DEFAULT_DISTANCES];

// Track which zones are in manual override (frozen until blast clears or override is removed)
const manualOverrideZones = new Set();

// ─── COMPRESSOR STATE ─────────────────────────────────────────────────────────
let compressorPressure = 110;
let compressorRefilling = false;
let compressorTemp = 28;
let runtimeHours = 120.4;
let refillFrequency = 1.5;

async function bootstrap() {
  console.log('=== NIGHA RADAR SIMULATOR STARTING ===');
  console.log('MODE: Production — Radar Localization Engine Active');
  console.log('NOTE: No automatic blockages. Blockages via manual override only.');

  // 1. Authenticate with backend
  await login();

  // 2. Fetch chutes
  await fetchChute();

  // 3. Connect to MQTT
  connectMqtt();

  // 4. Start Simulation loops
  startSimulation();
}

async function login() {
  console.log('Authenticating with backend...');
  try {
    const res = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+918888888888', // Worker User
        otp: '123456'          // Dev backdoor
      })
    });

    if (!res.ok) {
      throw new Error(`Login failed with status ${res.status}`);
    }

    const data = await res.json();
    token = data.accessToken;
    console.log(`Successfully logged in. Token acquired. Actor: ${data.user.name}`);
  } catch (err) {
    console.error('Login request failed. Retrying in 5 seconds...', err.message);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return login();
  }
}

async function fetchChute() {
  console.log('Fetching active industrial chutes...');
  try {
    const res = await fetch(`${BACKEND_URL}/industry/chutes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.length === 0) {
      console.log('No chutes seeded yet. Retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return fetchChute();
    }

    chuteId = data[0]._id;
    console.log(`Target Chute identified: ${data[0].name} (ID: ${chuteId})`);
  } catch (err) {
    console.error('Fetch Chute failed. Retrying in 5 seconds...', err.message);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return fetchChute();
  }
}

function connectMqtt() {
  const username = process.env.MQTT_SIMULATOR_USERNAME || 'pf086f1d';
  const password = process.env.MQTT_SIMULATOR_PASSWORD || 'PrE_6sIGv9Efa0zQ';

  console.log(`Connecting to MQTT broker at ${MQTT_BROKER}...`);
  mqttClient = mqtt.connect(MQTT_BROKER, {
    clientId: `simulator_${chuteId}_${Math.random().toString(16).substring(2, 8)}`,
    keepalive: 60,
    clean: true,         // Clean session to avoid stale subscriptions
    reconnectPeriod: 5000, // 5 seconds between reconnect attempts
    username,
    password
  });

  mqttClient.on('connect', () => {
    const time = new Date().toISOString();
    if (!hasSubscribed) {
      console.log(`[${time}] MQTT Connected. Setting up command subscriptions...`);
      mqttClient.subscribe(`nigha/chute/${chuteId}/command`, { qos: 1 });
      console.log(`Subscribed to: nigha/chute/${chuteId}/command`);
      hasSubscribed = true;
    } else {
      console.log(`[${time}] MQTT Reconnected to broker.`);
      mqttClient.subscribe(`nigha/chute/${chuteId}/command`, { qos: 1 });
    }
  });

  mqttClient.on('message', (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch (e) {
      console.error(`[MQTT ERROR] Failed to parse payload: ${e.message}`);
      return;
    }

    console.log(`[MQTT COMMAND RECEIVED] Topic: ${topic}, Command:`, data);

    // 1. Command Replay Protection
    const now = Date.now();
    const commandTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;

    if (!data.timestamp || isNaN(commandTime)) {
      console.warn(`[REPLAY PROTECTION] Command rejected: Missing or invalid timestamp.`);
      return;
    }

    const ageMs = now - commandTime;
    if (ageMs > 5000 || ageMs < -5000) {
      console.warn(`[REPLAY PROTECTION] Command rejected: Command is too old or clock skew is too high. Age: ${(ageMs / 1000).toFixed(2)}s`);
      return;
    }

    // 2. Duplicate Message Protection
    const signature = `${data.action || ''}_${data.blastGroup || data.blasterNumber || ''}_${JSON.stringify(data.solenoids || data.solenoidValves || [])}_${data.timestamp}`;
    if (processedSignatures.has(signature)) {
      console.warn(`[DUPLICATE PROTECTION] Command rejected: Duplicate message signature detected.`);
      return;
    }
    processedSignatures.add(signature);
    setTimeout(() => {
      processedSignatures.delete(signature);
    }, 15000);

    // Execute command
    if (data.action === 'blast') {
      // Support both group-based (solenoids: ["S1A","S1B","S1C","S1D"]) and legacy valve-based formats
      let group = data.blastGroup || data.blasterNumber || 1;
      let valves = [];

      if (data.solenoids && data.solenoids.length > 0) {
        // New 4-solenoid group format: ["S3A","S3B","S3C","S3D"]
        valves = data.solenoids.map(s => {
          const match = s.match(/S(\d)([A-D])/i);
          if (match) {
            const g = parseInt(match[1]);
            const letter = match[2].toUpperCase();
            const letterMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
            // Map group+letter to physical valve number: Group 1 = valves 1-4, Group 2 = valves 3-6, etc.
            // Simplified: Group N → valves (N-1)*2+1, (N-1)*2+2, but 4-solenoid group wraps within 8 total
            const base = ((g - 1) % 4) * 2;
            const letterOffset = letterMap[letter] <= 2 ? letterMap[letter] : letterMap[letter] - 2;
            return (base + letterOffset - 1) % 8 + 1;
          }
          const svMatch = s.match(/SV(\d)/i);
          if (svMatch) return parseInt(svMatch[1]);
          return 1;
        });
      } else {
        // Legacy: solenoidValves array or fallback to group pair
        valves = data.solenoidValves || [group * 2 - 1, group * 2];
      }
      executeBlast(group, valves, data.commandId);

    } else if (data.action === 'override_radar') {
      // Manual override: sets a specific zone to a specific distance
      // This is the ONLY way to inject blockage conditions
      const zIdx = data.zone - 1;
      if (zIdx >= 0 && zIdx < 4) {
        radarDistances[zIdx] = data.distance;

        if (data.distance < 1.0) {
          // Blockage injected — freeze this zone in manual override mode
          manualOverrideZones.add(zIdx);
          console.log(`[MANUAL OVERRIDE] Zone ${data.zone} locked at ${data.distance}m (BLOCKAGE INJECTED).`);
          // NOTE: Alert generation is the backend's responsibility. Simulator only publishes telemetry.
        } else {
          // Zone cleared — unfreeze
          manualOverrideZones.delete(zIdx);
          const allClear = radarDistances.every((dist) => dist >= 1.0);
          if (allClear) {
            console.log(`[MANUAL OVERRIDE] Zone ${data.zone} cleared. All zones normal. Resuming drift simulation.`);
          } else {
            console.log(`[MANUAL OVERRIDE] Zone ${data.zone} cleared to ${data.distance}m. Other overrides still active.`);
          }
        }
      }
    }
  });

  mqttClient.on('reconnect', () => {
    console.log(`[${new Date().toISOString()}] MQTT attempting reconnect...`);
  });

  mqttClient.on('offline', () => {
    console.log(`[${new Date().toISOString()}] MQTT client went offline.`);
    hasSubscribed = false; // Reset so we re-subscribe on reconnect
  });

  mqttClient.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] MQTT connection error:`, err.message);
  });
}

function executeBlast(blasterNumber, solenoidValves, commandId) {
  console.log(`>>> EXECUTING BLAST SEQUENCE: Blaster/Group #${blasterNumber}, Valves: ${solenoidValves.join(', ')}`);

  // Compressor protection cutoff: minimum 80 PSI required
  if (compressorPressure < 80) {
    console.log(`!!! BLAST ABORTED: Insufficient pressure (${compressorPressure.toFixed(0)} PSI < 80 PSI threshold)`);

    mqttClient.publish(`nigha/chute/${chuteId}/blast`, JSON.stringify({
      commandId,
      blasterNumber,
      solenoidValves,
      success: false,
      reason: 'Insufficient compressor pressure'
    }));
    return;
  }

  // 1. Consume air pressure (18 PSI per blast)
  compressorPressure -= 18;
  if (compressorPressure < 0) compressorPressure = 0;

  // 2. Publish Success blast event
  mqttClient.publish(`nigha/chute/${chuteId}/blast`, JSON.stringify({
    commandId,
    blasterNumber,
    solenoidValves,
    success: true
  }));

  // 3. Clear the radar readings for the zone corresponding to this blaster group
  //    and remove manual override so drift resumes
  const zoneIndex = blasterNumber - 1;
  if (zoneIndex >= 0 && zoneIndex < 4) {
    radarDistances[zoneIndex] = DEFAULT_DISTANCES[zoneIndex];
    manualOverrideZones.delete(zoneIndex);
  }
  console.log(`*** ZONE ${blasterNumber} CLEARANCE CONFIRMED. Radar distance reset to ${DEFAULT_DISTANCES[zoneIndex] || 3.5}m.`);

  // Check if all zones are now clear (backend will detect this from radar telemetry)
  const allClear = radarDistances.every((dist) => dist >= 1.0);
  if (allClear) {
    console.log('--- All zones clear. System operating normally. ---');
  }
}

function startSimulation() {
  // Loop 1: Radar Scans (every 3s)
  setInterval(() => {
    simulateRadar();
  }, 3000);

  // Loop 2: Environmental Sensors (every 5s)
  setInterval(() => {
    simulateEnvironment();
  }, 5000);

  // Loop 3: Compressor depletion/refill (every 2s)
  setInterval(() => {
    simulateCompressor();
  }, 2000);

  // Loop 4: GPS Coordinates (every 15s)
  setInterval(() => {
    simulateGps();
  }, 15000);
}

function simulateRadar() {
  // ─── PRODUCTION RADAR BEHAVIOR ─────────────────────────────────────────────
  // Sensors drift ±0.03m around their baseline distances.
  // Manual override zones are held frozen (no drift) until cleared.
  // NO automatic blockage generation. The real chute radar drives real readings.
  for (let i = 0; i < 4; i++) {
    if (!manualOverrideZones.has(i)) {
      // Free-running drift: ±0.03m gaussian-like noise around baseline
      const drift = (Math.random() - 0.5) * 0.06;
      radarDistances[i] = Math.max(3.1, Math.min(3.9, DEFAULT_DISTANCES[i] + drift));
    }
    // If zone is in manual override, radarDistances[i] stays frozen at injected value
  }

  // Publish all zone radar readings
  radarDistances.forEach((dist, idx) => {
    const buildupDetected = dist < 1.0;
    mqttClient.publish(`nigha/chute/${chuteId}/radar`, JSON.stringify({
      zone: idx + 1,
      distance: Number(dist.toFixed(2)),
      buildupDetected
    }));
  });
}

function simulateEnvironment() {
  // Realistic fluctuating temperatures ~32°C, humidity ~45%
  const temp = 30 + Math.sin(Date.now() / 100000) * 4 + Math.random() * 0.8;
  const humidity = 44 + Math.cos(Date.now() / 100000) * 10 + Math.random() * 2;

  mqttClient.publish(`nigha/chute/${chuteId}/temperature`, JSON.stringify({ value: Number(temp.toFixed(1)) }));
  mqttClient.publish(`nigha/chute/${chuteId}/humidity`, JSON.stringify({ value: Number(humidity.toFixed(1)) }));
}

function simulateCompressor() {
  runtimeHours += 0.001;

  if (compressorPressure < 90 && !compressorRefilling) {
    compressorRefilling = true;
    refillFrequency = Math.min(8, refillFrequency + 0.1); // Increment refill frequency
    console.log(`--- Compressor pressure low (${compressorPressure.toFixed(0)} PSI). Activating refill... ---`);
    // NOTE: Compressor alerts are generated by the backend AI engine from telemetry data. Simulator does not alert.
  }

  if (compressorRefilling) {
    compressorPressure += 4;
    compressorTemp = Math.min(85, compressorTemp + 1.8); // Motor heats during refill

    if (compressorPressure >= 110) {
      compressorPressure = 110;
      compressorRefilling = false;
      console.log('--- Compressor refill complete. Motor cooling. ---');
      // NOTE: Backend detects pressure restoration from compressor telemetry stream.
    }
  } else {
    // Passive thermal cooling when idle
    compressorTemp = Math.max(28, compressorTemp - 0.5);
    // Slight natural depletion (leakage)
    compressorPressure = Math.max(compressorPressure - 0.05, 0);
  }

  const efficiency = compressorTemp > 75 ? 92 : compressorTemp > 60 ? 95 : 98;
  const healthScore = compressorTemp > 80 ? 85 : 100;

  mqttClient.publish(`nigha/chute/${chuteId}/compressor`, JSON.stringify({
    pressure: Number(compressorPressure.toFixed(1)),
    runtimeHours: Number(runtimeHours.toFixed(3)),
    refillDuration: 42,
    refillFrequency: Number(refillFrequency.toFixed(1)),
    motorTemperature: Number(compressorTemp.toFixed(1)),
    efficiency,
    healthScore
  }));

  // Ping hub health status
  mqttClient.publish(`nigha/chute/${chuteId}/health`, JSON.stringify({
    isOnline: true,
    localLogsCount: 0
  }));
}

function simulateGps() {
  // Plant location – Nevada industrial zone
  const lat = 36.1705 + (Math.random() - 0.5) * 0.0001;
  const lng = -115.1402 + (Math.random() - 0.5) * 0.0001;

  mqttClient.publish(`nigha/chute/${chuteId}/location`, JSON.stringify({
    latitude: lat,
    longitude: lng
  }));
}

function publishAlert(severity, source, message, isResolved = false) {
  if (!mqttClient || !mqttClient.connected) return;

  mqttClient.publish(`nigha/chute/${chuteId}/alert`, JSON.stringify({
    severity,
    source,
    message,
    isResolved
  }));
}

bootstrap();
