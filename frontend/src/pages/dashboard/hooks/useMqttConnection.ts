import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useTelemetryStore } from '../../../store/telemetryStore';

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
      client.subscribe(`nigha/chute/${activeChuteId}/radar`);
      client.subscribe(`nigha/chute/${activeChuteId}/temperature`);
      client.subscribe(`nigha/chute/${activeChuteId}/humidity`);
      client.subscribe(`nigha/chute/${activeChuteId}/compressor`);
      client.subscribe(`nigha/chute/${activeChuteId}/alert`);
      client.subscribe(`nigha/chute/${activeChuteId}/health`);
      client.subscribe(`nigha/chute/${activeChuteId}/location`);
      client.subscribe(`nigha/chute/${activeChuteId}/blast`);
      client.subscribe(`nigha/chute/${activeChuteId}/localization`);
    });

    client.on('message', (topic, payload) => {
      const data = JSON.parse(payload.toString());
      const type = topic.split('/')[3];

      switch (type) {
        case 'radar':
          updateRadarData(data.zone, data.distance, data.buildupDetected);
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
        case 'blast':
          if (data.success) {
            updateStatus('Blasting');
            setActiveBlasterNumber(data.blasterNumber);
            setActiveSolenoidValves(data.solenoidValves || []);

            setTimeout(() => {
              setActiveBlasterNumber(null);
              setActiveSolenoidValves([]);
            }, 2500);
          }
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
