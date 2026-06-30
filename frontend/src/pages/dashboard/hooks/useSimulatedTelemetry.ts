import { useEffect, useState } from 'react';

/**
 * Manages simulated telemetry metrics (throughput, wear, energy) and per-chute
 * baseline generation. The 2-second timer produces incremental deltas to simulate
 * live sensor data when MQTT telemetry is unavailable.
 *
 * Extracted from Dashboard.tsx lines 353-399.
 */
export function useSimulatedTelemetry(
  activeChuteId: string | null,
  chuteStatus: string,
) {
  const [throughput, setThroughput] = useState(914.3);
  const [wearIndex, setWearIndex] = useState(82.4);
  const [energy, setEnergy] = useState(4820.65);
  const [throughputHistory, setThroughputHistory] = useState<number[]>(
    [910, 915, 908, 912, 919, 914, 916, 911, 915, 914.3],
  );

  // Simulated telemetry updates — 2-second timer
  useEffect(() => {
    const timer = setInterval(() => {
      setThroughput(t => {
        const delta = (Math.random() - 0.5) * 8;
        const next = t + delta;
        const bounded = next < 500 ? 500 : next > 1200 ? 1200 : next;
        setThroughputHistory(prev => [...prev.slice(-9), bounded]);
        return bounded;
      });

      setEnergy(e => e + 0.02 + (chuteStatus === 'Blasting' ? 0.38 : 0));
      setWearIndex(w => Math.max(15, w - 0.0001));
    }, 2000);

    return () => clearInterval(timer);
  }, [chuteStatus]);

  // Per-chute baseline — deterministic hash generates distinct starting values
  useEffect(() => {
    if (!activeChuteId) return;

    let hash = 0;
    for (let i = 0; i < activeChuteId.length; i++) {
      hash = activeChuteId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);

    const baselineThroughput = 700 + (absHash % 250);
    const baselineWear = 60 + (absHash % 35);
    const baselineEnergy = 1000 + (absHash % 4000);

    setThroughput(Number(baselineThroughput.toFixed(1)));
    setWearIndex(Number(baselineWear.toFixed(1)));
    setEnergy(Number(baselineEnergy.toFixed(2)));

    const history: number[] = [];
    let currentVal = baselineThroughput;
    for (let i = 0; i < 10; i++) {
      currentVal += (Math.random() - 0.5) * 10;
      history.push(Number(currentVal.toFixed(1)));
    }
    setThroughputHistory(history);
  }, [activeChuteId]);

  return { throughput, wearIndex, energy, throughputHistory } as const;
}
