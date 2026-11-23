import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampWelcomeTilt,
  computeTimeTravelCameraState,
  formatWelcome3DTitle,
  resolveInitialTheme,
  shouldShowTimeTravelIntro,
  WELCOME_PRIMARY_PHRASE,
} from './welcome3d';

test('resolveInitialTheme honors explicit saved preference and falls back cleanly', () => {
  assert.equal(resolveInitialTheme('light', true), 'light');
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme('unexpected', false), 'light');
});

test('clampWelcomeTilt bounds pointer offsets into smooth 3D rotation angles', () => {
  assert.deepEqual(clampWelcomeTilt(0, 0, 7), { rx: 0, ry: 0 });
  assert.deepEqual(clampWelcomeTilt(0.5, -0.5, 7), { rx: 7, ry: 7 });
  assert.deepEqual(clampWelcomeTilt(-0.5, 0.5, 7), { rx: -7, ry: -7 });
  assert.deepEqual(clampWelcomeTilt(5, -5, 6), { rx: 6, ry: -6 * -1 });
  assert.deepEqual(clampWelcomeTilt(Number.NaN, 0.2, 6), { rx: 0, ry: 0 });
});

test('formatWelcome3DTitle returns the 3D Arabic store welcome phrase', () => {
  assert.equal(formatWelcome3DTitle(), WELCOME_PRIMARY_PHRASE);
  assert.equal(formatWelcome3DTitle('متجر خردوات المامو'), 'مرحبا بك في متجر خردوات المامو');
  assert.equal(formatWelcome3DTitle('خردوات المامو'), 'مرحبا بك في متجر خردوات المامو');
  assert.equal(formatWelcome3DTitle('متجر المامو للمعدات'), 'مرحبا بك في متجر المامو للمعدات');
});

test('computeTimeTravelCameraState performs smooth slow zoom forward onto emblem', () => {
  const start = computeTimeTravelCameraState(0);
  const mid = computeTimeTravelCameraState(0.5);
  const end = computeTimeTravelCameraState(1);

  assert.equal(start.phase, 'zooming');
  assert.equal(start.cameraZ, 30);
  assert.equal(start.fov, 64);
  assert.ok(mid.cameraZ < start.cameraZ && mid.cameraZ > end.cameraZ);
  assert.ok(mid.fov < start.fov && mid.fov > end.fov);
  assert.equal(end.phase, 'arrived');
  assert.equal(end.rollRad, 0);
  assert.equal(end.titleOpacity, 1);
  assert.equal(end.emblemScale, 1);
});

test('shouldShowTimeTravelIntro respects ?autostart=1 and reduced-motion preference', () => {
  assert.equal(shouldShowTimeTravelIntro('', false), true);
  assert.equal(shouldShowTimeTravelIntro('?autostart=1', false), false);
  assert.equal(shouldShowTimeTravelIntro('?tab=sales&autostart=1', false), false);
  assert.equal(shouldShowTimeTravelIntro('', true), false);
});
