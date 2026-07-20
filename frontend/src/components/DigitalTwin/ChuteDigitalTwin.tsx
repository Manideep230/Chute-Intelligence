/**
 * ChuteDigitalTwin — Nigha Radar Complete Interactive Visualization
 * =================================================================
 * All 11 phases implemented:
 *  Phase 1  — Interactive blockage creation (click on active slant)
 *  Phase 2  — Realistic air blast animation (cone, dust, pressure wave)
 *  Phase 3  — Block removal physics (distance calc, fragmentation)
 *  Phase 4  — Full solenoid interaction (select, preview radius, confirm)
 *  Phase 5  — Demo mode state machine (10-step automated sequence)
 *  Phase 6  — Upgraded chute model (ribs, welds, PBR materials)
 *  Phase 7  — Component detail (radar housings, brass solenoids, gauge)
 *  Phase 8  — GPU particle material flow (600 instances, accumulation)
 *  Phase 9  — Camera cinematics (7 presets, auto-zoom)
 *  Phase 10 — Client Demo button in toolbar
 *  Phase 11 — Performance (shared materials, LOD, frustum culling)
 */

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useTelemetryStore } from '../../store/telemetryStore';
import type { DevBlockage } from '../../store/telemetryStore';
import { useAuthStore } from '../../store/authStore';
import {
  useDigitalTwinState,
  type BlockingSeverity,
} from './useDigitalTwinState';

// ─── SHARED MATERIAL POOL (Phase 11 — performance) ────────────────────────────
const MAT_STEEL        = { color: '#7A8899', roughness: 0.22, metalness: 0.90 };
const MAT_DARK         = { color: '#2A3547', roughness: 0.50, metalness: 0.70 };
const MAT_RED          = { color: '#F85149', roughness: 0.30, metalness: 0.80 };
const MAT_PAINTED      = { color: '#4A5568', roughness: 0.45, metalness: 0.75 };
const MAT_WORN         = { color: '#5A6070', roughness: 0.65, metalness: 0.60 };
const MAT_RUST_ACCENT  = { color: '#7A4513', roughness: 0.90, metalness: 0.05 };
const MAT_BRASS        = { color: '#B08B4A', roughness: 0.30, metalness: 0.85 };

// ─── PATH DEFINITIONS (used by both particles and blockage raycasting) ────────
// Path 1: LEFT_SLANT (top-right to bottom-left diagonal)
// Path 3: RIGHT_SLANT (top-left to bottom-right diagonal)
const SLANT_PATHS = {
  LEFT_SLANT:  [[0.937, 2.184, 0],  [1.085, 0.953, 0],  [0, 0, 0], [-1.085, -0.953, 0], [-0.937, -2.184, 0]] as [number,number,number][],
  RIGHT_SLANT: [[-0.937, 2.184, 0], [-1.085, 0.953, 0], [0, 0, 0], [1.085, -0.953, 0],  [0.937, -2.184, 0]] as [number,number,number][],
};

function interpolatePath(pts: [number,number,number][], t: number): THREE.Vector3 {
  const n = pts.length - 1;
  const segment = Math.min(Math.floor(t * n), n - 1);
  const segT = (t * n) - segment;
  const a = pts[segment], b = pts[segment + 1];
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * segT,
    a[1] + (b[1] - a[1]) * segT,
    a[2] + (b[2] - a[2]) * segT,
  );
}

// Blaster positions mapped to blaster numbers (flanged and aligned to slanted walls, blasting diagonally into flow)
const BLASTER_WORLD_POSITIONS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0.588,  1.346, 0),
  2: new THREE.Vector3(-0.588, 1.346, 0),
  3: new THREE.Vector3(0.914,  0.026, 0),
  4: new THREE.Vector3(-0.914, 0.026, 0),
};

// ─── CHUTE BOUNDING WIREFRAME ─────────────────────────────────────────────────
const ChuteBoundingWireframe: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  status: 'Normal' | 'Buildup' | 'Blocked';
  isDark: boolean;
}> = ({ position, rotation = [0, 0, 0], size, status, isDark }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useFrame((state) => {
    if (meshRef.current) {
      const elapsed = state.clock.elapsedTime;
      const currentStatus = statusRef.current;
      const speed = currentStatus === 'Blocked' ? 12 : currentStatus === 'Buildup' ? 6 : 2;
      const baseOpacity = currentStatus === 'Blocked' ? 0.45 : currentStatus === 'Buildup' ? 0.3 : 0.08;
      const pulse = baseOpacity + Math.sin(elapsed * speed) * (baseOpacity * 0.4);
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = pulse;
    }
  });

  const color = status === 'Blocked' ? '#F85149' : status === 'Buildup' ? '#D29922' : (isDark ? '#00e5ff' : '#0052cc');

  return (
    <mesh position={position} rotation={rotation} ref={meshRef}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.1} />
    </mesh>
  );
};

// ─── RADAR HUD RINGS ──────────────────────────────────────────────────────────
const RadarHUDRings: React.FC<{ detecting: boolean; isDark: boolean }> = ({ detecting, isDark }) => {
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const detectingRef = useRef(detecting);

  useEffect(() => {
    detectingRef.current = detecting;
  }, [detecting]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const speed = detectingRef.current ? 4.5 : 1.0;
    if (outerRingRef.current) outerRingRef.current.rotation.z = elapsed * 0.8 * speed;
    if (innerRingRef.current) innerRingRef.current.rotation.z = -elapsed * 1.4 * speed;
  });

  const color = detecting ? '#FF3D00' : (isDark ? '#00e5ff' : '#0052cc');
  const opacity = detecting ? 0.65 : 0.22;

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={outerRingRef}>
        <ringGeometry args={[0.22, 0.23, 32]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={innerRingRef}>
        <ringGeometry args={[0.15, 0.16, 24]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ─── BLASTER HUD RING ─────────────────────────────────────────────────────────
const BlasterHUDRing: React.FC<{ isActive: boolean; healthScore: number }> = ({ isActive, healthScore }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = state.clock.elapsedTime * (isActiveRef.current ? 5.5 : 0.5);
    }
  });
  const healthColor = healthScore > 70 ? '#00C853' : healthScore > 40 ? '#FFB300' : '#FF3D00';
  const color = isActive ? '#2196F3' : healthColor;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.22, 0.23, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isActive ? 0.75 : 0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ─── RADAR SCANNING BEAM ──────────────────────────────────────────────────────
const RadarScanningBeam: React.FC<{ detecting: boolean }> = ({ detecting }) => {
  const discRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((state, delta) => {
    t.current += delta * 1.5;
    if (t.current > 1.0) t.current = 0;
    if (discRef.current) {
      discRef.current.position.z = 0.05 + t.current * 1.6;
      const scaleVal = 1.0 + Math.sin(state.clock.elapsedTime * 10) * 0.18;
      discRef.current.scale.set(scaleVal, scaleVal, 1);
      const opacity = Math.sin(t.current * Math.PI) * 0.65;
      (discRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  });

  const color = detecting ? '#FF3D00' : '#00E5FF';
  return (
    <group>
      <mesh position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 1.7, 4]} />
        <meshBasicMaterial color={color} transparent opacity={detecting ? 0.95 : 0.55} />
      </mesh>
      <mesh position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.16, 1.7, 12, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={detecting ? 0.25 : 0.09} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={discRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.005, 0.12, 16]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ─── HOLOGRAM CARD ────────────────────────────────────────────────────────────
const HologramCard: React.FC<{
  position: [number, number, number];
  title: string;
  lines: string[];
  color: string;
}> = ({ position, title, lines, color }) => {
  const cardRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (cardRef.current) {
      cardRef.current.quaternion.copy(state.camera.quaternion);
      cardRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2.0 + position[0]) * 0.03;
    }
  });
  return (
    <group position={position} ref={cardRef}>
      <mesh>
        <planeGeometry args={[0.9, 0.42]} />
        <meshBasicMaterial color="#090f1c" transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[0.92, 0.44]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <Text position={[0, 0.12, 0.002]} fontSize={0.055} color={color} anchorX="center" anchorY="middle" depthOffset={-1}>
        {title}
      </Text>
      {lines.map((line, idx) => (
        <Text key={idx} position={[-0.4, 0.02 - idx * 0.065, 0.002]} fontSize={0.038} color="#E6EDF3" anchorX="left" anchorY="middle" depthOffset={-1}>
          {line}
        </Text>
      ))}
    </group>
  );
};

// ─── COMPACT STATUS BADGE ─────────────────────────────────────────────────────
const CompactStatusBadge: React.FC<{
  position: [number, number, number];
  label: string;
  color: string;
  isDark: boolean;
}> = ({ position, label, color, isDark }) => {
  const badgeRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (badgeRef.current) {
      badgeRef.current.quaternion.copy(state.camera.quaternion);
      badgeRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2.0 + position[0]) * 0.015;
    }
  });
  const textColor = isDark ? '#ffffff' : '#0f172a';
  return (
    <group position={position} ref={badgeRef}>
      <mesh>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[0.07, 0.085, 16]} />
        <meshBasicMaterial color={textColor} transparent opacity={0.6} />
      </mesh>
      <Text position={[0, 0.12, 0.002]} fontSize={0.06} color={textColor} fontWeight="bold" anchorX="center" anchorY="middle">
        {label}
      </Text>
    </group>
  );
};

// ─── SCANNING PARTICLES ───────────────────────────────────────────────────────
const ScanningParticles: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 120;
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 2.5;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = -2.5 + Math.random() * 5.0;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      spd[i] = 0.12 + Math.random() * 0.28;
    }
    return [pos, spd];
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        posAttr.setY(i, posAttr.getY(i) + speeds[i] * delta);
        if (posAttr.getY(i) > 2.8) posAttr.setY(i, -2.5);
      }
      posAttr.needsUpdate = true;
      pointsRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={isDark ? '#00e5ff' : '#388bfd'} size={0.03} transparent opacity={0.3} depthWrite={false} />
    </points>
  );
};

// ─── PHASE 6: UPGRADED DUCT WALL ─────────────────────────────────────────────
const DuctWall: React.FC<{
  position: [number,number,number];
  rotation?: [number,number,number];
  length: number;
  width: number;
  thickness?: number;
  color?: string;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isFront?: boolean;
  isDimmed?: boolean;
}> = ({ position, rotation = [0,0,0], length, width, thickness = 0.06, color, viewMode, isFront, isDimmed }) => {
  if (viewMode === 'cutaway' && isFront) return null;
  const opacityVal = isDimmed ? 0.15 : (viewMode === 'transparent' ? 0.30 : viewMode === 'cutaway' ? 0.35 : 1.0);
  return (
    <mesh position={position} rotation={rotation} frustumCulled>
      <boxGeometry args={[width, length, thickness]} />
      <meshStandardMaterial
        color={isDimmed ? '#262626' : (color ?? MAT_PAINTED.color)}
        roughness={isDimmed ? 0.9 : MAT_PAINTED.roughness}
        metalness={isDimmed ? 0.1 : MAT_PAINTED.metalness}
        transparent={isDimmed || viewMode === 'transparent' || viewMode === 'cutaway'}
        opacity={opacityVal}
        wireframe={viewMode === 'maintenance'}
        emissive={!isDimmed && color === '#00e5ff' ? '#00e5ff' : '#000000'}
        emissiveIntensity={!isDimmed && color === '#00e5ff' ? 0.6 : 0}
      />
    </mesh>
  );
};

