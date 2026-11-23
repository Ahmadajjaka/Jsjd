export type AppThemeMode = 'light' | 'dark';

export interface TiltAngles {
  rx: number;
  ry: number;
}

export const WELCOME_PRIMARY_PHRASE = 'مرحبا بك في متجر خردوات المامو';

/**
 * Resolves the initial Day/Night theme cleanly, defaulting to Day ('light')
 * when no preference is stored unless the user explicitly chooses Dark.
 */
export function resolveInitialTheme(
  savedTheme: string | null | undefined,
  prefersDark = false
): AppThemeMode {
  if (savedTheme === 'dark') return 'dark';
  if (savedTheme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

/**
 * Computes bounded 3D perspective tilt angles from normalized pointer offsets [-0.5, 0.5].
 */
export function clampWelcomeTilt(
  normalizedX: number,
  normalizedY: number,
  maxDeg = 7
): TiltAngles {
  if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
    return { rx: 0, ry: 0 };
  }
  const safeMax = Math.max(0, Math.min(20, maxDeg));
  const clampedX = Math.max(-0.5, Math.min(0.5, normalizedX));
  const clampedY = Math.max(-0.5, Math.min(0.5, normalizedY));

  const rx = Number((-clampedY * safeMax * 2).toFixed(2));
  const ry = Number((clampedX * safeMax * 2).toFixed(2));
  return {
    rx: rx === 0 ? 0 : rx,
    ry: ry === 0 ? 0 : ry,
  };
}

/**
 * Builds the 3D welcome headline ensuring it always includes the exact greeting
 * "مرحبا بك في متجر خردوات المامو" (or adapts cleanly if custom store name matches).
 */
export function formatWelcome3DTitle(storeName?: string): string {
  const clean = (storeName || '').trim();
  if (!clean || clean === 'خردوات المامو' || clean === 'متجر خردوات المامو') {
    return WELCOME_PRIMARY_PHRASE;
  }
  return `مرحبا بك في ${clean}`;
}

export interface TimeTravelCameraState {
  progress: number;
  cameraZ: number;
  fov: number;
  rollRad: number;
  tunnelOpacity: number;
  emblemScale: number;
  titleOpacity: number;
  phase: 'zooming' | 'arrived';
}

/**
 * Computes deterministic, slow-motion time-travel dolly-zoom camera & emblem states
 * for normalized timeline progress [0, 1] (~5.8s intro onto "متجر خردوات المامو").
 */
export function computeTimeTravelCameraState(rawProgress: number): TimeTravelCameraState {
  const p = Number.isFinite(rawProgress) ? Math.max(0, Math.min(1, rawProgress)) : 0;

  // Ultra-smooth slow-in, buttery decelerating arrival (quartic/quintic ease-out blend)
  const slowEaseOut = 1 - Math.pow(1 - p, 3.2);
  const gentleDrift = p * 0.12 + slowEaseOut * 0.88;

  // Camera travels forward along Z through temporal rings from 30 -> 7.6
  const cameraZ = Number((30 - gentleDrift * 22.4).toFixed(3));
  // Subtle optical dolly-zoom FOV tightening from wide warp 64 deg -> hero framing 41 deg
  const fov = Number((64 - slowEaseOut * 23).toFixed(2));
  // Gentle temporal spiral roll settling cleanly to level horizon (0 rad)
  const rollRad = Number(((1 - slowEaseOut) * 0.22).toFixed(4));

  const tunnelOpacity = p < 0.85 ? 1 : Number(Math.max(0.25, 1 - (p - 0.85) / 0.15 * 0.75).toFixed(3));
  const emblemScale = Number((0.45 + slowEaseOut * 0.55).toFixed(3));
  const titleOpacity = p < 0.22 ? 0 : Number(Math.min(1, (p - 0.22) / 0.45).toFixed(3));

  return {
    progress: p,
    cameraZ,
    fov,
    rollRad,
    tunnelOpacity,
    emblemScale,
    titleOpacity,
    phase: p >= 0.98 ? 'arrived' : 'zooming',
  };
}

/**
 * Determines whether the 3D time-travel intro should launch automatically on entry.
 * Honors ?autostart=1 (mandatory fast-skip flag) and prefers-reduced-motion.
 */
export function shouldShowTimeTravelIntro(search: string = '', prefersReducedMotion = false): boolean {
  if (prefersReducedMotion) return false;
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    if (params.get('autostart') === '1') return false;
  } catch {
    // ignore malformed search string
  }
  return true;
}

