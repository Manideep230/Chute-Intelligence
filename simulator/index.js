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

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtts://g292ae11.ala.asia-southeast1.emqxsl.com:8883';
const DEFAULT_DISTANCES = [3.5, 3.4, 3.6, 3.5];

let token = '';
const simulators = [];

class ChuteSimulator {
  constructor(chuteId, chuteName) {
    this.chuteId = chuteId;
    this.chuteName = chuteName;
    this.mqttClient = null;
    this.hasSubscribed = false;
    this.processedSignatures = new Set();
    
    this.radarDistances = [...DEFAULT_DISTANCES];
    this.manualOverrideZones = new Set();
    
    this.compressorPressure = 110;
    this.compressorRefilling = false;
    this.compressorTemp = 28;
    this.runtimeHours = 120.4;
    this.refillFrequency = 1.5;
    
    this.intervals = [];
  }

  connectMqtt() {
    const username = process.env.MQTT_SIMULATOR_USERNAME || 'pf086f1d';
    const password = process.env.MQTT_SIMULATOR_PASSWORD || 'PrE_6sIGv9Efa0zQ';

    console.log(`[Chute ${this.chuteName}] Connecting to MQTT broker at ${MQTT_BROKER}...`);
    this.mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `sim_${this.chuteId.slice(-6)}_${Math.random().toString(16).substring(2, 6)}`,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 5000,
      username,
      password
    });

    this.mqttClient.on('connect', () => {
      const time = new Date().toISOString();
      if (!this.hasSubscribed) {
        console.log(`[${time}] [Chute ${this.chuteName}] MQTT Connected. Subscribing to command...`);
        this.mqttClient.subscribe(`nigha/chute/${this.chuteId}/command`, { qos: 1 });
        this.hasSubscribed = true;
      }
    });

    this.mqttClient.on('message', (topic, payload) => {
      let data;
      try {
        data = JSON.parse(payload.toString());
      } catch (e) {
        console.error(`[MQTT ERROR] Failed to parse payload: ${e.message}`);
        return;
      }

      console.log(`[MQTT COMMAND] [Chute ${this.chuteName}] Command:`, data.action);

      // Execute command
      if (data.action === 'blast') {
        let group = data.blastGroup || data.blasterNumber || 1;
        let valves = data.solenoidValves || [group * 2 - 1, group * 2];
        this.executeBlast(group, valves, data.commandId);
      } else if (data.action === 'override_radar') {
        const zIdx = data.zone - 1;
        if (zIdx >= 0 && zIdx < 4) {
          this.radarDistances[zIdx] = data.distance;
          if (data.distance < 1.0) {
            this.manualOverrideZones.add(zIdx);
            console.log(`[MANUAL OVERRIDE] [Chute ${this.chuteName}] Zone ${data.zone} locked at ${data.distance}m.`);
          } else {
            this.manualOverrideZones.delete(zIdx);
          }
        }
      }
    });
  }

  executeBlast(blasterNumber, solenoidValves, commandId) {
    console.log(`>>> [Chute ${this.chuteName}] EXECUTING BLAST SEQUENCE: Blaster #${blasterNumber}, Valves: ${solenoidValves.join(', ')}`);

    if (this.compressorPressure < 80) {
      console.log(`!!! [Chute ${this.chuteName}] BLAST ABORTED: Low pressure (${this.compressorPressure.toFixed(0)} PSI)`);
      this.mqttClient.publish(`nigha/chute/${this.chuteId}/blast`, JSON.stringify({
        commandId,
        blasterNumber,
        solenoidValves,
        success: false,
        reason: 'Insufficient compressor pressure'
      }));
      return;
    }

    this.compressorPressure -= 18;
    this.mqttClient.publish(`nigha/chute/${this.chuteId}/blast`, JSON.stringify({
      commandId,
      blasterNumber,
      solenoidValves,
      success: true
    }));

    const zoneIndex = blasterNumber - 1;
    if (zoneIndex >= 0 && zoneIndex < 4) {
      this.radarDistances[zoneIndex] = DEFAULT_DISTANCES[zoneIndex];
      this.manualOverrideZones.delete(zoneIndex);
    }
  }

  startSimulation() {
    this.intervals.push(setInterval(() => this.simulateRadar(), 3000));
    this.intervals.push(setInterval(() => this.simulateEnvironment(), 5000));
    this.intervals.push(setInterval(() => this.simulateCompressor(), 2000));
    this.intervals.push(setInterval(() => this.simulateGps(), 15000));
  }

  simulateRadar() {
    for (let i = 0; i < 4; i++) {
      if (!this.manualOverrideZones.has(i)) {
        const drift = (Math.random() - 0.5) * 0.06;
        this.radarDistances[i] = Math.max(3.1, Math.min(3.9, DEFAULT_DISTANCES[i] + drift));
      }
    }
    this.radarDistances.forEach((dist, idx) => {
      this.mqttClient.publish(`nigha/chute/${this.chuteId}/radar`, JSON.stringify({
        zone: idx + 1,
        distance: Number(dist.toFixed(2)),
        buildupDetected: dist < 1.0
      }));
    });
  }

  simulateEnvironment() {
    const temp = 30 + Math.sin(Date.now() / 100000) * 4 + Math.random() * 0.8;
    const humidity = 44 + Math.cos(Date.now() / 100000) * 10 + Math.random() * 2;
    this.mqttClient.publish(`nigha/chute/${this.chuteId}/temperature`, JSON.stringify({ value: Number(temp.toFixed(1)) }));
    this.mqttClient.publish(`nigha/chute/${this.chuteId}/humidity`, JSON.stringify({ value: Number(humidity.toFixed(1)) }));
  }

  simulateCompressor() {
    this.runtimeHours += 0.001;
    if (this.compressorPressure < 90 && !this.compressorRefilling) {
      this.compressorRefilling = true;
      this.refillFrequency = Math.min(8, this.refillFrequency + 0.1);
      console.log(`--- [Chute ${this.chuteName}] Compressor low (${this.compressorPressure.toFixed(0)} PSI). Refilling... ---`);
    }

    if (this.compressorRefilling) {
      this.compressorPressure += 4;
      this.compressorTemp = Math.min(85, this.compressorTemp + 1.8);
      if (this.compressorPressure >= 110) {
        this.compressorPressure = 110;
        this.compressorRefilling = false;
      }
    } else {
      this.compressorTemp = Math.max(28, this.compressorTemp - 0.5);
      this.compressorPressure = Math.max(this.compressorPressure - 0.05, 0);
    }

    this.mqttClient.publish(`nigha/chute/${this.chuteId}/compressor`, JSON.stringify({
      pressure: Number(this.compressorPressure.toFixed(1)),
      runtimeHours: Number(this.runtimeHours.toFixed(3)),
      refillDuration: 42,
      refillFrequency: Number(this.refillFrequency.toFixed(1)),
      motorTemperature: Number(this.compressorTemp.toFixed(1)),
      efficiency: this.compressorTemp > 75 ? 92 : 98,
      healthScore: this.compressorTemp > 80 ? 85 : 100
    }));

    this.mqttClient.publish(`nigha/chute/${this.chuteId}/health`, JSON.stringify({
      isOnline: true,
      localLogsCount: 0
    }));
  }

  simulateGps() {
    const lat = 36.1705 + (Math.random() - 0.5) * 0.0001;
    const lng = -115.1402 + (Math.random() - 0.5) * 0.0001;
    this.mqttClient.publish(`nigha/chute/${this.chuteId}/location`, JSON.stringify({
      latitude: lat,
      longitude: lng
    }));
  }

  stop() {
    this.intervals.forEach(clearInterval);
    if (this.mqttClient) this.mqttClient.end(true);
  }
}