// ─── PHASE 6: STRUCTURAL RIBS ─────────────────────────────────────────────────
const StructuralRibs: React.FC<{
  length: number; width: number; viewMode: string; isDimmed?: boolean;
}> = ({ length, width, viewMode, isDimmed }) => {
  const ribCount = 6;
  const spacing = length / (ribCount + 1);
  return (
    <group>
      {Array.from({ length: ribCount }, (_, i) => (
        <mesh key={i} position={[0, -length / 2 + spacing * (i + 1), 0]}>
          <boxGeometry args={[width + 0.04, 0.025, 0.085]} />
          <meshStandardMaterial
            {...MAT_WORN}
            transparent={isDimmed}
            opacity={isDimmed ? 0.15 : 1}
            wireframe={viewMode === 'maintenance'}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─── PHASE 6: WELD SEAM DECORATION ───────────────────────────────────────────
const WeldSeam: React.FC<{ length: number; offsetZ: number; viewMode: string }> = ({ length, offsetZ, viewMode }) => (
  <mesh position={[0, 0, offsetZ]}>
    <boxGeometry args={[0.005, length, 0.005]} />
    <meshStandardMaterial color="#6B7280" roughness={0.7} metalness={0.5} wireframe={viewMode === 'maintenance'} />
  </mesh>
);

// ─── PHASE 6: INSPECTION DOOR ─────────────────────────────────────────────────
const InspectionDoor: React.FC<{ position: [number,number,number]; rotation?: [number,number,number]; viewMode: string }> = ({ position, rotation = [0,0,0], viewMode }) => (
  <group position={position} rotation={rotation}>
    <mesh>
      <boxGeometry args={[0.22, 0.30, 0.008]} />
      <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.65} wireframe={viewMode === 'maintenance'} />
    </mesh>
    {/* door frame */}
    <mesh position={[0, 0, 0.005]}>
      <boxGeometry args={[0.24, 0.32, 0.006]} />
      <meshStandardMaterial color="#1F2937" roughness={0.6} metalness={0.7} wireframe={viewMode === 'maintenance'} />
    </mesh>
    {/* handle */}
    <mesh position={[0.08, 0, 0.01]}>
      <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
      <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
    </mesh>
    {/* hinge bolts */}
    {[-0.12, 0.12].map((y, i) => (
      <mesh key={i} position={[-0.1, y, 0.006]}>
        <cylinderGeometry args={[0.008, 0.008, 0.014, 6]} />
        <meshStandardMaterial {...MAT_STEEL} />
      </mesh>
    ))}
  </group>
);

// ─── PHASE 6: BOLT HEAD ARRAY ────────────────────────────────────────────────
const BoltArray: React.FC<{ positions: [number,number,number][]; viewMode: string }> = ({ positions, viewMode }) => (
  <group>
    {positions.map((pos, i) => (
      <mesh key={i} position={pos}>
        <cylinderGeometry args={[0.018, 0.018, 0.022, 6]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>
    ))}
  </group>
);

// ChuteStructure component definition has been relocated down in the file (after AirBlasterUnit) to resolve dependency declaration order.

// ─── PHASE 2: REALISTIC AIR BLAST ANIMATION ───────────────────────────────────
interface AirBlastAnimationProps {
  position: [number,number,number];
  explodedPosition: [number,number,number];
  rotation: [number,number,number];
  lifecycle: 'idle' | 'valve_open' | 'jet_active' | 'pressure_wave' | 'dissipating';
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
}

const AirBlastAnimation: React.FC<AirBlastAnimationProps> = ({ position, rotation, lifecycle }) => {
  const coneRef       = useRef<THREE.Mesh>(null);
  const dustRef       = useRef<THREE.Points>(null);
  const ringRef       = useRef<THREE.Mesh>(null);
  const jetCoreRef    = useRef<THREE.Mesh>(null);
  const valveRef      = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const lifecycleRef  = useRef(lifecycle);
  const groupRef       = useRef<THREE.Group>(null);

  useEffect(() => {
    lifecycleRef.current = lifecycle;
  }, [lifecycle]);

  // Dust cloud — 200 particles
  const [dustPos] = useMemo(() => {
    const pos = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.25;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = Math.sin(angle) * r;
      pos[i * 3 + 2] = 0.16 + Math.random() * 0.8;  // along blast direction (local Z, starting at nozzle)
    }
    return [pos];
  }, []);

  const isActive = lifecycle !== 'idle';

  useFrame((state, delta) => {
    const currentLifecycle = lifecycleRef.current;
    const currentIsActive = currentLifecycle !== 'idle';
    if (!currentIsActive) { t.current = 0; return; }
    t.current = Math.min(t.current + delta * 1.5, 1.0);
    const elapsed = state.clock.elapsedTime;

    // Valve open animation
    if (valveRef.current) {
      const openAngle = currentLifecycle === 'valve_open' ? Math.min(t.current * 6, Math.PI * 0.45) : Math.PI * 0.45;
      valveRef.current.rotation.x = openAngle;
    }

    // Air cone
    if (coneRef.current) {
      const active = currentLifecycle === 'jet_active' || currentLifecycle === 'pressure_wave';
      const scaleX = active ? Math.min(t.current * 3, 1.0) : Math.max(1.0 - (t.current * 2), 0);
      coneRef.current.scale.set(scaleX, 1 + t.current * 0.5, scaleX);
      (coneRef.current.material as THREE.MeshBasicMaterial).opacity = active
        ? (0.65 + Math.sin(elapsed * 30) * 0.15) * scaleX
        : 0;
    }

    // Jet core
    if (jetCoreRef.current) {
      const active = currentLifecycle === 'jet_active';
      (jetCoreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = active
        ? 2.0 + Math.sin(elapsed * 60) * 1.0
        : 0;
      jetCoreRef.current.visible = active;
    }

    // Dust
    if (dustRef.current) {
      const posAttr = dustRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 200; i++) {
        const vz = posAttr.getZ(i) + delta * (0.8 + Math.random() * 0.4);
        const vx = posAttr.getX(i) + (Math.random() - 0.5) * delta * 0.15;
        const vy = posAttr.getY(i) + (Math.random() - 0.5) * delta * 0.15;
        posAttr.setXYZ(i, vx, vy, Math.min(vz, 1.4 + Math.random() * 0.6));
      }
      posAttr.needsUpdate = true;
      const dActive = currentLifecycle === 'jet_active' || currentLifecycle === 'pressure_wave';
      (dustRef.current.material as THREE.PointsMaterial).opacity = dActive ? 0.55 : Math.max(0, 0.55 - t.current * 2);
      dustRef.current.visible = dActive || currentLifecycle === 'dissipating';
    }

    // Pressure wave ring
    if (ringRef.current) {
      const pActive = currentLifecycle === 'pressure_wave';
      const scaleR = pActive ? 0.3 + t.current * 2.8 : 0;
      ringRef.current.scale.set(scaleR, scaleR, 1);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = pActive
        ? Math.max(0, 0.8 - t.current * 1.5)
        : 0;
    }
  });

  if (!isActive && t.current === 0) return null;

  return (
    <group ref={groupRef} rotation={rotation} position={position}>
      {/* Valve disc (opens) */}
      <mesh ref={valveRef} position={[0, 0.04, -0.08]}>
        <cylinderGeometry args={[0.035, 0.035, 0.012, 12]} />
        <meshStandardMaterial color="#FFD700" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* White compressed-air cone */}
      <mesh ref={coneRef} position={[0, 0, 0.76]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.32, 1.2, 16, 1, true]} />
        <meshBasicMaterial color="#E8F4FF" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Bright jet core */}
      <mesh ref={jetCoreRef} position={[0, 0, 0.76]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#00BFFF" emissiveIntensity={2.0} transparent opacity={0.85} />
      </mesh>

      {/* Turbulence spray particles (white) */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPos, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#C4B08A" size={0.022} transparent opacity={0.55} depthWrite={false} />
      </points>

      {/* Pressure wave ring */}
      <mesh ref={ringRef} position={[0, 0, 1.2]} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.01, 0.22, 24]} />
        <meshBasicMaterial color="#00D4FF" transparent side={THREE.DoubleSide} depthWrite={false} opacity={0.8} />
      </mesh>

      {/* Point light for blast glow */}
      {(lifecycle === 'jet_active') && (
        <pointLight position={[0, 0, 0.76]} color="#88CCFF" intensity={3.0} distance={2.5} />
      )}
    </group>
  );
};

// ─── PHASE 3: ORGANIC BLOCKAGE MASS ──────────────────────────────────────────
interface OrganicBlockageProps {
  blockage: DevBlockage;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isSelected: boolean;
  onSelect: () => void;
}

const OrganicBlockage: React.FC<OrganicBlockageProps> = ({ blockage, viewMode, isSelected, onSelect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const fragmentRefs = useRef<THREE.Mesh[]>([]);
  const fragT = useRef(0);
  const currentExplode = useRef(0);

  const scale = blockage.severity === 'small' ? 0.18 : blockage.severity === 'medium' ? 0.32 : 0.50;
  const activePath = useTelemetryStore(state => state.activePath) || 'LEFT_SLANT';

  // Random positions of sub-rocks for organic look (generated once)
  const rocks = useMemo(() => {
    const out: Array<{ pos: [number,number,number]; sz: number; rot: [number,number,number] }> = [];
    const count = blockage.severity === 'small' ? 5 : blockage.severity === 'medium' ? 9 : 14;
    for (let i = 0; i < count; i++) {
      out.push({
        pos: [(Math.random()-0.5)*0.6, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4] as [number,number,number],
        sz: 0.4 + Math.random() * 0.6,
        rot: [Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI] as [number,number,number],
      });
    }
    return out;
  }, [blockage.severity]);

  // Fragment velocities
  const fragVelocities = useMemo(() =>
    rocks.map(() => new THREE.Vector3(
      (Math.random()-0.5) * 0.8,
      Math.random() * 1.2,
      (Math.random()-0.5) * 0.8,
    )),
  [rocks]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Pulse when highlighted/selected
    let pulse = 1.0;
    if (!blockage.fragmenting && !blockage.cleared) {
      pulse = 1.0 + Math.sin(state.clock.elapsedTime * (isSelected ? 10 : 5)) * 0.06;
    }

    // Exploded view shift
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;
    const shiftX = (activePath === 'LEFT_SLANT' ? -0.3 : 0.3) * e;
    const shiftY = 0.3 * e;
    const shiftZ = 0.3 * e;

    const pos = blockage.worldPosition;
    groupRef.current.position.set(pos[0] + shiftX, pos[1] + shiftY, pos[2] + shiftZ);
    groupRef.current.scale.setScalar(scale * pulse);

    // Fragmentation animation
    if (blockage.fragmenting) {
      fragT.current = Math.min(fragT.current + delta * 1.2, 1.0);
      fragmentRefs.current.forEach((m, i) => {
        if (m) {
          const v = fragVelocities[i];
          m.position.addScaledVector(v, delta * 1.4);
          m.position.y -= delta * 2.0 * fragT.current; // gravity
          m.rotation.x += delta * (2 + Math.random());
          m.rotation.z += delta * (1.5 + Math.random());
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.opacity = Math.max(0, 1.0 - fragT.current * 1.3);
        }
      });
    }
  });

  if (blockage.cleared && fragT.current >= 0.95) return null;

  const pos = blockage.worldPosition;
  const blockColor = blockage.severity === 'small' ? '#8B6914' : blockage.severity === 'medium' ? '#7A5A1E' : '#6B4A14';
  const rimColor = isSelected ? '#F59E0B' : '#EF4444';

  return (
    <group
      ref={groupRef}
      position={pos}
      scale={[scale, scale, scale]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Selection glow ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.1, 32]} />
          <meshBasicMaterial color={rimColor} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Organic rock cluster */}
      {rocks.map((rock, i) => (
        <mesh
          key={i}
          ref={el => { if (el) fragmentRefs.current[i] = el; }}
          position={rock.pos}
          rotation={rock.rot}
        >
          <dodecahedronGeometry args={[rock.sz * 0.5, 0]} />
          <meshStandardMaterial
            color={blockColor}
            roughness={0.92}
            metalness={0.04}
            transparent={viewMode !== 'operator'}
            opacity={viewMode === 'operator' ? 1.0 : 0.7}
            wireframe={viewMode === 'maintenance'}
            emissive={isSelected ? '#F59E0B' : '#000000'}
            emissiveIntensity={isSelected ? 0.35 : 0}
          />
        </mesh>
      ))}

      {/* Dust/sand accumulation at base */}
      <mesh position={[0, -0.55, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.7, 0.9, 0.18, 12]} />
        <meshStandardMaterial color="#9B7B44" roughness={1.0} metalness={0} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};

// ─── PHASE 4: SOLENOID BLAST RADIUS PREVIEW ───────────────────────────────────
const BlastRadiusPreview: React.FC<{
  position: THREE.Vector3;
  radius: number;
  impactPoint: THREE.Vector3 | null;
}> = ({ position, radius, impactPoint }) => {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sphereRef.current) {
      const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.08 + Math.sin(state.clock.elapsedTime * 3) * 0.04;
    }
  });

  return (
    <group position={position}>
      {/* Blast radius sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial color="#2196F3" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} wireframe />
      </mesh>
      {/* Solid inner sphere (smaller) */}
      <mesh>
        <sphereGeometry args={[radius * 0.92, 24, 24]} />
        <meshBasicMaterial color="#00D4FF" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Blast direction arrow cone */}
      <mesh position={[0, -0.4, 0.3]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.06, 0.25, 10]} />
        <meshStandardMaterial color="#2196F3" emissive="#2196F3" emissiveIntensity={1.2} />
      </mesh>
      {/* Impact point marker */}
      {impactPoint && (
        <mesh position={impactPoint.clone().sub(position)}>
          <ringGeometry args={[0.08, 0.12, 16]} />
          <meshBasicMaterial color="#F59E0B" side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
};

// ─── PHASE 7: AIR BLASTER UNIT (upgraded) ─────────────────────────────────────
const AirBlasterUnit: React.FC<{
  position: [number,number,number];
  explodedPosition: [number,number,number];
  rotation: [number,number,number];
  blasterNo: number;
  isActive: boolean;
  healthScore: number;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
  isActivePath?: boolean;
  isSelected?: boolean;
  onSelect?: (blasterNo: number, worldPos: THREE.Vector3) => void;
  debugMode?: boolean;
}> = ({ position, rotation, blasterNo, isActive, healthScore, viewMode, isDark, isActivePath = true, isSelected = false, onSelect, debugMode = false }) => {
  const activeSolenoidValves  = useTelemetryStore(state => state.activeSolenoidValves);
  const nearestSolenoidGroup  = useTelemetryStore(state => state.nearestSolenoidGroup);
  const valveA = blasterNo * 2 - 1;
  const valveB = blasterNo * 2;
  const isAActive = isActive && isActivePath && activeSolenoidValves.includes(valveA);
  const isBActive = isActive && isActivePath && activeSolenoidValves.includes(valveB);

  const nozzleRef      = useRef<THREE.PointLight>(null);
  const groupRef       = useRef<THREE.Group>(null);
  const pressureNeedle = useRef<THREE.Mesh>(null);
  const labelRef       = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const pulseRingRef   = useRef<THREE.Mesh>(null);
  const recommendedPulse = useRef(0);
  const hasBlockage = nearestSolenoidGroup === blasterNo && isActivePath;

  const isActiveRef     = useRef(isActive);
  const isActivePathRef = useRef(isActivePath);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isActivePathRef.current = isActivePath;
  }, [isActivePath]);

  useFrame((state) => {
    const currentIsActive = isActiveRef.current;
    const currentIsActivePath = isActivePathRef.current;

    if (nozzleRef.current) {
      nozzleRef.current.intensity = currentIsActive && currentIsActivePath
        ? 1.5 + Math.sin(state.clock.elapsedTime * 40) * 1.0
        : 0;
    }

    // Pressure gauge needle animation (Phase 7)
    if (pressureNeedle.current) {
      const pressure = currentIsActive ? 0.9 + Math.sin(state.clock.elapsedTime * 5) * 0.1 : 0.2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      pressureNeedle.current.rotation.z = -Math.PI * 0.7 + pressure * Math.PI * 1.4;
    }

    // Recommended pulse
    if (hasBlockage) {
      recommendedPulse.current = 0.5 + Math.sin(state.clock.elapsedTime * 8) * 0.5;
      if (pulseRingRef.current) {
        (pulseRingRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(state.clock.elapsedTime * 8) * 0.2;
      }
    } else {
      recommendedPulse.current = 0;
    }

    // Billboard the debug labels
    if (labelRef.current && debugMode) {
      labelRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  const healthColor = healthScore > 70 ? '#00C853' : healthScore > 40 ? '#FFB300' : '#FF3D00';
  const activeColor = isActive ? '#2196F3' : (hasBlockage ? '#f59e0b' : healthColor);
  const cardColor = !isActivePath ? '#475569' : (isSelected ? '#F59E0B' : activeColor);
  const showDetailed = isHovered || isSelected || viewMode === 'maintenance';

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    if (isActivePath && onSelect && groupRef.current) {
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      onSelect(blasterNo, worldPos);
    }
  }, [blasterNo, isActivePath, onSelect]);

  return (
    <group
      ref={groupRef}
      rotation={rotation}
      position={position}
      scale={0.5}
      onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Mounting Flange — flush with the slant surface */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>

      {/* 4 Heavy Structural Gussets (Reinforcement Welds) */}
      <mesh position={[0, 0.12, -0.06]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>
      <mesh position={[0, -0.12, -0.06]}>
        <boxGeometry args={[0.02, 0.06, 0.12]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>
      <mesh position={[-0.12, 0, -0.06]}>
        <boxGeometry args={[0.06, 0.02, 0.12]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>
      <mesh position={[0.12, 0, -0.06]}>
        <boxGeometry args={[0.06, 0.02, 0.12]} />
        <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
      </mesh>

      {/* Main pressure tank — aligned horizontally along local X-axis */}
      <mesh position={[0, 0, -0.16]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.11, 0.38, 8, 16]} />
        <meshStandardMaterial
          color={!isActivePath ? '#475569' : MAT_RED.color}
          roughness={0.3} metalness={0.8}
          wireframe={viewMode === 'maintenance'}
          emissive={hasBlockage ? '#f59e0b' : isSelected ? '#F59E0B' : '#000000'}
          emissiveIntensity={recommendedPulse.current * 0.4 + (isSelected ? 0.3 : 0)}
        />
      </mesh>

      {/* Safety stripes on tank body */}
      {[-0.14, 0.14].map((x, i) => (
        <mesh key={i} position={[x, 0, -0.16]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.112, 0.112, 0.02, 16]} />
          <meshStandardMaterial color="#FFB300" roughness={0.4} metalness={0.5} wireframe={viewMode === 'maintenance'} />
        </mesh>
      ))}

      {/* Phase 7: Pressure gauge with needle (mounted on top of tank) */}
      <group position={[0, 0.13, -0.16]} rotation={[0, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.022, 12]} />
          <meshStandardMaterial color="#111827" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[0.038, 12]} />
          <meshBasicMaterial color="#E8E8E8" />
        </mesh>
        <mesh ref={pressureNeedle} position={[0, 0, 0.014]}>
          <boxGeometry args={[0.003, 0.028, 0.002]} />
          <meshBasicMaterial color="#FF3D00" />
        </mesh>
      </group>

      {/* Phase 7: Brass solenoid valve A (mounted on left side of horizontal tank) */}
      <group position={[-0.24, 0, -0.16]} rotation={[0, 0, 0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
          <meshStandardMaterial {...MAT_BRASS} wireframe={viewMode === 'maintenance'} />
        </mesh>
        {/* Phase 7: wiring harness */}
        <mesh position={[0, -0.05, 0.018]} rotation={[0.3, 0, 0.15]}>
          <cylinderGeometry args={[0.004, 0.004, 0.08, 5]} />
          <meshStandardMaterial color="#1A1A2E" roughness={0.7} />
        </mesh>
        {/* Phase 7: pneumatic fitting */}
        <mesh position={[0, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.020, 0.018, 8]} />
          <meshStandardMaterial color="#808080" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.045, 0.01]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color={!isActivePath ? '#475569' : (isAActive ? '#2196F3' : (hasBlockage ? '#f59e0b' : '#00C853'))} />
        </mesh>
        {showDetailed && (
          <Text position={[0, 0.075, 0.02]} fontSize={0.035} color={isDark ? '#E6EDF3' : '#24292F'}>
            {`SV${valveA}`}
          </Text>
        )}
      </group>

      {/* Phase 7: Brass solenoid valve B (mounted on right side of horizontal tank) */}
      <group position={[0.24, 0, -0.16]} rotation={[0, 0, -0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
          <meshStandardMaterial {...MAT_BRASS} wireframe={viewMode === 'maintenance'} />
        </mesh>
        <mesh position={[0, -0.05, 0.018]} rotation={[-0.3, 0, -0.15]}>
          <cylinderGeometry args={[0.004, 0.004, 0.08, 5]} />
          <meshStandardMaterial color="#1A1A2E" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.020, 0.018, 8]} />
          <meshStandardMaterial color="#808080" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.045, 0.01]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color={!isActivePath ? '#475569' : (isBActive ? '#2196F3' : (hasBlockage ? '#f59e0b' : '#00C853'))} />
        </mesh>
        {showDetailed && (
          <Text position={[0, 0.075, 0.02]} fontSize={0.035} color={isDark ? '#E6EDF3' : '#24292F'}>
            {`SV${valveB}`}
          </Text>
        )}
      </group>

      {/* Single Heavy-Duty Nozzle Pipe — extends into the chute */}
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.16, 12]} />
        <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
      </mesh>

      {/* Phase 7: Air supply manifold — aligned horizontally */}
      <mesh position={[0, 0, -0.23]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.32, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} wireframe={viewMode === 'maintenance'} />
      </mesh>
      {/* Phase 7: Pneumatic tubing to nozzle */}
      <mesh position={[0, 0.05, -0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.31, 6]} />
        <meshStandardMaterial color="#2C3E50" roughness={0.6} />
      </mesh>

      {/* Recommended pulse ring */}
      {hasBlockage && (
        <mesh ref={pulseRingRef} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.26, 0.28, 32]} />
          <meshBasicMaterial color={isSelected ? '#F59E0B' : '#f59e0b'} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Selection highlight ring */}
      {isSelected && (
        <mesh rotation={[0, 0, 0]}>
          <ringGeometry args={[0.30, 0.34, 32]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Health LED */}
      <mesh position={[0, 0, -0.275]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color={!isActivePath ? '#475569' : healthColor} />
      </mesh>

      {isActive && isActivePath && <pointLight ref={nozzleRef} position={[0, 0, 0.18]} color="#2196F3" intensity={1.5} distance={1.5} />}

      {isActivePath && viewMode !== 'maintenance' && !showDetailed && (
        <BlasterHUDRing isActive={isActive} healthScore={healthScore} />
      )}

      {showDetailed ? (
        <HologramCard
          position={[0, 0.55, 0.02]}
          title={`BLASTER B${blasterNo}${isSelected ? ' ★ SELECTED' : ''}`}
          lines={[
            `HEALTH: ${healthScore}%`,
            `SV${valveA}: ${isAActive ? 'BLAST' : 'STDBY'}  SV${valveB}: ${isBActive ? 'BLAST' : 'STDBY'}`,
            hasBlockage ? '▶ RECOMMENDED BLAST UNIT' : '',
            isSelected ? 'Click CONFIRM BLAST to fire' : '',
          ].filter(Boolean)}
          color={cardColor}
        />
      ) : (
        <CompactStatusBadge
          position={[0, 0.45, 0.02]}
          label={`B${blasterNo}`}
          color={!isActivePath ? '#475569' : (isSelected ? '#F59E0B' : (hasBlockage ? '#f59e0b' : healthColor))}
          isDark={isDark}
        />
      )}

      {/* Engineering Validation Debug Helpers */}
      {debugMode && (
        <>
          {/* Nozzle direction vector — single arrow since it is a single heavy nozzle */}
          <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0.16), 0.8, '#00E5FF', 0.15, 0.08]} />

          {/* Static Blast Cone Trajectory Preview */}
          <mesh position={[0, 0, 0.76]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.32, 1.2, 16, 1, true]} />
            <meshBasicMaterial color={isActivePath ? '#00D4FF' : '#475569'} wireframe transparent opacity={0.25} depthWrite={false} />
          </mesh>

          {/* Solenoid IDs and Air Blaster IDs labels */}
          <group ref={labelRef} position={[0, 0.38, 0]}>
            <Text fontSize={0.075} color={isActivePath ? '#00e5ff' : '#a0b4d0'} anchorX="center" anchorY="bottom" font="'JetBrains Mono',monospace">
              {`B${blasterNo}`}
            </Text>
            <Text position={[0, -0.06, 0]} fontSize={0.048} color={isActivePath ? '#FFB300' : '#64748B'} anchorX="center" anchorY="bottom" font="'JetBrains Mono',monospace">
              {`VALVES: SV${valveA},${valveB}`}
            </Text>
          </group>
        </>
      )}
    </group>
  );
};

