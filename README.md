# Nigha Radar Monorepo Deployment & Startup Guide

This repository contains the complete full-stack Nigha Radar Digital Twin & Industrial AI Blockage Prevention Platform:
1. **NestJS Backend**: High-performance API server, predictive AI engine, and MQTT telemetry consumer.
2. **React + Vite Frontend**: Digital Twin visualization, fleet analytics, and AI Copilot interface.
3. **Telemetry Simulator**: Simulates physical radar scans, compressor cycles, and solenoid valves.

---

## 1. Unified Environment Configuration

Both the backend and simulator are configured to read from a single, unified environment file (`.env`) located at the root of the repository.

1. Copy the template to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update the environment variables in `.env` as required (see Section 4 for details).

---

## 2. Infrastructure Setup & Quickstart

To run Nigha Radar locally, you need MongoDB and an MQTT Broker.

### 2.1. MongoDB
- **URI**: `mongodb://127.0.0.1:27017/nigha-chute`
- **Verification**: Ensure MongoDB is running locally on port `27017`.

### 2.2. MQTT Broker
- The system is pre-configured to connect to a secure cloud-hosted EMQX cluster on port `8883` over TLS.
- To set up and secure a custom local or cloud broker, see the [EMQX Configuration Guide](./emqx-configuration-guide.md).

---

## 3. Launching the Services

Navigate into the root repository folder and run the following commands to initialize and start all subsystems.

### 3.1. Start the Backend API
```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Build compiled distribution
npm run build

# Start production server (runs on port 5000)
npm run start:prod
```

### 3.2. Start the Frontend Web App
```bash
# Navigate to frontend folder
cd ../frontend

# Install dependencies
npm install

# Start Vite dev server (runs on port 5173)
npm run dev
```

### 3.3. Start the Telemetry Simulator
```bash
# Navigate to simulator folder
cd ../simulator

# Install dependencies
npm install

# Start simulator loop
npm run start
```

---

## 4. Discovered Configuration Map

| Variable Name | Component | Description | Fallback Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Backend | Port NestJS HTTP server binds to. | `5000` |
| `MONGODB_URI` | Backend | Database connection URI. | `mongodb://127.0.0.1:27017/nigha-chute` |
| `JWT_SECRET` | Backend | Signature key for auth tokens. | `nigha-radar-secret-key-12345` |
| `MQTT_BROKER_URL` | Backend/Simulator | Connection URL for MQTT TLS. | `mqtts://g292ae11.ala.asia-southeast1.emqxsl.com:8883` |
| `MQTT_BACKEND_USERNAME` | Backend | Dedicated NestJS broker account. | `pf086f1d` |
| `MQTT_BACKEND_PASSWORD` | Backend | Backend broker password. | `PrE_6sIGv9Efa0zQ` |
| `MQTT_SIMULATOR_USERNAME`| Simulator | Dedicated Simulator broker account. | `pf086f1d` |
| `MQTT_SIMULATOR_PASSWORD`| Simulator | Simulator broker password. | `PrE_6sIGv9Efa0zQ` |
| `VITE_API_URL` | Frontend | Target API endpoint for the web app. | `http://localhost:5000` |