async function bootstrap() {
  console.log('=== NIGHA RADAR SIMULATOR STARTING ===');
  console.log('MODE: Multi-Instance Orchestration');

  await login();
  await runSimulators();
}

async function login() {
  console.log('Authenticating with backend...');
  try {
    const res = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+918888888888',
        otp: process.env.DEMO_OTP || '778899'
      })
    });

    if (!res.ok) throw new Error(`Login failed with status ${res.status}`);
    const data = await res.json();
    token = data.accessToken;
    console.log(`Successfully logged in. Actor: ${data.user.name}`);
  } catch (err) {
    console.error('Login request failed. Retrying in 5 seconds...', err.message);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return login();
  }
}

async function runSimulators() {
  console.log('Fetching active industrial chutes...');
  try {
    const res = await fetch(`${BACKEND_URL}/industry/chutes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
    const chutesList = await res.json();

    if (chutesList.length === 0) {
      console.log('No chutes seeded yet. Retrying in 5 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return runSimulators();
    }

    const targetChuteId = process.env.CHUTE_ID;
    const itemsToSimulate = targetChuteId 
      ? chutesList.filter(c => c._id === targetChuteId)
      : chutesList;

    if (itemsToSimulate.length === 0) {
      console.log(`Chute ID ${targetChuteId} not found in seeded list. Simulating all.`);
    }

    const finalChutes = itemsToSimulate.length > 0 ? itemsToSimulate : chutesList;

    finalChutes.forEach(chute => {
      console.log(`Initializing Simulator Instance: Chute ${chute.name} (ID: ${chute._id})`);
      const sim = new ChuteSimulator(chute._id, chute.name);
      sim.connectMqtt();
      sim.startSimulation();
      simulators.push(sim);
    });
  } catch (err) {
    console.error('Failed to initialize simulators. Retrying in 5 seconds...', err.message);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return runSimulators();
  }
}

bootstrap();