// ─── PHASE 6: CHUTE STRUCTURE (upgraded) ─────────────────────────────────────
const ChuteStructure: React.FC<{
  status: string;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  activeBlasterNumber: number | null;
  blast: any;
  blasters: any[];
  solenoidSelection: any;
  handleSolenoidSelect: (blasterNo: number, worldPos: THREE.Vector3) => void;
  debugMode: boolean;
  getBlastLifecycle: (blasterNo: number) => 'idle' | 'valve_open' | 'jet_active' | 'pressure_wave' | 'dissipating';
}> = ({
  status,
  viewMode,
  isDark,
  activePath,
  activeBlasterNumber,
  blast,
  blasters,
  solenoidSelection,
  handleSolenoidSelect,
  debugMode,
  getBlastLifecycle,
}) => {
  const steelColor = '#4A5A6E';

  const ductWidth = 0.55;
  const ductLength = 3.8;
  const wallT = 0.07;
  const crossAngle = 0.85;

  const radars = useTelemetryStore(state => state.radars);
  const leftActiveZones  = activePath === 'LEFT_SLANT'  ? [radars[1], radars[2]] : [radars[0], radars[3]];
  const rightActiveZones = activePath === 'RIGHT_SLANT' ? [radars[1], radars[2]] : [radars[0], radars[3]];
  const resolveColStatus = (zones: typeof radars): 'Normal' | 'Buildup' | 'Blocked' => {
    const s = status as string;
    if (s === 'Blocked' || s === 'blocked') return 'Blocked';
    if (zones.some(r => r?.buildupDetected)) return 'Buildup';
    return 'Normal';
  };
  const leftColStatus  = resolveColStatus(leftActiveZones);
  const rightColStatus = resolveColStatus(rightActiveZones);
  const leftColRef  = useRef<THREE.Group>(null);
  const rightColRef = useRef<THREE.Group>(null);
  const diag1Ref    = useRef<THREE.Group>(null);
  const diag2Ref    = useRef<THREE.Group>(null);
  const currentExplode = useRef(0);

  useFrame((_, delta) => {
    const target = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, target, delta * 4.0);
    const e = currentExplode.current;
    if (leftColRef.current)  leftColRef.current.position.set(-1.2 - 0.7 * e, 0, 0);
    if (rightColRef.current) rightColRef.current.position.set(1.2 + 0.7 * e, 0, 0);
    if (diag1Ref.current)    diag1Ref.current.position.set(-0.3 * e, 0.3 * e, 0.3 * e);
    if (diag2Ref.current)    diag2Ref.current.position.set(0.3 * e, 0.3 * e, 0.3 * e);
  });

  const renderColumn = (side: 'left' | 'right', ref: React.RefObject<THREE.Group | null>, _isActive: boolean) => {
    const xSign = side === 'left' ? -1 : 1;
    const rot: [number,number,number] = [0, 0, xSign * 0.12];
    return (
      <group ref={ref} position={[xSign * 1.2, 0, 0]} rotation={rot}>
        {/* Front/back walls */}
        <DuctWall position={[0, 0, ductWidth/2]}  rotation={[0,0,0]} length={ductLength} width={ductWidth} color={steelColor} viewMode={viewMode} isFront={true} />
        <DuctWall position={[0, 0, -ductWidth/2]} rotation={[0,0,0]} length={ductLength} width={ductWidth} color={steelColor} viewMode={viewMode} />
        {/* Side walls */}
        <DuctWall position={[-ductWidth/2, 0, 0]} rotation={[0, Math.PI/2, 0]} length={ductLength} width={ductWidth} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} />
        <DuctWall position={[ductWidth/2, 0, 0]}  rotation={[0, Math.PI/2, 0]} length={ductLength} width={ductWidth} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} />
        {/* Phase 6: structural ribs */}
        <StructuralRibs length={ductLength} width={ductWidth} viewMode={viewMode} />
        {/* Phase 6: weld seams */}
        <WeldSeam length={ductLength} offsetZ={ductWidth/2 - 0.005} viewMode={viewMode} />
        <WeldSeam length={ductLength} offsetZ={-ductWidth/2 + 0.005} viewMode={viewMode} />
        {/* Phase 6: inspection door */}
        <InspectionDoor position={[0, -0.5, ductWidth/2 + 0.004]} viewMode={viewMode} />
        {/* Flanges */}
        {[ductLength/2, -ductLength/2].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <boxGeometry args={[ductWidth + 0.12, 0.08, ductWidth + 0.12]} />
            <meshStandardMaterial {...MAT_STEEL} wireframe={viewMode === 'maintenance'} />
          </mesh>
        ))}
        {/* Phase 6: flange bolt array */}
        {([ductLength/2, -ductLength/2] as const).map((y, fi) => (
          <BoltArray key={fi}
            positions={[[-0.2, y, 0.2],[0.2, y, 0.2],[-0.2, y, -0.2],[0.2, y, -0.2]] as [number,number,number][]}
            viewMode={viewMode}
          />
        ))}
      </group>
    );
  };

  return (
    <group>
      {/* LEFT COLUMN */}
      {renderColumn('left', leftColRef, activePath === 'LEFT_SLANT')}
      {/* RIGHT COLUMN */}
      {renderColumn('right', rightColRef, activePath === 'RIGHT_SLANT')}

      {/* DIAGONAL CROSSOVER 1 — LEFT_SLANT "\" */}
      <group ref={diag1Ref} rotation={[0, 0, -crossAngle]}>
        <DuctWall position={[0, 0, ductWidth/2]}  rotation={[0,0,0]} length={3.4} width={ductWidth*0.9} color={activePath === 'LEFT_SLANT' ? '#00e5ff' : '#262626'} viewMode={viewMode} isFront={true} isDimmed={activePath !== 'LEFT_SLANT'} />
        <DuctWall position={[0, 0, -ductWidth/2]} rotation={[0,0,0]} length={3.4} width={ductWidth*0.9} color={activePath === 'LEFT_SLANT' ? '#00e5ff' : '#262626'} viewMode={viewMode} isDimmed={activePath !== 'LEFT_SLANT'} />
        <DuctWall position={[-(ductWidth*0.9)/2, 0, 0]} rotation={[0, Math.PI/2, 0]} length={3.4} width={ductWidth*0.9} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} isDimmed={activePath !== 'LEFT_SLANT'} />
        <DuctWall position={[(ductWidth*0.9)/2, 0, 0]}  rotation={[0, Math.PI/2, 0]} length={3.4} width={ductWidth*0.9} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} isDimmed={activePath !== 'LEFT_SLANT'} />
        <StructuralRibs length={3.4} width={ductWidth*0.9} viewMode={viewMode} isDimmed={activePath !== 'LEFT_SLANT'} />

        {/* Black Inlet Holes for Blasters 1 and 4 (flush with top-facing roof) */}
        <mesh position={[-0.2475 - 0.001, 1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.0225, 16]} />
          <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.2475 - 0.001, -1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.0225, 16]} />
          <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
        </mesh>

        {/* Air Blaster 1 */}
        <AirBlasterUnit
          position={[-0.2475, 1.0, 0]}
          explodedPosition={[-0.2475, 1.0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          blasterNo={1}
          isActive={activeBlasterNumber === 1 || (blast.active && blast.blasterNumber === 1)}
          healthScore={blasters.find((b: any) => b.blasterNumber === 1)?.healthScore ?? 100}
          viewMode={viewMode}
          isDark={isDark}
          isActivePath={activePath === 'LEFT_SLANT'}
          isSelected={solenoidSelection.blasterNumber === 1}
          onSelect={handleSolenoidSelect}
          debugMode={debugMode}
        />
        {getBlastLifecycle(1) !== 'idle' && (
          <AirBlastAnimation
            position={[-0.2475, 1.0, 0]}
            explodedPosition={[-0.2475, 1.0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            lifecycle={getBlastLifecycle(1)}
            viewMode={viewMode}
          />
        )}

        {/* Air Blaster 4 */}
        <AirBlasterUnit
          position={[-0.2475, -1.0, 0]}
          explodedPosition={[-0.2475, -1.0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          blasterNo={4}
          isActive={activeBlasterNumber === 4 || (blast.active && blast.blasterNumber === 4)}
          healthScore={blasters.find((b: any) => b.blasterNumber === 4)?.healthScore ?? 100}
          viewMode={viewMode}
          isDark={isDark}
          isActivePath={activePath === 'LEFT_SLANT'}
          isSelected={solenoidSelection.blasterNumber === 4}
          onSelect={handleSolenoidSelect}
          debugMode={debugMode}
        />
        {getBlastLifecycle(4) !== 'idle' && (
          <AirBlastAnimation
            position={[-0.2475, -1.0, 0]}
            explodedPosition={[-0.2475, -1.0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            lifecycle={getBlastLifecycle(4)}
            viewMode={viewMode}
          />
        )}
      </group>

      {/* DIAGONAL CROSSOVER 2 — RIGHT_SLANT "/" */}
      <group ref={diag2Ref} rotation={[0, 0, crossAngle]}>
        <DuctWall position={[0, 0, ductWidth/2]}  rotation={[0,0,0]} length={3.4} width={ductWidth*0.9} color={activePath === 'RIGHT_SLANT' ? '#00e5ff' : '#262626'} viewMode={viewMode} isFront={true} isDimmed={activePath !== 'RIGHT_SLANT'} />
        <DuctWall position={[0, 0, -ductWidth/2]} rotation={[0,0,0]} length={3.4} width={ductWidth*0.9} color={activePath === 'RIGHT_SLANT' ? '#00e5ff' : '#262626'} viewMode={viewMode} isDimmed={activePath !== 'RIGHT_SLANT'} />
        <DuctWall position={[-(ductWidth*0.9)/2, 0, 0]} rotation={[0, Math.PI/2, 0]} length={3.4} width={ductWidth*0.9} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} isDimmed={activePath !== 'RIGHT_SLANT'} />
        <DuctWall position={[(ductWidth*0.9)/2, 0, 0]}  rotation={[0, Math.PI/2, 0]} length={3.4} width={ductWidth*0.9} thickness={wallT} color={MAT_DARK.color} viewMode={viewMode} isDimmed={activePath !== 'RIGHT_SLANT'} />
        <StructuralRibs length={3.4} width={ductWidth*0.9} viewMode={viewMode} isDimmed={activePath !== 'RIGHT_SLANT'} />

        {/* Black Inlet Holes for Blasters 2 and 3 (flush with top-facing roof) */}
        <mesh position={[0.2475 + 0.001, 1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.0225, 16]} />
          <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.2475 + 0.001, -1.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.0225, 16]} />
          <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
        </mesh>

        {/* Air Blaster 2 */}
        <AirBlasterUnit
          position={[0.2475, 1.0, 0]}
          explodedPosition={[0.2475, 1.0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          blasterNo={2}
          isActive={activeBlasterNumber === 2 || (blast.active && blast.blasterNumber === 2)}
          healthScore={blasters.find((b: any) => b.blasterNumber === 2)?.healthScore ?? 100}
          viewMode={viewMode}
          isDark={isDark}
          isActivePath={activePath === 'RIGHT_SLANT'}
          isSelected={solenoidSelection.blasterNumber === 2}
          onSelect={handleSolenoidSelect}
          debugMode={debugMode}
        />
        {getBlastLifecycle(2) !== 'idle' && (
          <AirBlastAnimation
            position={[0.2475, 1.0, 0]}
            explodedPosition={[0.2475, 1.0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            lifecycle={getBlastLifecycle(2)}
            viewMode={viewMode}
          />
        )}

        {/* Air Blaster 3 */}
        <AirBlasterUnit
          position={[0.2475, -1.0, 0]}
          explodedPosition={[0.2475, -1.0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          blasterNo={3}
          isActive={activeBlasterNumber === 3 || (blast.active && blast.blasterNumber === 3)}
          healthScore={blasters.find((b: any) => b.blasterNumber === 3)?.healthScore ?? 100}
          viewMode={viewMode}
          isDark={isDark}
          isActivePath={activePath === 'RIGHT_SLANT'}
          isSelected={solenoidSelection.blasterNumber === 3}
          onSelect={handleSolenoidSelect}
          debugMode={debugMode}
        />
        {getBlastLifecycle(3) !== 'idle' && (
          <AirBlastAnimation
            position={[0.2475, -1.0, 0]}
            explodedPosition={[0.2475, -1.0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            lifecycle={getBlastLifecycle(3)}
            viewMode={viewMode}
          />
        )}
      </group>

      {/* AR bounding wireframes */}
      {viewMode !== 'maintenance' && viewMode !== 'operator' && (
        <>
          <ChuteBoundingWireframe position={[-1.2, 0, 0]} rotation={[0, 0, 0.12]} size={[0.72, 4.0, 0.72]} status={leftColStatus} isDark={isDark} />
          <ChuteBoundingWireframe position={[1.2, 0, 0]}  rotation={[0, 0, -0.12]} size={[0.72, 4.0, 0.72]} status={rightColStatus} isDark={isDark} />
        </>
      )}
    </group>
  );
};

// ─── PHASE 8: REALISTIC MATERIAL FLOW (600 GPU particles) ────────────────────
const RealisticMaterialFlow: React.FC<{
  status: string;
  devBlockages: DevBlockage[];
  activeBlasterNumber: number | null;
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  blastActive: boolean;
  flowActive: boolean;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
}> = ({ status, devBlockages, activeBlasterNumber, activePath, blastActive, flowActive, viewMode }) => {
  const PARTICLE_COUNT = 600;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const currentExplode = useRef(0);

  // Prop refs to avoid stale closures in R3F render loop
  const statusRef = useRef(status);
  const devBlockagesRef = useRef(devBlockages);
  const activeBlasterNumberRef = useRef(activeBlasterNumber);
  const activePathRef = useRef(activePath);
  const blastActiveRef = useRef(blastActive);
  const flowActiveRef = useRef(flowActive);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { devBlockagesRef.current = devBlockages; }, [devBlockages]);
  useEffect(() => { activeBlasterNumberRef.current = activeBlasterNumber; }, [activeBlasterNumber]);
  useEffect(() => { activePathRef.current = activePath; }, [activePath]);
  useEffect(() => { blastActiveRef.current = blastActive; }, [blastActive]);
  useEffect(() => { flowActiveRef.current = flowActive; }, [flowActive]);

  type Particle = {
    t: number;
    speed: number;
    radialX: number;
    radialZ: number;
    sizeScale: number;
    colorIdx: number;   // 0=brown, 1=orange, 2=gray
    stopped: boolean;
    surgeTimer: number;
  };

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      t: Math.random(),
      speed: 0.12 + Math.random() * 0.18,
      radialX: (Math.random()-0.5) * 0.12,
      radialZ: (Math.random()-0.5) * 0.12,
      sizeScale: 0.014 + Math.random() * 0.022, // refined particle size for less clumpy flow
      colorIdx: Math.floor(Math.random() * 3),
      stopped: false,
      surgeTimer: 0,
    }));
  }, []);

  // High-fidelity vibrant ore colors
  const COLORS = useMemo(() => [
    new THREE.Color('#A15C38'), // vibrant copper ore
    new THREE.Color('#D97706'), // rich gold/amber ore
    new THREE.Color('#8A95A5'), // silver-gray silica rock
  ], []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Exploded view shift helper
  const getExplosionShift = (t: number, path: 'LEFT_SLANT' | 'RIGHT_SLANT', e: number): THREE.Vector3 => {
    const shift = new THREE.Vector3(0, 0, 0);
    if (e === 0) return shift;

    const startShift = new THREE.Vector3(0, 0, 0);
    const midShift = new THREE.Vector3(0, 0, 0);
    const endShift = new THREE.Vector3(0, 0, 0);

    if (path === 'LEFT_SLANT') {
      startShift.set(0.7 * e, 0, 0);
      midShift.set(-0.3 * e, 0.3 * e, 0.3 * e);
      endShift.set(-0.7 * e, 0, 0);
    } else {
      startShift.set(-0.7 * e, 0, 0);
      midShift.set(0.3 * e, 0.3 * e, 0.3 * e);
      endShift.set(0.7 * e, 0, 0);
    }

    // Smooth interpolation thresholds
    const t1 = 0.22, t2 = 0.28;
    const t3 = 0.72, t4 = 0.78;

    if (t < t1) {
      shift.copy(startShift);
    } else if (t < t2) {
      const factor = (t - t1) / (t2 - t1);
      shift.lerpVectors(startShift, midShift, factor);
    } else if (t < t3) {
      shift.copy(midShift);
    } else if (t < t4) {
      const factor = (t - t3) / (t4 - t3);
      shift.lerpVectors(midShift, endShift, factor);
    } else {
      shift.copy(endShift);
    }

    return shift;
  };

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const currentStatus = statusRef.current;
    const currentDevBlockages = devBlockagesRef.current;
    const currentActiveBlaster = activeBlasterNumberRef.current;
    const currentActivePath = activePathRef.current || 'LEFT_SLANT';
    const currentBlastActive = blastActiveRef.current;
    const currentFlowActive = flowActiveRef.current;

    const isBlasting = currentStatus === 'Blasting' || currentBlastActive;
    const targetPath = SLANT_PATHS[currentActivePath];

    // Exploded view lerping
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;

    // Find blockage t-value along path (from devBlockages)
    const blockageTValues = currentDevBlockages
      .filter(b => !b.cleared)
      .map(b => b.normalizedT);

    particles.forEach((p, idx) => {
      let stop = false;
      let pileY = 0;
      let pileSpread = 1.0;

      // Check if particle hits a blockage
      if (!isBlasting) {
        for (const bT of blockageTValues) {
          // Particles within 0.12 path units upstream of blockage accumulate
          if (p.t >= bT - 0.12 && p.t <= bT + 0.02) {
            stop = true;
            const dist = Math.abs(p.t - bT);
            // Stack particles vertically and spread them out horizontally to form a pile shape
            pileY = (0.12 - dist) * 1.6;
            pileSpread = 1.2 + (0.12 - dist) * 3.5;
            break;
          }
        }
      }

      p.stopped = stop;

      if (!stop && currentFlowActive) {
        // Speed variation — wall friction vs center flow
        const wallDist = Math.sqrt(p.radialX * p.radialX + p.radialZ * p.radialZ) / 0.12;
        const wallFriction = 1.0 - wallDist * 0.35;
        // As blockage increases: Flow slows
        const isBlockedStatus = currentStatus === 'Blocked' || currentStatus === 'blocked';
        const isBuildupStatus = currentStatus === 'Buildup' || currentStatus === 'buildup';
        const baseSpeedFactor = isBlockedStatus ? 0.05 : isBuildupStatus ? 0.4 : 1.0;
        const speedMult = isBlasting ? 2.8 : (p.surgeTimer > 0 ? 2.2 : 1.0) * baseSpeedFactor;
        p.t += p.speed * delta * speedMult * wallFriction;

        if (p.surgeTimer > 0) p.surgeTimer -= delta;

        if (p.t > 1.0) {
          p.t = 0;
          p.radialX = (Math.random()-0.5) * 0.12;
          p.radialZ = (Math.random()-0.5) * 0.12;
          p.sizeScale = 0.014 + Math.random() * 0.022;
        }
      } else {
        // Accumulation pile vibration (subtle)
        p.t += (Math.random()-0.5) * 0.002;
      }

      const pos = interpolatePath(targetPath, Math.max(0, Math.min(1, p.t)));
      const shift = getExplosionShift(p.t, currentActivePath, e);

      // Natural bouncing oscillation
      const bounce = Math.sin(p.t * 28 + p.radialX * 5) * 0.012;

      // Blast scatter
      let sX = 0, sY = 0, sZ = 0;
      if (currentActiveBlaster !== null && isBlasting && p.t > 0.3 && p.t < 0.75) {
        const factor = Math.sin((p.t - 0.3) / 0.45 * Math.PI);
        sX = (Math.random()-0.5) * 0.7 * factor;
        sY = -Math.random() * 0.5 * factor;
        sZ = (Math.random()-0.5) * 0.7 * factor;
      }

      dummy.position.set(pos.x + p.radialX * pileSpread + sX + shift.x, pos.y + bounce + sY + shift.y + pileY, pos.z + p.radialZ * pileSpread + sZ + shift.z);
      dummy.scale.setScalar(stop ? p.sizeScale * 1.35 : p.sizeScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(idx, dummy.matrix);

      // color variation per instance
      meshRef.current!.setColorAt(idx, COLORS[p.colorIdx]);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled>
      <sphereGeometry args={[1, 5, 5]} />
      <meshStandardMaterial roughness={0.85} metalness={0.25} vertexColors emissive={new THREE.Color('#3A2010')} emissiveIntensity={0.2} />
    </instancedMesh>
  );
};

// ─── PHASE 1: BLOCKAGE PLACEMENT RAYCASTER ────────────────────────────────────
// Invisible clickable plane along the active slant for blockage placement
const SlantClickPlane: React.FC<{
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  enabled: boolean;
  onPlace: (worldPoint: THREE.Vector3, normalizedT: number) => void;
}> = ({ activePath, enabled, onPlace }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Slant angle matches ChuteStructure crossAngle = 0.85 rad (~48.7°)
  const crossAngle = 0.85;
  const slantRotation: [number, number, number] = [0, 0, activePath === 'LEFT_SLANT' ? -crossAngle : crossAngle];

  const handleClick = useCallback((e: any) => {
    if (!enabled) return;
    e.stopPropagation();
    const point = e.point as THREE.Vector3;

    // Map clicked 3D point back to normalizedT along slant path
    const path = SLANT_PATHS[activePath];
    let bestT = 0.5;
    let bestDist = Infinity;
    for (let ti = 0; ti <= 100; ti++) {
      const t = ti / 100;
      const candidate = interpolatePath(path, t);
      const dist = candidate.distanceTo(point);
      if (dist < bestDist) { bestDist = dist; bestT = t; }
    }
    // Clamp to slant section strictly (avoid vertical columns)
    bestT = Math.max(0.26, Math.min(0.74, bestT));
    onPlace(point, bestT);
  }, [enabled, activePath, onPlace]);

  if (!enabled) return null;

  return (
    <mesh
      ref={meshRef}
      rotation={slantRotation}
      onClick={handleClick}
    >
      <planeGeometry args={[1.2, 4.0]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0} />
    </mesh>
  );
};

// ─── LEGACY BLOCKAGE MASS (for MQTT-driven radar blockages) ──────────────────
const BlockageMass: React.FC<{ zone: number; active: boolean; viewMode: string }> = ({ zone, active, viewMode }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (meshRef.current) {
      const pulse = active ? 1 + Math.sin(s.clock.elapsedTime * 5 + zone) * 0.04 : 0;
      meshRef.current.scale.setScalar(pulse);
      if (active) {
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        mat.emissive = new THREE.Color('#f59e0b');
        mat.emissiveIntensity = 0.4 + Math.sin(s.clock.elapsedTime * 6) * 0.2;
      }
    }
  });
  const positions: [number,number,number][] = [[-0.6, 0.9, 0],[0.6, 0.9, 0],[-1.2, -1.6, 0],[1.2, -1.6, 0]];
  const pos = positions[zone];
  if (!pos || !active) return null;
  return (
    <mesh ref={meshRef} position={pos}>
      <boxGeometry args={[0.48, 0.4, 0.45]} />
      <meshStandardMaterial color="#f59e0b" roughness={0.85} metalness={0.1} transparent opacity={viewMode === 'operator' ? 0.80 : 0.65} wireframe={viewMode === 'maintenance'} />
    </mesh>
  );
};

// ─── PHASE 7: RADAR SENSOR (upgraded) ─────────────────────────────────────────
const RadarSensor: React.FC<{
  position: [number,number,number];
  explodedPosition: [number,number,number];
  target: [number,number,number];
  mountPoint: [number,number,number];
  zone: number;
  distance: number;
  detecting: boolean;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
  isActivePath?: boolean;
}> = ({ position, explodedPosition, target, mountPoint, zone, distance, detecting, viewMode, isDark, isActivePath = true }) => {
  const groupRef     = useRef<THREE.Group>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const currentExplode = useRef(0);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.lookAt(target[0], target[1], target[2]);
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;
    if (outerGroupRef.current) {
      outerGroupRef.current.position.set(
        THREE.MathUtils.lerp(position[0], explodedPosition[0], e),
        THREE.MathUtils.lerp(position[1], explodedPosition[1], e),
        THREE.MathUtils.lerp(position[2], explodedPosition[2], e),
      );
    }
  });

  const bracketLength = useMemo(() => {
    return new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...mountPoint));
  }, [position, mountPoint]);

  const showDetailed = isHovered || isSelected || viewMode === 'maintenance';
  const sensorColor = !isActivePath ? '#475569' : (detecting ? '#FF3D00' : '#388BFD');
  const ledColor    = !isActivePath ? '#475569' : (detecting ? '#FF3D00' : '#00C853');

  return (
    <group
      ref={outerGroupRef}
      onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); setIsSelected(!isSelected); }}
    >
      {/* Mounting bracket */}
      <group>
        <group ref={(ref) => ref && ref.lookAt(mountPoint[0], mountPoint[1], mountPoint[2])}>
          <mesh position={[0, 0, bracketLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, bracketLength, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} wireframe={viewMode === 'maintenance'} />
          </mesh>
          <mesh position={[0, 0, bracketLength]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.12, 0.02, 0.12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.4} wireframe={viewMode === 'maintenance'} />
          </mesh>
        </group>
      </group>

      {/* Radar head (looking at target) */}
      <group ref={groupRef}>
        {/* Phase 7: Multi-part housing */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.18, 3]} />
          <meshStandardMaterial color={sensorColor} metalness={0.9} roughness={0.1} wireframe={viewMode === 'maintenance'} />
        </mesh>
        {/* Phase 7: Radome connector ring */}
        <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.085, 0.02, 16]} />
          <meshStandardMaterial color="#374151" metalness={0.85} roughness={0.2} wireframe={viewMode === 'maintenance'} />
        </mesh>
        {/* Phase 7: Status LED ring (3 LEDs) */}
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[
            Math.cos(i * Math.PI * 2 / 3) * 0.07,
            -0.08,
            Math.sin(i * Math.PI * 2 / 3) * 0.07,
          ]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshBasicMaterial color={i === 0 ? ledColor : i === 1 ? '#2196F3' : '#FFB300'} />
          </mesh>
        ))}
        {/* Back LED */}
        <mesh position={[0, 0, -0.09]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color={ledColor} />
        </mesh>

        {isActivePath && viewMode !== 'maintenance' && !showDetailed && (
          <group position={[0, 0, -0.04]}>
            <RadarHUDRings detecting={detecting} isDark={isDark} />
          </group>
        )}
        {isActivePath && viewMode !== 'maintenance' && <RadarScanningBeam detecting={detecting} />}

        {showDetailed ? (
          <HologramCard
            position={[0, 0.38, 0]}
            title={`RADAR Z0${zone}`}
            lines={[`DIST: ${distance.toFixed(2)}m`, detecting ? 'ALERT: BUILDUP' : 'SYS: SCANNING']}
            color={detecting ? '#FF3D00' : '#00E5FF'}
          />
        ) : (
          <CompactStatusBadge
            position={[0, 0.38, 0]}
            label={`Z${zone}`}
            color={detecting ? '#FF3D00' : (isDark ? '#00e5ff' : '#0052cc')}
            isDark={isDark}
          />
        )}
      </group>
    </group>
  );
};

