import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useTelemetryStore } from '../../../store/telemetryStore';
import { useAuthStore } from '../../../store/authStore';

/**
 * Manages the full MQTT WebSocket lifecycle: connect, subscribe to all
 * chute topics, handle incoming messages, and clean up on chute change.
 *
 * Extracted from Dashboard.tsx lines 483-574.
 */
export function useMqttConnection(activeChuteId: string | null) {
  const {
    setMqttConnected, updateRadarData, updateCompressorData,
    updateStatus, addAlert, setActiveBlasterNumber,
    setActiveSolenoidValves, updateEnvironmental, updateLocation,
  } = useTelemetryStore();

  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    if (!activeChuteId) return;

    const client = mqtt.connect('wss://g292ae11.ala.asia-southeast1.emqxsl.com:8084/mqtt', {
      clientId: `dashboard_${Math.random().toString(16).substr(2, 8)}`,
      keepalive: 60,
      username: 'pf086f1d',
      password: 'PrE_6sIGv9Efa0zQ',
      protocol: 'wss',
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
    });

    mqttClientRef.current = client;

    client.on('connect', () => {
      setMqttConnected(true);
      // Legacy topics
      client.subscribe(`nigha/chute/${activeChuteId}/radar`);
      client.subscribe(`nigha/chute/${activeChuteId}/temperature`);
      client.subscribe(`nigha/chute/${activeChuteId}/humidity`);
      client.subscribe(`nigha/chute/${activeChuteId}/compressor`);
      client.subscribe(`nigha/chute/${activeChuteId}/alert`);
      client.subscribe(`nigha/chute/${activeChuteId}/health`);
      client.subscribe(`nigha/chute/${activeChuteId}/location`);
      client.subscribe(`nigha/chute/${activeChuteId}/command`);
      client.subscribe(`nigha/chute/${activeChuteId}/blast`);
      client.subscribe(`nigha/chute/${activeChuteId}/localization`);
      client.subscribe(`nigha/chute/${activeChuteId}/prediction`);

      // Hierarchical topics (wildcard for this chute - e.g. domain/+/NGCH.../+/+/+/+/+/+)
      // Subscribe to any hierarchical messages for matching chutes
      client.subscribe(`domain/+/+/+/+/+/+/+/+`);

      // Refresh command list on reconnect/connect
      const token = useAuthStore.getState().token;
      useTelemetryStore.getState().fetchCommandsList(activeChuteId, token);
    });

    client.on('message', (topic, payload) => {
      let data: any;
      try {
        data = JSON.parse(payload.toString());
      } catch (e) {
        console.warn('[MQTT JSON Error]', e);
        return;
      }

      const parts = topic.split('/');
      let type = parts[3];

      if (parts[0] === 'domain') {
        type = parts[8]; // domain/{plantId}/{chute16DigitId}/{passName}/{passKey}/{simNumber}/{sabId}/{solenoidValve}/{action}
      }

      switch (type) {
        case 'radar':
          updateRadarData(data.zone, data.distance, data.buildupDetected);
          break;
        case 'telemetry':
          if (data.radarValues) {
            data.radarValues.forEach((dist: number, i: number) => {
              updateRadarData(i + 1, dist, dist < 1.0);
            });
          }
          if (data.temperature !== undefined) updateEnvironmental('temperature', data.temperature);
          if (data.humidity !== undefined) updateEnvironmental('humidity', data.humidity);
          if (data.pressure !== undefined) updateCompressorData({ pressure: data.pressure });
          if (data.latitude !== undefined && data.longitude !== undefined) {
            updateLocation(data.latitude, data.longitude);
          }
          break;
        case 'temperature':
          updateEnvironmental('temperature', data.value);
          break;
        case 'humidity':
          updateEnvironmental('humidity', data.value);
          break;
        case 'compressor':
          updateCompressorData(data);
          break;
        case 'location':
          updateLocation(data.latitude, data.longitude);
          break;
        case 'alert':
        case 'warning':
        case 'fault':
          if (!data.isResolved) addAlert(data);
          break;
        case 'localization':
          useTelemetryStore.getState().applyLocalization({
            activePath: data.activePath,
            simulationMode: data.simulationMode ?? false,
            blockagePosition: data.blockagePosition,
            blockageDistance: data.blockageDistance,
            nearestSolenoidGroup: data.nearestSolenoidGroup,
            status: data.status,
          });
          break;
        case 'prediction':
          useTelemetryStore.getState().updateAiPredictionData({
            blockageProbability: data.blockageProbability ?? 0,
            compressorFailureProbability: data.compressorFailureProbability ?? 0,
            solenoidWearProbability: data.solenoidWearProbability ?? 0,
            airBlasterMaintenanceProbability: data.airBlasterMaintenanceProbability ?? 0,
            recommendedActions: data.recommendedActions || [],
          });
          break;
        case 'blast':
        case 'command':
          if (data.success || data.status === 'COMPLETED' || data.status === 'EXECUTING') {
            updateStatus('Blasting');
            setActiveBlasterNumber(data.blasterNumber || data.sabNumber || 1);
            setActiveSolenoidValves(data.solenoidValves || data.solenoidNumbers || []);

            setTimeout(() => {
              setActiveBlasterNumber(null);
              setActiveSolenoidValves([]);
            }, 2500);
          }
          // Refresh commands list live when command status updates
          const currentToken = useAuthStore.getState().token;
          useTelemetryStore.getState().fetchCommandsList(activeChuteId, currentToken);
          break;
        default:
          break;
      }
    });

    client.on('close', () => setMqttConnected(false));
    client.on('error', (err) => console.warn('[MQTT]', err.message));

    return () => {
      mqttClientRef.current = null;
      client.end(true);
    };
  // Only reconnect when the active chute changes — store actions are stable Zustand refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChuteId]);

  return { mqttClientRef } as const;
}
