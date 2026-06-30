import { useEffect, useState, useCallback } from 'react';
import { useTelemetryStore } from '../../../store/telemetryStore';

/**
 * Manages initial dashboard data loading: chutes list, plants list,
 * chute detail, and KPI polling.
 *
 * Extracted from Dashboard.tsx lines 400-481.
 */
export function useDashboardData(token: string | null) {
  const { activeChuteId, setActiveChute, setChuteData } = useTelemetryStore();

  const [chutes, setChutes] = useState<any[]>([]);
  const [plantsList, setPlantsList] = useState<any[]>([]);
  const [chuteKpis, setChuteKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Chute registration helpers (need plantsList + chutes setters) ──────
  const [regPlantId, setRegPlantId] = useState('');
  const [assignPlantId, setAssignPlantId] = useState('');
  const [assignChuteId, setAssignChuteId] = useState('');

  // Fetch initial plants & chutes in parallel
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [chutesRes, plantsRes] = await Promise.all([
          fetch('/_/backend/industry/chutes', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/_/backend/industry/plants', { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);

        const [data, plData] = await Promise.all([
          chutesRes.json(),
          plantsRes.json(),
        ]);

        if (!chutesRes.ok) throw new Error(data.message || 'Failed to fetch chutes');

        const plants = plantsRes.ok ? plData : [];
        setPlantsList(plants);
        if (plants.length > 0) {
          setRegPlantId(plants[0]._id);
          setAssignPlantId(plants[0]._id);
        }

        const mapped = data.map((c: any) => {
          const p = plants.find((pl: any) => pl._id === c.plantId);
          return { ...c, plantName: p ? p.name : 'Unknown Facility' };
        });
        setChutes(mapped);

        if (mapped.length > 0) {
          setActiveChute(mapped[0]._id);
          setAssignChuteId(mapped[0]._id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [token, setActiveChute]);

  // Fetch specific chute detail telemetry
  useEffect(() => {
    if (!activeChuteId) return;

    const fetchChuteDetail = async () => {
      try {
        const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/detail`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setChuteData(data);
        }
      } catch (err) {
        console.error('Failed to load chute details:', err);
      }
    };

    fetchChuteDetail();
  }, [activeChuteId, token, setChuteData]);

  // Fetch Chute Intelligence KPIs (polled every 60s)
  useEffect(() => {
    if (!activeChuteId) return;
    const fetchKpis = async () => {
      try {
        const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/kpis`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const kpisData = await res.json();
          setChuteKpis(kpisData);
        }
      } catch { /* non-critical */ }
    };
    fetchKpis();
    const interval = setInterval(fetchKpis, 60_000);
    return () => clearInterval(interval);
  }, [activeChuteId, token]);

  // Refresh chute detail (used by pull-to-refresh and alert resolution)
  const refreshChuteDetail = useCallback(async () => {
    if (!activeChuteId) return;
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/detail`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setChuteData(data);
    } catch (err) {
      console.error('Failed to refresh chute details:', err);
    }
  }, [activeChuteId, token, setChuteData]);

  return {
    chutes,
    setChutes,
    plantsList,
    setPlantsList,
    chuteKpis,
    loading,
    error,
    setError,
    regPlantId,
    setRegPlantId,
    assignPlantId,
    setAssignPlantId,
    assignChuteId,
    setAssignChuteId,
    refreshChuteDetail,
  } as const;
}