// ─── PHASE 7: COMPRESSOR UNIT (upgraded) ─────────────────────────────────────
const CompressorUnit: React.FC<{
  pressure: number;
  motorTemp: number;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
}> = ({ pressure, motorTemp, viewMode, isDark }) => {
  const motorRef   = useRef<THREE.Group>(null);
  const groupRef   = useRef<THREE.Group>(null);
  const needleRef  = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const currentExplode = useRef(0);

  const position: [number, number, number]        = [-3.0, -1.5, 0];
  const explodedPosition: [number, number, number] = [-4.2, -1.8, 0.5];

  useFrame((_, delta) => {
    if (motorRef.current) {
      const speed = pressure > 100 ? 0.04 : pressure > 85 ? 0.025 : 0.01;
      motorRef.current.rotation.y += speed;
    }
    // Phase 7: animated pressure gauge needle
    if (needleRef.current) {
      const normalized = Math.max(0, Math.min(1, (pressure - 60) / 80));
      needleRef.current.rotation.z = THREE.MathUtils.lerp(
        needleRef.current.rotation.z,
        -Math.PI * 0.75 + normalized * Math.PI * 1.5,
        delta * 3.0,
      );
    }
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;
    if (groupRef.current) {
      groupRef.current.position.set(
        THREE.MathUtils.lerp(position[0], explodedPosition[0], e),
        THREE.MathUtils.lerp(position[1], explodedPosition[1], e),
        THREE.MathUtils.lerp(position[2], explodedPosition[2], e),
      );
    }
  });

  const pressureColor = pressure < 80 ? '#FF3D00' : pressure < 95 ? '#FFB300' : '#00C853';
  const showDetailed = isHovered || isSelected || viewMode === 'maintenance';

  return (
    <group ref={groupRef} rotation={[0, 0.3, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); setIsSelected(!isSelected); }}
    >
      {/* Base frame */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.7]} />
        <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
      </mesh>
      {/* Phase 7: I-beam legs */}
      {[-0.45, 0.45].map((x, i) => (
        <group key={i} position={[x, -0.28, 0]}>
          <mesh>
            <boxGeometry args={[0.04, 0.45, 0.55]} />
            <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.12, 0.45, 0.04]} />
            <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
          </mesh>
        </group>
      ))}

      {/* Main receiver tank */}
      <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.95, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.35} metalness={0.85} wireframe={viewMode === 'maintenance'} />
      </mesh>
      {/* Tank end caps */}
      {[-0.48, 0.48].map((x, i) => (
        <mesh key={i} position={[x + 0.15, 0, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.28, 0.28, 0.06, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.9} wireframe={viewMode === 'maintenance'} />
        </mesh>
      ))}
      {/* Phase 7: Tank rust spots */}
      {[[0.3, 0.1, 0.28], [-0.2, -0.1, -0.28]] .map((p, i) => (
        <mesh key={i} position={p as [number,number,number]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial {...MAT_RUST_ACCENT} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Phase 7: Large pressure gauge */}
      <group position={[0.15, 0.34, 0.12]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 14]} />
          <meshStandardMaterial color="#111827" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.022, 0]}>
          <circleGeometry args={[0.072, 14]} />
          <meshBasicMaterial color="#F0F0F0" />
        </mesh>
        {/* Tick marks */}
        {Array.from({ length: 9 }, (_, i) => {
          const angle = -Math.PI * 0.75 + i * (Math.PI * 1.5 / 8);
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.06, 0.024, Math.sin(angle) * 0.06]} rotation={[0, 0, angle]}>
              <boxGeometry args={[0.004, 0.012, 0.002]} />
              <meshBasicMaterial color="#555" />
            </mesh>
          );
        })}
        {/* Animated needle */}
        <mesh ref={needleRef} position={[0, 0.025, 0]}>
          <boxGeometry args={[0.004, 0.055, 0.002]} />
          <meshBasicMaterial color="#FF3D00" />
        </mesh>
        <mesh position={[0, 0.026, 0]}>
          <circleGeometry args={[0.008, 8]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        {/* Pressure color indicator */}
        <mesh position={[0, 0.027, 0]}>
          <circleGeometry args={[0.072, 14]} />
          <meshBasicMaterial color={pressureColor} transparent opacity={0.12} />
        </mesh>
      </group>

      {/* Motor */}
      <group ref={motorRef} position={[-0.38, 0.08, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.3, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.8} wireframe={viewMode === 'maintenance'} />
        </mesh>
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} position={[0, -0.12 + i * 0.06, 0]}>
            <cylinderGeometry args={[0.155, 0.155, 0.015, 16]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.3} wireframe={viewMode === 'maintenance'} />
          </mesh>
        ))}
        {/* Phase 7: Cooling fan (visible blades) */}
        {[0, 1, 2, 3].map(i => (
          <mesh key={i + 10} rotation={[0, i * Math.PI / 2, 0]} position={[0, 0.17, 0]}>
            <boxGeometry args={[0.12, 0.03, 0.02]} />
            <meshStandardMaterial color="#374151" metalness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Outlet pipe */}
      <mesh position={[0.68, 0.1, 0]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
      </mesh>
      {/* Phase 7: pipe elbow to chute */}
      <mesh position={[0.96, 0.2, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.08, 0.04, 8, 12, Math.PI / 2]} />
        <meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} />
      </mesh>

      {showDetailed ? (
        <HologramCard
          position={[0.15, 0.62, 0]}
          title="AIR COMPRESSOR"
          lines={[`PRESSURE: ${pressure.toFixed(0)} PSI`, `TEMP: ${motorTemp.toFixed(1)}°C`]}
          color={pressureColor}
        />
      ) : (
        <CompactStatusBadge position={[0.15, 0.55, 0]} label="COMP" color={pressureColor} isDark={isDark} />
      )}
    </group>
  );
};

