/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive 3D Hardware Scene for Al-Mamo Hardware Store
 * Built with Three.js (r160+ PBR rendering, procedural metallic tools, and mouse parallax).
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeHardwareSceneProps {
  interactive?: boolean;
  lightingMood?: 'luxury' | 'gold' | 'titanium';
  theme?: 'light' | 'dark';
  speed?: number;
  className?: string;
}

export const ThreeHardwareScene: React.FC<ThreeHardwareSceneProps> = ({
  interactive = true,
  lightingMood = 'luxury',
  theme = 'dark',
  speed = 1.0,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Pointer position normalized [-1, 1]
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Detect software WebGL as mandated by Three.js skill
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const isDaylight = theme === 'light';
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.fog = isDaylight
      ? new THREE.FogExp2(0xf8fafc, 0.015)
      : new THREE.FogExp2(0x060911, 0.045);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 13);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDaylight ? 1.45 : 1.25;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    let contextLost = false;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
    };
    const handleContextRestored = () => {
      contextLost = false;
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // 4. Lighting Rig (Daylight Studio vs Night Luxury)
    const ambientLight = new THREE.AmbientLight(
      isDaylight ? 0xffffff : 0x0a1120,
      isDaylight ? 1.9 : 1.2
    );
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      isDaylight ? 0xfffbeb : 0x38bdf8,
      isDaylight ? 0xe2e8f0 : 0x0f172a,
      isDaylight ? 1.35 : 0.85
    );
    scene.add(hemiLight);

    // Golden Key Light
    const keyLight = new THREE.DirectionalLight(
      isDaylight ? 0xfbbf24 : 0xf59e0b,
      isDaylight ? 3.1 : 2.8
    );
    keyLight.position.set(7, 8, 9);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0004;
    }
    scene.add(keyLight);

    // Cool Rim Light
    const rimLight = new THREE.DirectionalLight(
      isDaylight ? 0x0284c7 : 0x06b6d4,
      isDaylight ? 1.6 : 2.0
    );
    rimLight.position.set(-8, -5, -6);
    scene.add(rimLight);

    // Top Specular Accent Light
    const topLight = new THREE.PointLight(0xfffbeb, isDaylight ? 2.6 : 2.2, 25);
    topLight.position.set(0, 7, 5);
    scene.add(topLight);

    // 5. Procedural PBR Metallic Materials
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.98,
      roughness: 0.12,
      envMapIntensity: 1.5,
    });

    const brushedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 2.0,
    });

    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.28,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.25,
    });

    const glowingCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.2,
    });

    // 6. Procedural 3D Hardware Items
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // --- Helper: Professional Combination Wrench ---
    const createWrench = (): THREE.Group => {
      const g = new THREE.Group();
      // Handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.8, 0.16), chromeMat);
      handle.castShadow = !isSoftwareGl;
      g.add(handle);

      // Gold engraved inlay
      const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.18), brushedGoldMat);
      g.add(inlay);

      // Open Jaw Head
      const jawOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.2, 24), chromeMat);
      jawOuter.position.y = 2.0;
      jawOuter.rotation.z = Math.PI / 8;
      jawOuter.castShadow = !isSoftwareGl;
      g.add(jawOuter);

      // Box Ring Head (12-point)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.14, 16, 24), chromeMat);
      ring.position.y = -2.0;
      ring.castShadow = !isSoftwareGl;
      g.add(ring);

      return g;
    };

    // --- Helper: Ergonomic Screwdriver ---
    const createScrewdriver = (): THREE.Group => {
      const g = new THREE.Group();
      // Fluted Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 2.4, 16), darkTitaniumMat);
      handle.position.y = -1.1;
      handle.castShadow = !isSoftwareGl;
      g.add(handle);

      // Gold Bolster Ring
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20), brushedGoldMat);
      collar.position.y = 0.2;
      g.add(collar);

      // Chrome Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 20), chromeMat);
      shaft.position.y = 1.7;
      shaft.castShadow = !isSoftwareGl;
      g.add(shaft);

      // Phillips Tip
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 8), brassMat);
      tip.position.y = 3.25;
      g.add(tip);

      return g;
    };

    // --- Helper: Hex Bolt ---
    const createHexBolt = (): THREE.Group => {
      const g = new THREE.Group();
      // Hex head
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.32, 6), chromeMat);
      head.castShadow = !isSoftwareGl;
      g.add(head);

      // Gold Washer
      const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 24), brushedGoldMat);
      washer.position.y = -0.18;
      g.add(washer);

      // Threaded Body
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.6, 24), chromeMat);
      shank.position.y = -1.0;
      g.add(shank);

      return g;
    };

    // --- Helper: Hex Nut ---
    const createHexNut = (): THREE.Group => {
      const g = new THREE.Group();
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 6), brushedGoldMat);
      nut.castShadow = !isSoftwareGl;
      g.add(nut);

      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 16), darkTitaniumMat);
      g.add(hole);

      return g;
    };

    // --- Helper: Precision Spur Gear ---
    const createGear = (radius = 1.2, teethCount = 12): THREE.Group => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.22, 32), brushedGoldMat);
      body.castShadow = !isSoftwareGl;
      g.add(body);

      // Teeth
      for (let i = 0; i < teethCount; i++) {
        const angle = (i / teethCount) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.38), brushedGoldMat);
        tooth.position.set(Math.cos(angle) * (radius + 0.12), 0, Math.sin(angle) * (radius + 0.12));
        tooth.rotation.y = -angle;
        g.add(tooth);
      }

      // Center Bore
      const center = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 24), darkTitaniumMat);
      g.add(center);

      // Cutout rings
      for (let j = 0; j < 4; j++) {
        const wAngle = (j / 4) * Math.PI * 2 + Math.PI / 8;
        const cutout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 16), darkTitaniumMat);
        cutout.position.set(Math.cos(wAngle) * (radius * 0.6), 0, Math.sin(wAngle) * (radius * 0.6));
        g.add(cutout);
      }

      return g;
    };

    // --- Helper: Central Hardware Store 3D Emblem ---
    const createMasterEmblem = (): THREE.Group => {
      const g = new THREE.Group();

      // Outer Hexagonal Crest Frame
      const outerHex = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.28, 6), brushedGoldMat);
      outerHex.rotation.x = Math.PI / 2;
      outerHex.castShadow = !isSoftwareGl;
      g.add(outerHex);

      // Inner Titanium Bezel
      const innerBezel = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.32, 6), darkTitaniumMat);
      innerBezel.rotation.x = Math.PI / 2;
      g.add(innerBezel);

      // Architectural Storefront Gabled Roof (Triangle Apex)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.95, 4), brushedGoldMat);
      roof.position.set(0, 1.25, 0.2);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = !isSoftwareGl;
      g.add(roof);

      // Central Rotating Precision Gear
      const centerGear = createGear(0.75, 10);
      centerGear.rotation.x = Math.PI / 2;
      centerGear.position.z = 0.1;
      g.add(centerGear);

      // Glowing Center Core
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), glowingCoreMat);
      core.position.z = 0.25;
      g.add(core);

      return g;
    };

    // 7. Assemble the 3D Hardware Objects in World Space
    // Master Emblem in Center-Back
    const emblem = createMasterEmblem();
    emblem.position.set(0, 0.4, -1.0);
    rootGroup.add(emblem);

    // Left Flank Wrench
    const wrench1 = createWrench();
    wrench1.position.set(-4.6, 1.8, 1.5);
    wrench1.rotation.set(0.4, 0.6, -0.5);
    wrench1.scale.set(0.9, 0.9, 0.9);
    rootGroup.add(wrench1);

    // Right Flank Screwdriver
    const screwdriver1 = createScrewdriver();
    screwdriver1.position.set(4.8, -1.2, 1.2);
    screwdriver1.rotation.set(-0.6, -0.4, 0.8);
    screwdriver1.scale.set(0.95, 0.95, 0.95);
    rootGroup.add(screwdriver1);

    // Top-Right Gear
    const gear1 = createGear(1.3, 14);
    gear1.position.set(4.5, 2.8, -0.5);
    gear1.rotation.set(1.1, 0.3, 0);
    rootGroup.add(gear1);

    // Bottom-Left Small Gear
    const gear2 = createGear(0.9, 10);
    gear2.position.set(-4.2, -2.6, 0.5);
    gear2.rotation.set(0.8, -0.4, 0.5);
    rootGroup.add(gear2);

    // Floating Hex Bolts & Nuts
    const bolt1 = createHexBolt();
    bolt1.position.set(-2.8, -2.2, 2.0);
    bolt1.rotation.set(1.2, 0.5, -0.8);
    bolt1.scale.set(0.85, 0.85, 0.85);
    rootGroup.add(bolt1);

    const bolt2 = createHexBolt();
    bolt2.position.set(3.2, 3.2, 0.8);
    bolt2.rotation.set(-0.8, 0.6, 1.0);
    bolt2.scale.set(0.75, 0.75, 0.75);
    rootGroup.add(bolt2);

    const nut1 = createHexNut();
    nut1.position.set(-3.5, 3.0, 1.2);
    nut1.rotation.set(0.9, 1.1, 0);
    nut1.scale.set(0.9, 0.9, 0.9);
    rootGroup.add(nut1);

    const nut2 = createHexNut();
    nut2.position.set(2.8, -2.8, 2.2);
    nut2.rotation.set(-1.0, 0.8, -0.5);
    nut2.scale.set(0.8, 0.8, 0.8);
    rootGroup.add(nut2);

    // 8. Floating Ambient Golden Dust Particles
    const particleCount = isSoftwareGl ? 35 : 80;
    const particleGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const particleMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, particleCount);
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const particleData: Array<{ x: number; y: number; z: number; speed: number; rotSpeed: number }> = [];

    for (let i = 0; i < particleCount; i++) {
      const p = {
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 12,
        z: (Math.random() - 0.5) * 10,
        speed: 0.2 + Math.random() * 0.4,
        rotSpeed: 0.5 + Math.random(),
      };
      particleData.push(p);
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.4 + Math.random() * 0.9);
      dummy.updateMatrix();
      particleMesh.setMatrixAt(i, dummy.matrix);
    }
    particleMesh.instanceMatrix.needsUpdate = true;
    rootGroup.add(particleMesh);

    // 9. Mouse and Pointer tracking with smooth damping
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

      mouseRef.current.targetX = Math.max(-1, Math.min(1, x));
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y));
    };

    if (interactive) {
      window.addEventListener('mousemove', handlePointerMove, { passive: true });
      window.addEventListener('touchmove', handlePointerMove, { passive: true });
    }

    // 10. Resize Observer
    const handleResize = () => {
      if (!container || !renderer) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // 11. Animation Loop with high-precision timestamp & visibility pause
    let isContainerVisible = true;
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              isContainerVisible = entries[0]?.isIntersecting ?? true;
            },
            { threshold: 0.05 }
          )
        : null;
    observer?.observe(container);

    let lastTime = performance.now();
    let totalElapsed = 0;

    // Initial render so reduced-motion or first paint is immediate
    renderer.render(scene, camera);

    const animate = (currentTime: number) => {
      if (prefersReducedMotion) return;
      if (contextLost || document.hidden || !isContainerVisible) {
        lastTime = currentTime;
        animFrameIdRef.current = requestAnimationFrame(animate);
        return;
      }
      const deltaMs = Math.min(currentTime - lastTime, 100);
      lastTime = currentTime;
      const delta = deltaMs / 1000;
      totalElapsed += delta * speed;
      const elapsed = totalElapsed;

      // Smooth pointer damping
      mouseRef.current.x = THREE.MathUtils.damp(mouseRef.current.x, mouseRef.current.targetX, 4.0, delta);
      mouseRef.current.y = THREE.MathUtils.damp(mouseRef.current.y, mouseRef.current.targetY, 4.0, delta);

      // Camera parallax tilt based on mouse position
      camera.position.x = mouseRef.current.x * 1.5;
      camera.position.y = mouseRef.current.y * 1.0;
      camera.lookAt(0, 0, 0);

      // Slow majestic levitation and gyro rotations
      const t = elapsed * 0.8;

      // Master Emblem subtle breathing
      emblem.rotation.z = Math.sin(t * 0.4) * 0.05;
      emblem.rotation.y = Math.sin(t * 0.6) * 0.12;
      emblem.position.y = 0.4 + Math.sin(t * 1.2) * 0.15;

      // Tools levitation and rotation
      wrench1.rotation.x += delta * 0.4;
      wrench1.rotation.y += delta * 0.5;
      wrench1.position.y = 1.8 + Math.sin(t * 1.4 + 1) * 0.25;

      screwdriver1.rotation.x += delta * 0.35;
      screwdriver1.rotation.z += delta * 0.45;
      screwdriver1.position.y = -1.2 + Math.cos(t * 1.3 + 2) * 0.22;

      gear1.rotation.y += delta * 0.6;
      gear1.position.y = 2.8 + Math.sin(t * 1.1 + 3) * 0.18;

      gear2.rotation.y -= delta * 0.8;
      gear2.position.y = -2.6 + Math.cos(t * 1.5 + 4) * 0.2;

      bolt1.rotation.x += delta * 0.7;
      bolt1.rotation.y += delta * 0.6;
      bolt1.position.y = -2.2 + Math.sin(t * 1.6 + 5) * 0.22;

      bolt2.rotation.x -= delta * 0.5;
      bolt2.rotation.z += delta * 0.7;
      bolt2.position.y = 3.2 + Math.cos(t * 1.4 + 2) * 0.25;

      nut1.rotation.y += delta * 0.9;
      nut1.rotation.z += delta * 0.5;
      nut1.position.y = 3.0 + Math.sin(t * 1.8 + 1) * 0.18;

      nut2.rotation.x += delta * 0.8;
      nut2.rotation.y -= delta * 0.6;
      nut2.position.y = -2.8 + Math.cos(t * 1.7 + 3) * 0.22;

      // Ambient particle motion
      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i];
        p.y += Math.sin(elapsed * p.speed + i) * 0.005;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.x += delta * p.rotSpeed * 0.2;
        dummy.rotation.y += delta * p.rotSpeed * 0.3;
        dummy.updateMatrix();
        particleMesh.setMatrixAt(i, dummy.matrix);
      }
      particleMesh.instanceMatrix.needsUpdate = true;

      // Dynamic light animation (gleam sweeping across scene)
      topLight.position.x = Math.sin(t * 0.8) * 4.0;
      topLight.position.y = 6.0 + Math.cos(t * 0.6) * 2.0;

      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    // 12. Cleanup
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      observer?.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handlePointerMove);
        window.removeEventListener('touchmove', handlePointerMove);
      }

      // Dispose geometries & materials
      rootGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });

      chromeMat.dispose();
      brushedGoldMat.dispose();
      darkTitaniumMat.dispose();
      brassMat.dispose();
      glowingCoreMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();

      renderer.dispose();
    };
  }, [interactive, speed, theme, lightingMood]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
};