// ─── NIGHA HUB ────────────────────────────────────────────────────────────────
const NighaHub: React.FC<{
  isOnline: boolean;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
}> = ({ isOnline, viewMode, isDark }) => {
  const ledRef   = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const currentExplode = useRef(0);
  const position: [number,number,number]        = [3.0, 1.2, 0];
  const explodedPosition: [number,number,number] = [4.2, 1.6, 0.5];

  useFrame((s, delta) => {
    if (ledRef.current) {
      (ledRef.current.material as THREE.MeshBasicMaterial).color.set(
        isOnline
          ? new THREE.Color().setHSL(0.35, 1, 0.4 + Math.sin(s.clock.elapsedTime * 2) * 0.15)
          : '#FF3D00',
      );
    }
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;
    if (groupRef.current) {
      groupRef.current.position.set(
        THREE.MathUtils.lerp(position[0], explodedPosition[0], e),
        THREE.MathUtils.lerp(position[1], explodedPosition[1], e),
        THREE.MathUtils.lerp(position[2], explodedPosition[2], e),
      );
    }
  });

  const showDetailed = isHovered || isSelected || viewMode === 'maintenance';
  const hubColor = isOnline ? '#00C853' : '#FF3D00';

  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); setIsSelected(!isSelected); }}
    >
      <mesh>
        <boxGeometry args={[0.55, 0.75, 0.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} wireframe={viewMode === 'maintenance'} />
      </mesh>
      <mesh position={[0, 0.08, 0.11]}>
        <boxGeometry args={[0.38, 0.28, 0.02]} />
        <meshBasicMaterial color="#0B1220" />
      </mesh>
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[-0.1 + i * 0.1, -0.22, 0.11]}>
          <circleGeometry args={[0.025, 8]} />
          <meshBasicMaterial color={i === 0 ? (isOnline ? '#00C853' : '#FF3D00') : i === 1 ? '#2196F3' : '#FFB300'} />
        </mesh>
      ))}
      <mesh ref={ledRef} position={[0.2, 0.3, 0.11]}>
        <circleGeometry args={[0.03, 8]} />
        <meshBasicMaterial color="#00C853" />
      </mesh>
      {showDetailed ? (
        <HologramCard position={[0, 0.45, 0.12]} title="NIGHA HUB" lines={[`STATUS: ${isOnline ? 'ONLINE' : 'OFFLINE'}`, 'MQTT: EMQX // CONNECTED']} color={hubColor} />
      ) : (
        <CompactStatusBadge position={[0, 0.45, 0.12]} label="HUB" color={hubColor} isDark={isDark} />
      )}
    </group>
  );
};

// ─── ENV SENSORS ──────────────────────────────────────────────────────────────
const EnvSensors: React.FC<{
  temperature: number; humidity: number;
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
}> = ({ temperature, humidity, viewMode, isDark }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const currentExplode = useRef(0);
  const position: [number,number,number]        = [2.8, -0.4, 0];
  const explodedPosition: [number,number,number] = [3.8, -0.4, 0.5];

  useFrame((_, delta) => {
    const targetExplode = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, targetExplode, delta * 4.0);
    const e = currentExplode.current;
    if (groupRef.current) {
      groupRef.current.position.set(
        THREE.MathUtils.lerp(position[0], explodedPosition[0], e),
        THREE.MathUtils.lerp(position[1], explodedPosition[1], e),
        THREE.MathUtils.lerp(position[2], explodedPosition[2], e),
      );
    }
  });

  const showDetailed = isHovered || isSelected || viewMode === 'maintenance';
  const envColor = isDark ? '#00E5FF' : '#0052cc';

  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); }}
      onPointerOut={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); setIsSelected(!isSelected); }}
    >
      <mesh>
        <boxGeometry args={[0.25, 0.38, 0.12]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} wireframe={viewMode === 'maintenance'} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.18, 0.30, 0.02]} />
        <meshBasicMaterial color="#0B1220" />
      </mesh>
      {showDetailed ? (
        <HologramCard position={[0, 0.28, 0.08]} title="ENV SENSOR" lines={[`TEMP: ${temperature.toFixed(1)}°C`, `HUMID: ${humidity.toFixed(0)}% RH`]} color={envColor} />
      ) : (
        <CompactStatusBadge position={[0, 0.28, 0.08]} label="ENV" color={envColor} isDark={isDark} />
      )}
    </group>
  );
};

// ─── INDUSTRIAL GROUND ────────────────────────────────────────────────────────
const IndustrialGround: React.FC<{
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  isDark: boolean;
}> = ({ viewMode, isDark }) => {
  const plantMapTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = isDark ? '#1e293b' : '#eceef1';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Concrete panel seam lines
    ctx.strokeStyle = isDark ? '#0f172a' : '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
    ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
    ctx.stroke();

    // Subtle safety markings frame
    ctx.strokeStyle = isDark ? 'rgba(232,182,26,0.3)' : 'rgba(232,182,26,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeRect(300, 300, 424, 424);

    return new THREE.CanvasTexture(canvas);
  }, [isDark]);

  return (
    <>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -2.8, 0]}>
        <planeGeometry args={[22, 16]} />
        <meshStandardMaterial
          map={plantMapTexture || undefined}
          roughness={0.95} metalness={0.1}
          transparent opacity={viewMode === 'maintenance' ? 0.15 : (isDark ? 0.35 : 0.15)}
          wireframe={viewMode === 'maintenance'}
        />
      </mesh>
      {[-6, 6].map((x, i) => (
        <group key={i} position={[x, 0, -3.5]}>
          <mesh><boxGeometry args={[0.14, 6.0, 0.12]} /><meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} /></mesh>
          <mesh><boxGeometry args={[0.36, 6.0, 0.04]} /><meshStandardMaterial {...MAT_DARK} wireframe={viewMode === 'maintenance'} /></mesh>
        </group>
      ))}
    </>
  );
};

// ─── WIRING DIAGRAM ───────────────────────────────────────────────────────────
const WiringDiagram: React.FC<{ viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance' }> = ({ viewMode }) => {
  const lineRefs = useRef<Array<THREE.Line | null>>([]);
  const currentExplode = useRef(0);
  const connections = useMemo(() => [
    { startNorm: [-1.75, 1.4, 0.4],  startExp: [-2.4, 1.8, 0.9]  },
    { startNorm: [1.75, 1.4, 0.4],   startExp: [2.4, 1.8, 0.9]   },
    { startNorm: [-1.65, -0.6, 0.4], startExp: [-2.3, -1.0, 0.9] },
    { startNorm: [1.65, -0.6, 0.4],  startExp: [2.3, -1.0, 0.9]  },
    { startNorm: [-0.85, 1.4, 0.6],  startExp: [-1.4, 1.8, 1.1]  },
    { startNorm: [0.85, 1.4, 0.6],   startExp: [1.4, 1.8, 1.1]   },
    { startNorm: [-0.85, -0.6, 0.6], startExp: [-1.4, -0.9, 1.1] },
    { startNorm: [0.85, -0.6, 0.6],  startExp: [1.4, -0.9, 1.1]  },
    { startNorm: [-3.0, -1.5, 0],    startExp: [-4.2, -1.8, 0.5] },
    { startNorm: [2.8, -0.4, 0],     startExp: [3.8, -0.4, 0.5]  },
  ], []);
  const hubNorm = [3.0, 1.2, 0]; const hubExp = [4.2, 1.6, 0.5];

  useFrame((_, delta) => {
    const target = viewMode === 'maintenance' ? 1.0 : 0.0;
    currentExplode.current = THREE.MathUtils.lerp(currentExplode.current, target, delta * 4.0);
    const e = currentExplode.current;
    const hubX = THREE.MathUtils.lerp(hubNorm[0], hubExp[0], e);
    const hubY = THREE.MathUtils.lerp(hubNorm[1], hubExp[1], e);
    const hubZ = THREE.MathUtils.lerp(hubNorm[2], hubExp[2], e);
    connections.forEach((conn, idx) => {
      const line = lineRefs.current[idx];
      if (line) {
        const sX = THREE.MathUtils.lerp(conn.startNorm[0], conn.startExp[0], e);
        const sY = THREE.MathUtils.lerp(conn.startNorm[1], conn.startExp[1], e);
        const sZ = THREE.MathUtils.lerp(conn.startNorm[2], conn.startExp[2], e);
        const positions = line.geometry.attributes.position.array as Float32Array;
        positions[0] = sX; positions[1] = sY; positions[2] = sZ;
        positions[3] = hubX; positions[4] = hubY; positions[5] = hubZ;
        line.geometry.attributes.position.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).opacity = e * 0.45;
      }
    });
  });

  if (viewMode !== 'maintenance' && currentExplode.current < 0.01) return null;
  return (
    <group>
      {connections.map((_, idx) => (
        <line key={idx} ref={(el) => { lineRefs.current[idx] = el as unknown as THREE.Line | null; }}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#eab308" transparent opacity={0} linewidth={1.5} />
        </line>
      ))}
    </group>
  );
};

// ─── PHASE 9: CAMERA MANAGER (7 presets) ─────────────────────────────────────
interface CameraTarget {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const CameraManager: React.FC<{
  viewMode: 'operator' | 'transparent' | 'cutaway' | 'maintenance';
  controlsRef: React.RefObject<any>;
  focusTarget?: { pos: THREE.Vector3; target: THREE.Vector3 } | null;
  cameraPreset?: string | null;
}> = ({ viewMode, controlsRef, focusTarget, cameraPreset }) => {
  const { camera } = useThree();
  const lastMode = useRef(viewMode);
  const transitionTime = useRef(0);
  const activeFocus = useRef<CameraTarget | null>(null);

  const presets = useMemo(() => ({
    operator:         { pos: new THREE.Vector3(3.8, 2.2, 6.5),  target: new THREE.Vector3(0, 0.3, 0) },
    transparent:      { pos: new THREE.Vector3(0, 0.5, 7.5),    target: new THREE.Vector3(0, 0.5, 0) },
    cutaway:          { pos: new THREE.Vector3(7.0, 0.5, 0),    target: new THREE.Vector3(0, 0.5, 0) },
    maintenance:      { pos: new THREE.Vector3(5.5, 4.5, 5.5),  target: new THREE.Vector3(0, 0.5, 0) },
    overview:         { pos: new THREE.Vector3(0, 6, 10),        target: new THREE.Vector3(0, 0, 0)   },
    front:            { pos: new THREE.Vector3(0, 0.3, 8.5),    target: new THREE.Vector3(0, 0.3, 0) },
    left:             { pos: new THREE.Vector3(-8.5, 0.3, 0),   target: new THREE.Vector3(0, 0.3, 0) },
    right:            { pos: new THREE.Vector3(8.5, 0.3, 0),    target: new THREE.Vector3(0, 0.3, 0) },
    top:              { pos: new THREE.Vector3(0, 8.5, 0),      target: new THREE.Vector3(0, 0.3, 0) },
    'cross-section':  { pos: new THREE.Vector3(0, 0.3, 8.5),    target: new THREE.Vector3(0, 0.3, 0) },
  }), []);

  useEffect(() => {
    if (viewMode !== lastMode.current) {
      lastMode.current = viewMode;
      transitionTime.current = 1.8;
      activeFocus.current = null;
    }
  }, [viewMode]);

  useEffect(() => {
    if (focusTarget) {
      activeFocus.current = focusTarget;
      transitionTime.current = 1.8;
    }
  }, [focusTarget]);

  const lastPreset = useRef(cameraPreset);
  useEffect(() => {
    if (cameraPreset !== lastPreset.current) {
      lastPreset.current = cameraPreset;
      if (cameraPreset) {
        transitionTime.current = 1.8;
        activeFocus.current = (presets as any)[cameraPreset];
      }
    }
  }, [cameraPreset, presets]);

  useFrame((_, delta) => {
    if (transitionTime.current > 0) {
      transitionTime.current -= delta;
      const target = activeFocus.current ?? (presets as any)[viewMode];
      if (!target) return;
      camera.position.lerp(target.pos, delta * 3.5);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(target.target, delta * 3.5);
        controlsRef.current.update();
      }
    }
  });

  return null;
};

// ─── ACTIVE PATH INDICATOR ────────────────────────────────────────────────────
const ActivePathIndicator: React.FC<{
  activePath: 'LEFT_SLANT' | 'RIGHT_SLANT';
  blockagePosition: string;
  blockageDistance: number;
  nearestSolenoidGroup: number;
  status: string;
  simulationMode: boolean;
  isDark: boolean;
}> = ({ activePath, blockagePosition, blockageDistance, nearestSolenoidGroup, status, simulationMode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const bgRef    = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.position.y = 2.05 + Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    if (bgRef.current) (bgRef.current.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(state.clock.elapsedTime * 1.5) * 0.1;
  });

  const hasBlockage = blockagePosition !== 'None' && blockagePosition !== '' && blockageDistance < 1.0;
  const pathLabel = activePath === 'LEFT_SLANT' ? 'LEFT SLANT  \\' : 'RIGHT SLANT  /';
  const pathColor = activePath === 'LEFT_SLANT' ? '#00D4FF' : '#A855F7';
  const statusColor = status === 'Blocked' ? '#F85149' : status === 'Buildup' ? '#D29922' : status === 'Blasting' ? '#388BFD' : '#34D399';
  const solenoidLabel = `S${nearestSolenoidGroup}A · S${nearestSolenoidGroup}B · S${nearestSolenoidGroup}C · S${nearestSolenoidGroup}D`;

  return (
    <group ref={groupRef} position={[0, 2.05, 0.7]}>
      <mesh ref={bgRef} position={[0, 0, -0.01]}>
        <planeGeometry args={[1.6, 0.88]} />
        <meshBasicMaterial color="#001122" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[1.64, 0.92]} />
        <meshBasicMaterial color={pathColor} wireframe transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Text position={[0, 0.28, 0]} fontSize={0.1} color={pathColor} anchorX="center" anchorY="middle" letterSpacing={0.04}>{pathLabel}</Text>
      {simulationMode && (
        <Text position={[0.55, 0.43, 0]} fontSize={0.055} color="#F59E0B" anchorX="center" anchorY="middle">SIM</Text>
      )}
      <Text position={[0, 0.11, 0]} fontSize={0.072} color={statusColor} anchorX="center" anchorY="middle" letterSpacing={0.03}>{status.toUpperCase()}</Text>
      <mesh position={[0, 0.01, 0]}>
        <planeGeometry args={[1.4, 0.004]} />
        <meshBasicMaterial color={pathColor} transparent opacity={0.35} />
      </mesh>
      <Text position={[0, -0.1, 0]} fontSize={0.065} color={hasBlockage ? '#F85149' : '#34D399'} anchorX="center" anchorY="middle" letterSpacing={0.02}>
        {hasBlockage ? `${blockagePosition}  @  ${blockageDistance.toFixed(2)}m` : 'FLOW  CLEAR'}
      </Text>
      <Text position={[0, -0.26, 0]} fontSize={0.058} color={hasBlockage ? '#F59E0B' : '#475569'} anchorX="center" anchorY="middle">
        {hasBlockage ? solenoidLabel : 'NO BLAST REQUIRED'}
      </Text>
    </group>
  );
};

// ─── MAIN DIGITAL TWIN EXPORT ─────────────────────────────────────────────────
export const ChuteDigitalTwin: React.FC<{ theme?: 'dark' | 'light'; rotationX?: number }> = ({ theme = 'dark', rotationX = 0 }) => {
  const {
    activeChuteId, chuteStatus, radars, blasters, compressor, health,
    activeBlasterNumber, liveTemperature, liveHumidity,
    activePath, simulationMode,
    blockagePosition, blockageDistance, nearestSolenoidGroup,
    devBlockages, demoKpis, activeSolenoidValves, prediction, isMqttConnected,
    addDevBlockage, clearDevBlockages, updateDevBlockage, updateStatus, setDemoKpis,
    setBlockageInfo,
    setSimulationModeState, setActivePath, applyLocalization,
    setActiveBlasterNumber, setActiveSolenoidValves,
  } = useTelemetryStore();

  const { token } = useAuthStore();
  const [flowActive, setFlowActive] = useState(true);

  const currentActivePath = activePath || 'LEFT_SLANT';
  const pressure  = compressor?.pressure ?? 110;
  const motorTemp = compressor?.motorTemperature ?? 28;
  const hubOnline = health?.isOnline ?? true;
  const isDark    = theme === 'dark';

  const [viewMode, setViewMode] = useState<'operator' | 'transparent' | 'cutaway' | 'maintenance'>('cutaway');
  const [canvasKey, setCanvasKey] = useState(0);
  const controlsRef = useRef<any>(null);
  const [isContextLost, setIsContextLost] = useState(false);
  const contextLossCountRef = useRef(0);
  const lastContextLossTimeRef = useRef(0);

  // Debug mode and camera preset states for engineering validation
  const [debugMode, setDebugMode] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<string | null>(null);

  // Phase 9: camera focus target
  const [cameraFocus, setCameraFocus] = useState<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // Phase 1–4: interaction state from hook
  const {
    devBlocking, enableBlockingMode, disableBlockingMode, setSeverity,
    solenoidSelection, selectSolenoid, deselectSolenoid,
    blast, fireBlast,
    demo, startDemo, stopDemo, pauseDemo, resumeDemo,
    BLAST_RADII,
  } = useDigitalTwinState();

  // Selected blockage for UI
  const [selectedBlockageId, setSelectedBlockageId] = useState<string | null>(null);

  // Phase 1: place blockage on slant click
  const handleBlockagePlacement = useCallback((_worldPoint: THREE.Vector3, normalizedT: number) => {
    if (!devBlocking.enabled) return;
    
    // Snap to the precise mathematical centerline path to avoid any click depth errors
    const path = SLANT_PATHS[currentActivePath];
    const pathPos = interpolatePath(path, normalizedT);

    const newBlockage: DevBlockage = {
      id: `blk_${Date.now()}`,
      worldPosition: [pathPos.x, pathPos.y, pathPos.z],
      normalizedT,
      severity: devBlocking.severity,
      cleared: false,
      fragmenting: false,
    };
    addDevBlockage(newBlockage);
    updateStatus('Blocked');
    disableBlockingMode();

    // Automated Feedback Loop: Radar detects block, signals air blasters, and triggers nearest blaster/valves after 1.5 seconds
    setTimeout(() => {
      let nearestGroup = 1;
      if (currentActivePath === 'LEFT_SLANT') {
        nearestGroup = normalizedT < 0.5 ? 1 : 4;
      } else {
        nearestGroup = normalizedT < 0.5 ? 2 : 3;
      }
      setActiveBlasterNumber(nearestGroup);
      setActiveSolenoidValves([nearestGroup * 2 - 1, nearestGroup * 2]);
      updateStatus('Blasting');
    }, 1500);
  }, [devBlocking.enabled, devBlocking.severity, currentActivePath, addDevBlockage, updateStatus, disableBlockingMode, setActiveBlasterNumber, setActiveSolenoidValves]);

  // Sync devBlockages to the telemetry store for visualization and dashboard metrics
  useEffect(() => {
    if (!simulationMode) return;

    const active = devBlockages.find(b => !b.cleared && !b.fragmenting);
    if (active) {
      const distance = 4.0 * (1.0 - active.normalizedT);
      let zoneName = 'Zone 1';
      let group = 1;

      if (currentActivePath === 'LEFT_SLANT') {
        if (active.normalizedT < 0.5) {
          zoneName = 'Zone 1 (Upper Right Slant)';
          group = 1;
        } else {
          zoneName = 'Zone 4 (Lower Left Slant)';
          group = 4;
        }
      } else {
        if (active.normalizedT < 0.5) {
          zoneName = 'Zone 2 (Upper Left Slant)';
          group = 2;
        } else {
          zoneName = 'Zone 3 (Lower Right Slant)';
          group = 3;
        }
      }

      setBlockageInfo(zoneName, distance, group);
    } else {
      setBlockageInfo('None', 3.5, 1);
    }
  }, [devBlockages, simulationMode, currentActivePath, setBlockageInfo]);

  // Sync simulation mode toggling to the backend database
  const handleToggleSimulationMode = useCallback(async (mode: boolean) => {
    if (!activeChuteId) return;
    setSimulationModeState(mode);
    try {
      const res = await fetch(`/_/backend/industry/chutes/${activeChuteId}/simulation-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle mode');
      const chute = data.chute;
      if (chute) {
        applyLocalization({
          activePath: chute.activePath || currentActivePath,
          simulationMode: mode,
          blockagePosition: chute.blockagePosition || 'None',
          blockageDistance: chute.blockageDistance ?? 3.5,
          nearestSolenoidGroup: chute.nearestSolenoidGroup ?? 1,
          status: chute.status || 'Normal',
        });
      }
    } catch (err: any) {
      console.error(`Failed to sync simulation mode: ${err.message}`);
    }
  }, [activeChuteId, token, currentActivePath, setSimulationModeState, applyLocalization]);

  // Effect to intercept store 'Blasting' status (fired from dashboard panels) and run local 3D blast
  useEffect(() => {
    if (chuteStatus === 'Blasting' && !blast.active) {
      // Use activeBlasterNumber if set, otherwise fallback to recommended nearest group
      const blasterNo = activeBlasterNumber || nearestSolenoidGroup || 1;
      const blasterPos = BLASTER_WORLD_POSITIONS[blasterNo];
      if (!blasterPos) return;

      const path = SLANT_PATHS[currentActivePath];
      const activeBlocks = devBlockages.filter(b => !b.cleared && !b.fragmenting);
      let hitId: string | null = null;
      let partialId: string | null = null;

      for (const blk of activeBlocks) {
        const blockPos = interpolatePath(path, blk.normalizedT);
        blockPos.y += 0.5;
        const dist = blasterPos.distanceTo(blockPos);
        const effectiveRadius = BLAST_RADII[blk.severity];

        if (dist <= effectiveRadius) {
          hitId = blk.id;
        } else if (dist <= effectiveRadius * 2.0) {
          partialId = blk.id;
        }
      }

      const hitBlockage = !!hitId;
      const partialHit  = !!partialId;

      fireBlast(blasterNo, blasterPos, hitBlockage, partialHit, () => {
        if (simulationMode) {
          if (hitId) {
            updateDevBlockage(hitId, { fragmenting: true });
            setTimeout(() => {
              updateDevBlockage(hitId!, { cleared: true, fragmenting: false });
              const remaining = devBlockages.filter(b => b.id !== hitId && !b.cleared);
              if (remaining.length === 0) {
                updateStatus('Normal');
              }
              setDemoKpis({ blastSuccess: true, blockCleared: true, effectiveness: 90 + Math.round(Math.random() * 10) });
            }, 1400);
          } else if (partialId) {
            const blk = devBlockages.find(b => b.id === partialId);
            if (blk) {
              updateDevBlockage(partialId, { normalizedT: blk.normalizedT + 0.04 });
            }
            updateStatus('Normal');
          } else {
            updateStatus('Normal');
          }
        }

        // Reset active blaster/valves in the store after blast completes
        setActiveBlasterNumber(null);
        setActiveSolenoidValves([]);
      });
    }
  }, [chuteStatus, blast.active, simulationMode, activeBlasterNumber, nearestSolenoidGroup, currentActivePath, devBlockages, fireBlast, BLAST_RADII, updateDevBlockage, updateStatus, setDemoKpis, setActiveBlasterNumber, setActiveSolenoidValves]);

  // Phase 4: solenoid click — select + compute blast radius preview
  const handleSolenoidSelect = useCallback((blasterNo: number, worldPos: THREE.Vector3) => {
    if (solenoidSelection.blasterNumber === blasterNo) {
      deselectSolenoid();
      return;
    }

    // Find nearest dev blockage for impact point estimate
    let impactPoint: THREE.Vector3 | null = null;
    const path = SLANT_PATHS[currentActivePath];
    if (devBlockages.length > 0) {
      const nearest = devBlockages.find(b => !b.cleared);
      if (nearest) {
        impactPoint = interpolatePath(path, nearest.normalizedT);
        impactPoint.y += 0.5; // scene group offset
      }
    }

    const radius = BLAST_RADII.medium;
    selectSolenoid(blasterNo, worldPos, radius, impactPoint);

    // Phase 9: auto-zoom camera to solenoid
    setCameraFocus({
      pos: worldPos.clone().add(new THREE.Vector3(0, 1.5, 2.5)),
      target: worldPos.clone(),
    });
  }, [solenoidSelection.blasterNumber, deselectSolenoid, devBlockages, currentActivePath, BLAST_RADII.medium, selectSolenoid]);

  // Phase 3: fire blast and determine effectiveness
  const handleConfirmBlast = useCallback(() => {
    if (!solenoidSelection.blasterNumber || !solenoidSelection.solenoidPosition) return;

    const solenoidPos = solenoidSelection.solenoidPosition;
    const path = SLANT_PATHS[currentActivePath];

    // Find all active (non-cleared) blockages and compute distances
    const activeBlocks = devBlockages.filter(b => !b.cleared && !b.fragmenting);
    let hitId: string | null = null;
    let partialId: string | null = null;

    for (const blk of activeBlocks) {
      const blockPos = interpolatePath(path, blk.normalizedT);
      blockPos.y += 0.5;
      const dist = solenoidPos.distanceTo(blockPos);
      const effectiveRadius = BLAST_RADII[blk.severity];

      if (dist <= effectiveRadius) {
        hitId = blk.id;
      } else if (dist <= effectiveRadius * 2.0) {
        partialId = blk.id;
      }
    }

    const hitBlockage = !!hitId;
    const partialHit  = !!partialId;

    // Phase 9: auto-zoom to blast area
    setCameraFocus({
      pos: solenoidPos.clone().add(new THREE.Vector3(0, 0.8, 2.0)),
      target: solenoidPos.clone(),
    });

    fireBlast(solenoidSelection.blasterNumber, solenoidPos, hitBlockage, partialHit, () => {
      // After blast completes:
      if (hitId) {
        updateDevBlockage(hitId, { fragmenting: true });
        // After fragmentation animation: clear
        setTimeout(() => {
          updateDevBlockage(hitId!, { cleared: true, fragmenting: false });
          const remaining = devBlockages.filter(b => b.id !== hitId && !b.cleared);
          if (remaining.length === 0) {
            updateStatus('Normal');
          }
          // Phase 5: update demo KPIs
          setDemoKpis({ blastSuccess: true, blockCleared: true, effectiveness: 88 + Math.round(Math.random() * 10) });
        }, 1400);
      } else if (partialId) {
        // Partial movement — shift blockage slightly downstream
        const blk = devBlockages.find(b => b.id === partialId);
        if (blk) {
          updateDevBlockage(partialId, { normalizedT: blk.normalizedT + 0.04 });
        }
      }
      deselectSolenoid();
      // Reset camera to operator view after 2s
      setTimeout(() => setCameraFocus(null), 2500);
    });
  }, [solenoidSelection, devBlockages, currentActivePath, fireBlast, BLAST_RADII, updateDevBlockage, deselectSolenoid, updateStatus, setDemoKpis]);

  // Phase 5: Demo callbacks
  const handleStartDemo = useCallback(() => {
    clearDevBlockages();
    updateStatus('Normal');
    setDemoKpis(null);

    let demoBlockageId = '';

    startDemo({
      onBlockage: () => {
        // Auto-place a medium blockage at t=0.45 on the active slant
        const path = SLANT_PATHS[currentActivePath];
        const t = 0.45;
        const worldPt = interpolatePath(path, t);
        const blk: DevBlockage = {
          id: `demo_blk_${Date.now()}`,
          worldPosition: [worldPt.x, worldPt.y + 0.5, worldPt.z],
          normalizedT: t,
          severity: 'medium',
          cleared: false,
          fragmenting: false,
        };
        demoBlockageId = blk.id;
        addDevBlockage(blk);
        updateStatus('Blocked');
        setCameraFocus({
          pos: new THREE.Vector3(worldPt.x + 2, worldPt.y + 2, worldPt.z + 3),
          target: new THREE.Vector3(worldPt.x, worldPt.y + 0.5, worldPt.z),
        });
      },
      onBlast: () => {
        // Auto-select blaster 1 and fire
        const blasterPos = BLASTER_WORLD_POSITIONS[nearestSolenoidGroup] ?? BLASTER_WORLD_POSITIONS[1];
        setCameraFocus({
          pos: blasterPos.clone().add(new THREE.Vector3(0, 1.5, 2.5)),
          target: blasterPos.clone(),
        });
        fireBlast(nearestSolenoidGroup, blasterPos, true, false, () => {
          if (demoBlockageId) {
            updateDevBlockage(demoBlockageId, { fragmenting: true });
            setTimeout(() => {
              updateDevBlockage(demoBlockageId, { cleared: true, fragmenting: false });
              updateStatus('Normal');
            }, 1400);
          }
        });
      },
      onClear: () => {
        setCameraFocus({ pos: new THREE.Vector3(3.8, 2.2, 6.5), target: new THREE.Vector3(0, 0.3, 0) });
      },
      onComplete: () => {
        setDemoKpis({ blastSuccess: true, blockCleared: true, effectiveness: 94 });
        setCameraFocus(null);
      },
    });
  }, [clearDevBlockages, updateStatus, setDemoKpis, startDemo, currentActivePath, addDevBlockage, fireBlast, nearestSolenoidGroup, updateDevBlockage]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Toast events state
  const [events, setEvents] = useState<{ id: string; message: string; type: 'info' | 'warning' | 'alert' | 'success' }[]>([]);

  const addEvent = useCallback((message: string, type: 'info' | 'warning' | 'alert' | 'success' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setEvents(prev => [...prev.slice(-2), { id, message, type }]); // Limit to 3 concurrent notifications
    setTimeout(() => {
      setEvents(prev => prev.filter(e => e.id !== id));
    }, 4500);
  }, []);

  // Sync state changes to event callouts
  useEffect(() => {
    if (chuteStatus === 'Normal') {
      addEvent('System healthy — Material flowing normally', 'success');
    } else if (chuteStatus === 'Buildup') {
      addEvent('Buildup detected on active slant', 'warning');
    } else if (chuteStatus === 'Blocked') {
      addEvent('Critical blockage detected!', 'alert');
    } else if (chuteStatus === 'Blasting') {
      addEvent('Autonomous blasting sequence initiated', 'info');
    }
  }, [chuteStatus]);

  useEffect(() => {
    if (activeBlasterNumber !== null) {
      addEvent(`AI targeted Smart Air Blaster B${activeBlasterNumber}`, 'info');
    }
  }, [activeBlasterNumber]);

  useEffect(() => {
    if (activeSolenoidValves.length > 0) {
      addEvent(`Solenoid Valves SV${activeSolenoidValves.join(', ')} opening`, 'info');
    }
  }, [activeSolenoidValves]);

  useEffect(() => {
    if (blast.active) {
      addEvent(`Blast executing: ${blast.lifecycle.toUpperCase().replace('_', ' ')}`, 'info');
    }
  }, [blast.active, blast.lifecycle]);

  useEffect(() => {
    if (demoKpis) {
      addEvent(`Blast Success: ${demoKpis.effectiveness}% Effectiveness`, 'success');
    }
  }, [demoKpis]);

  // Style tokens (Refined for premium SCADA control room aesthetic)
  const twinBg          = isDark ? '#0b0f19' : '#eceef1';
  const overlayBg       = isDark ? '#0f172a' : '#ffffff'; // Slate-900 matte panel style
  const overlayBorder   = isDark ? '#1e293b' : '#cbd5e1'; // solid slate line
  const overlayText     = isDark ? '#f8fafc' : '#0f172a';
  const overlayMuted    = isDark ? '#64748b' : '#64748b';
  const btnActive       = '#0284c7';
  const btnBg           = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(241, 245, 249, 0.9)';

  // Phase 3: blast animation props per blaster
  const getBlastLifecycle = (blasterNo: number) => {
    if (blast.active && blast.blasterNumber === blasterNo) return blast.lifecycle;
    return 'idle' as const;
  };

  // Helper variables for SCADA progress bars
  const flowPercentage = chuteStatus === 'Normal' ? 100 : chuteStatus === 'Buildup' ? 45 : 0;
  const pressurePercentage = Math.round((pressure / 150) * 100);
  const predictionPercentage = prediction?.blockageProbability ?? 8;
  const avgHealth = Math.round(
    ((compressor?.healthScore ?? 100) +
      (blasters.reduce((acc, b) => acc + b.healthScore, 0) / (blasters.length || 1))) / 2
  );

  const valveA = solenoidSelection.blasterNumber ? solenoidSelection.blasterNumber * 2 - 1 : 1;
  const valveB = solenoidSelection.blasterNumber ? solenoidSelection.blasterNumber * 2 : 2;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: twinBg, overflow: 'hidden', cursor: devBlocking.pendingPlacement ? 'crosshair' : 'default', fontFamily: "'Inter', sans-serif" }}>

      {/* VIEWPORT TOP BAR — Minimal & Professional SCADA Controls */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        
        {/* Left Side: System title / Feed source info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: overlayBg, border: `1px solid ${overlayBorder}`, padding: '6px 12px', borderRadius: '6px', pointerEvents: 'auto' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: overlayText, letterSpacing: '0.5px' }}>FEED POINT ACTIVE // CHUTE X-01</span>
        </div>

        {/* Right Side: View Mode, Presets, and Settings Gear */}
        <div style={{ display: 'flex', gap: '6px', pointerEvents: 'auto' }}>
          {/* Preset Camera Views */}
          <div style={{ display: 'flex', gap: '3px', background: btnBg, border: `1px solid ${overlayBorder}`, padding: '3px', borderRadius: '6px' }}>
            {(['front', 'left', 'right', 'top'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setCameraPreset(preset);
                  setTimeout(() => setCameraPreset(null), 1500);
                }}
                style={{
                  padding: '3px 8px', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase',
                  background: cameraPreset === preset ? btnActive : 'transparent',
                  color: cameraPreset === preset ? '#fff' : overlayText,
                  border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 100ms ease'
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Settings Drawer Button */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            style={{
              padding: '6px 12px', fontSize: '10px', fontWeight: 700,
              background: drawerOpen ? btnActive : btnBg,
              color: drawerOpen ? '#fff' : overlayText,
              border: `1px solid ${overlayBorder}`, borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 150ms ease'
            }}
          >
            ⚙ {drawerOpen ? 'CLOSE CONTROLS' : 'SIMULATION CONTROLS'}
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION CONTAINER — Temporary Event Callouts */}
      <div style={{ position: 'absolute', top: 54, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '6px', width: 280, pointerEvents: 'none' }}>
        {events.map(ev => (
          <div
            key={ev.id}
            style={{
              padding: '8px 12px', background: isDark ? '#1e293b' : '#ffffff',
              borderLeft: `4px solid ${ev.type === 'success' ? '#10B981' : ev.type === 'warning' ? '#F59E0B' : ev.type === 'alert' ? '#EF4444' : '#3B82F6'}`,
              borderRadius: '0 6px 6px 0', borderTop: `1px solid ${overlayBorder}`, borderRight: `1px solid ${overlayBorder}`, borderBottom: `1px solid ${overlayBorder}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px',
              color: overlayText, animation: 'demoSlide 0.2s ease', display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: 'auto'
            }}
          >
            <span style={{ fontSize: '11px' }}>
              {ev.type === 'success' ? '✓' : ev.type === 'warning' ? '⚠' : ev.type === 'alert' ? '🚨' : 'ℹ'}
            </span>
            <div>{ev.message}</div>
          </div>
        ))}
      </div>

      {/* COLLAPSIBLE SIDE DRAWER — Control Panel & Selected Components details */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 20,
          background: overlayBg, borderLeft: `1px solid ${overlayBorder}`,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', padding: '60px 16px 16px 16px',
          display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', pointerEvents: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${overlayBorder}`, paddingBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: overlayText }}>SYSTEM UTILITIES</span>
          <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: overlayMuted, cursor: 'pointer', fontSize: '12px' }}>✕</button>
        </div>

        {/* Component Selector Details (Asset drawer) */}
        {solenoidSelection.blasterNumber !== null ? (
          <div style={{ padding: '12px', background: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#EA580C', fontWeight: 800 }}>SMART AIR BLASTER B{solenoidSelection.blasterNumber}</h4>
            <div style={{ fontSize: '10px', color: overlayText, lineHeight: '1.6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Asset ID:</div><div style={{ fontWeight: 'bold' }}>SAB-00{solenoidSelection.blasterNumber}</div>
              <div>Health Score:</div><div style={{ color: '#10b981', fontWeight: 'bold' }}>{blasters.find((b: any) => b.blasterNumber === solenoidSelection.blasterNumber)?.healthScore ?? 100}%</div>
              <div>Operating Valv:</div><div>SV{valveA}, SV{valveB}</div>
              <div>Blast Radius:</div><div>{solenoidSelection.blastRadius.toFixed(1)}m</div>
            </div>
            {!blast.active && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                <button onClick={handleConfirmBlast} style={{ flex: 1, padding: '6px 10px', background: '#EA580C', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                  🚀 TRIGGER BLAST
                </button>
                <button onClick={deselectSolenoid} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${overlayBorder}`, borderRadius: '4px', color: overlayMuted, fontSize: '10px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : selectedBlockageId ? (
          <div style={{ padding: '12px', background: isDark ? '#1e293b' : '#f1f5f9', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#EF4444', fontWeight: 800 }}>ACTIVE BLOCKAGE</h4>
            <div style={{ fontSize: '10px', color: overlayText, lineHeight: '1.6', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>Blockage ID:</div><div style={{ fontFamily: 'monospace' }}>{selectedBlockageId.slice(0, 8)}</div>
              <div>Severity Level:</div><div style={{ textTransform: 'uppercase', color: '#f59e0b', fontWeight: 'bold' }}>{devBlockages.find(b => b.id === selectedBlockageId)?.severity}</div>
              <div>Centerline Pos:</div><div>{devBlockages.find(b => b.id === selectedBlockageId)?.normalizedT.toFixed(2)} T</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px dashed ${overlayBorder}`, textAlign: 'center', fontSize: '10px', color: overlayMuted }}>
            Click on any Blaster or Blockage in the 3D scene to inspect Asset details here.
          </div>
        )}

        {/* Manual Simulation Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `1px solid ${overlayBorder}`, paddingTop: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: overlayText, textTransform: 'uppercase' }}>Simulation Utilities</div>
          
          {/* Mode toggle */}
          <button
            onClick={() => handleToggleSimulationMode(!simulationMode)}
            style={{
              padding: '8px', fontSize: '10px', fontWeight: 700,
              background: simulationMode ? '#EA580C' : '#10B981',
              color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            {simulationMode ? '⚠ RETREAT TO PROD MODE' : '⚙ ENGAGE SIMULATION'}
          </button>

          {simulationMode && (
            <>
              {/* Slant path selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: overlayMuted }}>Active Slant:</span>
                <button
                  onClick={() => setActivePath(activePath === 'LEFT_SLANT' ? 'RIGHT_SLANT' : 'LEFT_SLANT')}
                  style={{ padding: '4px 8px', fontSize: '9px', fontWeight: 600, background: btnBg, border: `1px solid ${overlayBorder}`, color: overlayText, borderRadius: '4px', cursor: 'pointer' }}
                >
                  {activePath === 'LEFT_SLANT' ? 'LEFT (\\)' : 'RIGHT (/)'}
                </button>
              </div>

              {/* Flow Active toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: overlayMuted }}>Material Feed:</span>
                <button
                  onClick={() => setFlowActive(!flowActive)}
                  style={{ padding: '4px 8px', fontSize: '9px', fontWeight: 600, background: flowActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${flowActive ? '#10b981' : '#ef4444'}`, color: flowActive ? '#10b981' : '#ef4444', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {flowActive ? '▶ FLOW RUNNING' : '⏸ FLOW PAUSED'}
                </button>
              </div>

              {/* Blockage injector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '6px', border: `1px solid ${overlayBorder}` }}>
                <div style={{ fontSize: '9px', color: overlayMuted, fontWeight: 600 }}>INJECT BLOCKAGE PRESET</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['small', 'medium', 'large'] as BlockingSeverity[]).map(sev => (
                    <button key={sev} onClick={() => setSeverity(sev)} style={{ flex: 1, padding: '3px', fontSize: '8px', fontWeight: 700, background: devBlocking.severity === sev ? '#EA580C' : 'transparent', color: devBlocking.severity === sev ? '#fff' : overlayMuted, border: `1px solid ${devBlocking.severity === sev ? '#EA580C' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase' }}>
                      {sev}
                    </button>
                  ))}
                </div>
                <button onClick={() => devBlocking.pendingPlacement ? disableBlockingMode() : enableBlockingMode(devBlocking.severity)} style={{ width: '100%', padding: '6px', fontSize: '10px', fontWeight: 700, background: devBlocking.pendingPlacement ? '#ef4444' : btnBg, color: devBlocking.pendingPlacement ? '#fff' : overlayText, border: `1px solid ${devBlocking.pendingPlacement ? '#ef4444' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer', marginTop: '2px' }}>
                  {devBlocking.pendingPlacement ? '✕ Cancel Injector' : '+ Click Slant to Inject'}
                </button>
              </div>
            </>
          )}

          {/* Client Demo trigger */}
          <button
            onClick={demo.running ? stopDemo : handleStartDemo}
            style={{ padding: '8px', fontSize: '10px', fontWeight: 700, background: demo.running ? '#ef4444' : 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
          >
            {demo.running ? '⏹ TERMINATE DEMO' : '🎬 START SCADA DEMO'}
          </button>
        </div>

        {/* Debug diagnostics toggle */}
        <div style={{ borderTop: `1px solid ${overlayBorder}`, paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: overlayMuted }}>Debug Mode overlay:</span>
          <button onClick={() => setDebugMode(!debugMode)} style={{ padding: '3px 8px', fontSize: '8px', fontWeight: 700, background: debugMode ? '#0284c7' : 'transparent', color: debugMode ? '#fff' : overlayMuted, border: `1px solid ${debugMode ? '#0284c7' : overlayBorder}`, borderRadius: '4px', cursor: 'pointer' }}>
            {debugMode ? 'ACTIVE' : 'INACTIVE'}
          </button>
        </div>
      </div>

      {/* CLIENT DEMO NARRATION BANNER */}
      {demo.running && (
        <div style={{
          position: 'absolute', top: 54, left: '50%', transform: 'translateX(-50%)', zIndex: 15,
          fontFamily: "'JetBrains Mono', monospace", background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${overlayBorder}`, borderTop: '3px solid #f97316', borderRadius: '6px',
          padding: '10px 18px', width: '90%', maxWidth: 440, textAlign: 'center',
          backdropFilter: 'blur(10px)', animation: 'demoSlide 0.3s ease',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: '8px', color: '#f97316', letterSpacing: '1px', fontWeight: 700, marginBottom: '4px' }}>NIGHA AUTONOMOUS BLAST LIFECYCLE DEMO</div>
          <div style={{ fontSize: '10.5px', color: overlayText, lineHeight: 1.4, marginBottom: '8px', fontWeight: 600 }}>{demo.stepLabel}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            <button onClick={demo.paused ? resumeDemo : pauseDemo} style={{ padding: '3px 8px', fontSize: '9px', background: 'transparent', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '4px', cursor: 'pointer' }}>
              {demo.paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onClick={stopDemo} style={{ padding: '3px 8px', fontSize: '9px', background: 'transparent', color: overlayMuted, border: `1px solid ${overlayBorder}`, borderRadius: '4px', cursor: 'pointer' }}>
              ✕ Terminate
            </button>
          </div>
        </div>
      )}

      {/* COMPACT BOTTOM STATUS BAR — SCADA CONTROL PANEL */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 42, zIndex: 10,
          background: overlayBg, borderTop: `1px solid ${overlayBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
          fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'auto'
        }}
      >
        {/* Connection & Mode status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Connection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isMqttConnected ? '#10b981' : '#ef4444', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', color: overlayText, fontWeight: 700 }}>{isMqttConnected ? 'MQTT ONLINE' : 'MQTT OFFLINE'}</span>
          </div>

          <div style={{ width: 1, height: 16, background: overlayBorder }} />

          {/* Mode */}
          <span style={{ fontSize: '10px', fontWeight: 800, color: simulationMode ? '#EA580C' : '#10B981' }}>
            {simulationMode ? 'MANUAL SIM' : 'PROD MODE'}
          </span>
        </div>

        {/* Middle Indicators: Progress bars for Flow, Pressure, AI Prediction, Health */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'center', maxWidth: '65%' }}>
          
          {/* Chute Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: overlayMuted }}>STATUS:</span>
            <span style={{
              fontSize: '10px', fontWeight: 800,
              color: chuteStatus === 'Normal' ? '#10b981' : chuteStatus === 'Buildup' ? '#f59e0b' : chuteStatus === 'Blasting' ? '#3b82f6' : '#ef4444'
            }}>
              {chuteStatus.toUpperCase()}
            </span>
          </div>

          <div style={{ width: 1, height: 12, background: overlayBorder }} />

          {/* Flow Rate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '22%' }}>
            <span style={{ fontSize: '9px', color: overlayMuted }}>FLOW:</span>
            <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${flowPercentage}%`, height: '100%', background: flowPercentage > 50 ? '#10b981' : flowPercentage > 0 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9.5px', color: overlayText, fontWeight: 'bold' }}>{flowPercentage}%</span>
          </div>

          {/* Compressor Pressure */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '22%' }}>
            <span style={{ fontSize: '9px', color: overlayMuted }}>PRES:</span>
            <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${pressurePercentage}%`, height: '100%', background: pressure > 105 ? '#ef4444' : pressure > 80 ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9.5px', color: overlayText, fontWeight: 'bold' }}>{pressure.toFixed(0)} PSI</span>
          </div>

          {/* AI blockage probability */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '22%' }}>
            <span style={{ fontSize: '9px', color: overlayMuted }}>AI PRED:</span>
            <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${predictionPercentage}%`, height: '100%', background: predictionPercentage > 60 ? '#ef4444' : predictionPercentage > 30 ? '#f59e0b' : '#10b981', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9.5px', color: overlayText, fontWeight: 'bold' }}>{predictionPercentage}%</span>
          </div>

          {/* System Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '22%' }}>
            <span style={{ fontSize: '9px', color: overlayMuted }}>HEALTH:</span>
            <div style={{ flex: 1, height: 6, background: isDark ? '#334155' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${avgHealth}%`, height: '100%', background: avgHealth > 75 ? '#10b981' : avgHealth > 45 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9.5px', color: overlayText, fontWeight: 'bold' }}>{avgHealth}%</span>
          </div>
        </div>

        {/* Right Section: View Mode toggle dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '9px', color: overlayMuted }}>VIEW:</span>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            style={{
              padding: '2px 8px', fontSize: '9.5px', fontWeight: 700, fontFamily: 'inherit',
              background: btnBg, color: overlayText, border: `1px solid ${overlayBorder}`,
              borderRadius: '4px', cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="cutaway">Cutaway</option>
            <option value="operator">Operator (Solid)</option>
            <option value="transparent">Transparent</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      <style>{`@keyframes demoSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Camera hint */}
      <div style={{ position: 'absolute', bottom: 50, right: 14, zIndex: 10, fontSize: '9px', color: overlayMuted, fontFamily: "'Inter',sans-serif", letterSpacing: '0.3px' }}>
        Drag · Scroll · Right-drag
      </div>

      {/* ─── THREE.JS CANVAS ──────────────────────────────────────────────── */}
      {/* ─── THREE.JS CANVAS ──────────────────────────────────────────────── */}
      {isContextLost ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 15, 26, 0.94)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: 'var(--text-primary)',
          fontFamily: "'Inter', sans-serif",
          zIndex: 100,
          textAlign: 'center',
          gap: '16px',
        }}>
          <div style={{ fontSize: '48px', animation: 'pulseGlow 2s infinite' }}>🛰️</div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0', color: '#f43f5e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              3D Viewport Paused
            </h3>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
              WebGL context was repeatedly lost by your browser. This can happen if system memory is low, backgrounding, or the display driver reset.
            </p>
          </div>
          <button
            onClick={() => {
              contextLossCountRef.current = 0;
              setIsContextLost(false);
              setCanvasKey(k => k + 1);
            }}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #00d4ff 0%, #0284c7 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 212, 255, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            Reinitialize 3D Viewport
          </button>
        </div>
      ) : (
        <Canvas
          key={canvasKey}
          camera={{ position: [3.8, 2.2, 6.5], fov: 40 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: false,
          }}
          style={{ background: twinBg }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement;

            const handleContextLost = (e: Event) => {
              e.preventDefault();
              console.warn('WebGL context lost on ChuteDigitalTwin — waiting for browser recovery');

              const now = Date.now();
              const timeDiff = now - lastContextLossTimeRef.current;
              lastContextLossTimeRef.current = now;

              if (timeDiff < 5000) {
                contextLossCountRef.current += 1;
              } else {
                contextLossCountRef.current = 1;
              }

              if (contextLossCountRef.current > 3) {
                console.error('Too many consecutive WebGL context losses — pausing 3D Digital Twin');
                setIsContextLost(true);
              }
              // Do NOT remount here — wait for webglcontextrestored first.
              // If the browser cannot restore, the user can reinitialise manually.
            };

            const handleContextRestored = () => {
              console.info('WebGL context restored on ChuteDigitalTwin — forcing re-render');
              // Browser successfully restored the context; remount to re-initialise scene.
              setTimeout(() => {
                setCanvasKey(k => k + 1);
              }, 300);
            };

            canvas.addEventListener('webglcontextlost', handleContextLost, false);
            canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

            // Dispose GL resources when this Canvas is unmounted to free the WebGL context slot.
            return () => {
              canvas.removeEventListener('webglcontextlost', handleContextLost);
              canvas.removeEventListener('webglcontextrestored', handleContextRestored);
              gl.dispose();
            };
          }}
        >

          {/* Phase 6: Richer industrial lighting */}
          <ambientLight intensity={isDark ? 0.55 : 0.75} color={isDark ? '#c8d4e8' : '#ffffff'} />
          <directionalLight position={[8, 12, 6]}  intensity={isDark ? 1.6 : 1.4} color="#f0f4ff" castShadow />
          <directionalLight position={[-8, 6, -4]} intensity={0.4} color="#a0b8d0" />
          <directionalLight position={[0, -4, -6]} intensity={0.35} color="#3060a0" />
          <pointLight position={[0, 5, 0]}   intensity={0.7}  color="#d0deff" distance={14} />
          <pointLight position={[0, -3, 3]}  intensity={0.25} color="#405870" distance={8} />
          {/* Phase 6: soft fill light from front for industrial feel */}
          <pointLight position={[0, 2, 7]}   intensity={0.3}  color="#E8F0FF" distance={12} />
          <hemisphereLight args={['#b0c4de', '#3a3a2a', 0.4]} />

          <IndustrialGround viewMode={viewMode} isDark={isDark} />
          {viewMode !== 'maintenance' && viewMode !== 'operator' && <ScanningParticles isDark={isDark} />}

          {/* Phase 9: Camera manager with presets + focus target */}
          <CameraManager viewMode={viewMode} controlsRef={controlsRef} focusTarget={cameraFocus} cameraPreset={cameraPreset} />

          <group rotation={[0, (rotationX * Math.PI) / 180, 0]}>
            <WiringDiagram viewMode={viewMode} />

            {/* Air supply pipes */}
            <mesh position={[-1.2, 0, -0.4]} rotation={[0, 0, 0.12]}>
              <cylinderGeometry args={[0.03, 0.03, 4.0, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} wireframe={viewMode === 'maintenance'} />
            </mesh>
            <mesh position={[1.2, 0, -0.4]} rotation={[0, 0, -0.12]}>
              <cylinderGeometry args={[0.03, 0.03, 4.0, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} wireframe={viewMode === 'maintenance'} />
            </mesh>
            <mesh position={[0, -2.5, -0.4]} rotation={[0, 0, Math.PI/2]}>
              <cylinderGeometry args={[0.03, 0.03, 2.4, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} wireframe={viewMode === 'maintenance'} />
            </mesh>

            <group position={[0, 0.5, 0]}>
              {/* Chute structure (Phase 6 upgraded) with Z-aligned air blasters mounted perpendicular to slants */}
              <ChuteStructure
                status={chuteStatus}
                viewMode={viewMode}
                isDark={isDark}
                activePath={currentActivePath}
                activeBlasterNumber={activeBlasterNumber}
                blast={blast}
                blasters={blasters}
                solenoidSelection={solenoidSelection}
                handleSolenoidSelect={handleSolenoidSelect}
                debugMode={debugMode}
                getBlastLifecycle={getBlastLifecycle}
              />

              {/* Phase 8: Realistic material flow */}
              <RealisticMaterialFlow
                status={chuteStatus}
                devBlockages={devBlockages}
                activeBlasterNumber={activeBlasterNumber}
                activePath={currentActivePath}
                blastActive={blast.active}
                flowActive={flowActive}
                viewMode={viewMode}
              />

              {/* Phase 1: Invisible click plane for blockage placement */}
              <SlantClickPlane
                activePath={currentActivePath}
                enabled={devBlocking.pendingPlacement}
                onPlace={handleBlockagePlacement}
              />

              {/* Phase 1/3: Organic dev blockages */}
              {devBlockages.map(blk => (
                <OrganicBlockage
                  key={blk.id}
                  blockage={blk}
                  viewMode={viewMode}
                  isSelected={selectedBlockageId === blk.id}
                  onSelect={() => setSelectedBlockageId(sel => sel === blk.id ? null : blk.id)}
                />
              ))}

              {/* Legacy MQTT-driven blockages */}
              {(() => {
                const isZoneActive = (zoneIndex: number, path: 'LEFT_SLANT' | 'RIGHT_SLANT') =>
                  path === 'LEFT_SLANT' ? (zoneIndex === 0 || zoneIndex === 3) : (zoneIndex === 1 || zoneIndex === 2);
                return radars.map((r, i) => (
                  <BlockageMass key={i} zone={i} active={r.buildupDetected && isZoneActive(i, currentActivePath)} viewMode={viewMode} />
                ));
              })()}

              {/* Air blasters and blast animations are rendered dynamically inside ChuteStructure crossover groups */}

              {/* Phase 4: Blast radius preview for selected solenoid */}
              {solenoidSelection.blasterNumber !== null && solenoidSelection.solenoidPosition && !blast.active && (
                <BlastRadiusPreview
                  position={solenoidSelection.solenoidPosition}
                  radius={solenoidSelection.blastRadius}
                  impactPoint={solenoidSelection.impactPoint}
                />
              )}

              {/* Phase 7: Radar sensors */}
              <RadarSensor position={[-1.75, 1.4, 0.4]} explodedPosition={[-2.4, 1.8, 0.9]} target={[-0.6, 0.9, 0]} mountPoint={[-1.65, 1.4, 0.1]} zone={1} distance={radars[0]?.distance ?? 3.5} detecting={radars[0]?.buildupDetected ?? false} viewMode={viewMode} isDark={isDark} isActivePath={currentActivePath === 'RIGHT_SLANT'} />
              <RadarSensor position={[1.75, 1.4, 0.4]}  explodedPosition={[2.4, 1.8, 0.9]}  target={[0.6, 0.9, 0]}   mountPoint={[1.65, 1.4, 0.1]}  zone={2} distance={radars[1]?.distance ?? 3.5} detecting={radars[1]?.buildupDetected ?? false} viewMode={viewMode} isDark={isDark} isActivePath={currentActivePath === 'LEFT_SLANT'} />
              <RadarSensor position={[-1.65, -0.6, 0.4]} explodedPosition={[-2.3, -1.0, 0.9]} target={[-1.2, -1.6, 0]} mountPoint={[-1.41, -0.6, 0.1]} zone={3} distance={radars[2]?.distance ?? 3.5} detecting={radars[2]?.buildupDetected ?? false} viewMode={viewMode} isDark={isDark} isActivePath={currentActivePath === 'LEFT_SLANT'} />
              <RadarSensor position={[1.65, -0.6, 0.4]}  explodedPosition={[2.3, -1.0, 0.9]}  target={[1.2, -1.6, 0]}   mountPoint={[1.41, -0.6, 0.1]}  zone={4} distance={radars[3]?.distance ?? 3.5} detecting={radars[3]?.buildupDetected ?? false} viewMode={viewMode} isDark={isDark} isActivePath={currentActivePath === 'RIGHT_SLANT'} />

              {/* Active Path Indicator */}
              {viewMode !== 'maintenance' && (
                <ActivePathIndicator
                  activePath={currentActivePath}
                  blockagePosition={blockagePosition}
                  blockageDistance={blockageDistance}
                  nearestSolenoidGroup={nearestSolenoidGroup}
                  status={chuteStatus}
                  simulationMode={simulationMode}
                  isDark={isDark}
                />
              )}
            </group>

            <CompressorUnit pressure={pressure} motorTemp={motorTemp} viewMode={viewMode} isDark={isDark} />
            <NighaHub isOnline={hubOnline} viewMode={viewMode} isDark={isDark} />
            <EnvSensors temperature={liveTemperature} humidity={liveHumidity} viewMode={viewMode} isDark={isDark} />
          </group>

          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.08}
            minDistance={4}
            maxDistance={16}
            maxPolarAngle={Math.PI * 0.78}
          />
        </Canvas>
      )}
    </div>
  );
};
