import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface CinematicSplashScreenProps {
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
  managerName?: string;
  autoPlay?: boolean;
}

/**
 * Procedurally generates high-end 3D hardware items (Wrench, Screwdriver, Hex Bolts, Nuts, Gears, Screws)
 * and animates a 6-second cinematic intro sequence for "متجر خردوات المامو - بإدارة أحمد نوار المامو".
 */
export const CinematicSplashScreen: React.FC<CinematicSplashScreenProps> = ({
  isOpen,
  onClose,
  brandName = 'متجر خردوات المامو',
  managerName = 'بإدارة أحمد نوار المامو',
  autoPlay = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Animation timeline reference (in seconds)
  const timelineRef = useRef({
    startTime: 0,
    elapsed: 0,
    duration: 6.0,
    isPlaying: autoPlay,
    lastTime: performance.now(),
  });

  // Sound triggers state tracking to avoid multi-triggering
  const soundPlayedRef = useRef({
    introSub: false,
    assembleWhoosh: false,
    lockClank: false,
    goldenGleam: false,
  });

  // -------------------------------------------------------------
  // Web Audio Cinematic SFX Engine (100% self-contained synthesized)
  // -------------------------------------------------------------
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const playCinematicSound = useCallback(
    (type: 'sub_bass' | 'metallic_whoosh' | 'lock_clank' | 'golden_gleam') => {
      if (isMuted) return;
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'sub_bass') {
        // Deep cinematic sub rumble
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(65, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 1.8);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2.6);
      } else if (type === 'metallic_whoosh') {
        // Fast dynamic Doppler whoosh
        const bufferSize = ctx.sampleRate * 1.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(1600, now + 0.6);
        filter.frequency.exponentialRampToValueAtTime(300, now + 1.2);
        filter.Q.setValueAtTime(4.0, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        noise.start(now);
        noise.stop(now + 1.25);
      } else if (type === 'lock_clank') {
        // Precise metallic mechanical snap
        [420, 880, 1760].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.4);

          gain.gain.setValueAtTime(0.3 / (idx + 1), now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.5);
        });
      } else if (type === 'golden_gleam') {
        // Shimmering harmonic crystal chime
        [1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.05 + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + 1.8);
        });
      }
    },
    [isMuted, initAudio]
  );

  // -------------------------------------------------------------
  // Three.js Scene Setup & Hardware Generation
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a0f);
    scene.fog = new THREE.FogExp2(0x070a0f, 0.038);

    // Camera setup for 16:9 cinematic framing
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 16);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleResize = () => {
      if (!canvas) return;
      const width = canvas.parentElement?.clientWidth || 1280;
      const height = Math.round(width * (9 / 16));
      renderer.setSize(width, height, false);
      camera.aspect = 16 / 9;
      camera.updateProjectionMatrix();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // -----------------------------------------------------------
    // Lighting Rig (Key, Fill, Rim, Ambient, Specular Spotlight)
    // -----------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.2);
    scene.add(ambientLight);

    // Golden Key Light
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 3.2);
    keyLight.position.set(8, 12, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    // Cool Metallic Silver Rim Light
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 2.5);
    rimLight.position.set(-10, -6, -8);
    scene.add(rimLight);

    // Gold Specular Sweep Spotlight
    const sweepSpotLight = new THREE.SpotLight(0xfde047, 0, 30, Math.PI / 6, 0.4, 1.5);
    sweepSpotLight.position.set(-12, 4, 12);
    scene.add(sweepSpotLight);

    // Background Studio Shadow Catcher Ground
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05080e,
      roughness: 0.45,
      metalness: 0.65,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -6.5, 0);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // -----------------------------------------------------------
    // Procedural Materials
    // -----------------------------------------------------------
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.96,
      roughness: 0.12,
    });

    const brushedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.88,
      roughness: 0.22,
    });

    const darkTitaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.35,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.28,
    });

    // -----------------------------------------------------------
    // Procedural Hardware 3D Models
    // -----------------------------------------------------------

    // 1. Professional Combination Wrench
    const createWrench = (): THREE.Group => {
      const group = new THREE.Group();

      // Handle shaft
      const handleGeo = new THREE.BoxGeometry(0.35, 4.2, 0.16);
      const handleMesh = new THREE.Mesh(handleGeo, chromeMat);
      handleMesh.castShadow = true;
      group.add(handleMesh);

      // Inset grip groove with gold trim
      const grooveGeo = new THREE.BoxGeometry(0.18, 3.2, 0.18);
      const grooveMesh = new THREE.Mesh(grooveGeo, brushedGoldMat);
      grooveMesh.castShadow = true;
      group.add(grooveMesh);

      // Open-End Head (U-jaw)
      const openHeadOuter = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 24);
      const openHeadMesh = new THREE.Mesh(openHeadOuter, chromeMat);
      openHeadMesh.position.y = 2.2;
      openHeadMesh.rotation.z = Math.PI / 12;
      group.add(openHeadMesh);

      // Closed Ring End (12-point box)
      const ringOuter = new THREE.TorusGeometry(0.48, 0.15, 16, 24);
      const ringMesh = new THREE.Mesh(ringOuter, chromeMat);
      ringMesh.position.y = -2.2;
      group.add(ringMesh);

      return group;
    };

    // 2. Heavy-Duty Screwdriver
    const createScrewdriver = (): THREE.Group => {
      const group = new THREE.Group();

      // Handle (fluted ergonomic)
      const handleCore = new THREE.CylinderGeometry(0.38, 0.44, 2.8, 16);
      const handleMesh = new THREE.Mesh(handleCore, darkTitaniumMat);
      handleMesh.position.y = -1.2;
      group.add(handleMesh);

      // Gold collar / bolster ring
      const collarGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20);
      const collarMesh = new THREE.Mesh(collarGeo, brushedGoldMat);
      collarMesh.position.y = 0.25;
      group.add(collarMesh);

      // Hardened Chrome Steel Shaft
      const shaftGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 20);
      const shaftMesh = new THREE.Mesh(shaftGeo, chromeMat);
      shaftMesh.position.y = 1.95;
      shaftMesh.castShadow = true;
      group.add(shaftMesh);

      // Phillips Cross Tip
      const tipGeo = new THREE.ConeGeometry(0.13, 0.4, 8);
      const tipMesh = new THREE.Mesh(tipGeo, brassMat);
      tipMesh.position.y = 3.65;
      group.add(tipMesh);

      return group;
    };

    // 3. Precision Hex Bolt
    const createHexBolt = (): THREE.Group => {
      const group = new THREE.Group();

      // 6-sided head
      const headGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 6);
      const headMesh = new THREE.Mesh(headGeo, chromeMat);
      headMesh.castShadow = true;
      group.add(headMesh);

      // Flange washer ring
      const washerGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.08, 24);
      const washerMesh = new THREE.Mesh(washerGeo, brushedGoldMat);
      washerMesh.position.y = -0.2;
      group.add(washerMesh);

      // Threaded Cylinder
      const shankGeo = new THREE.CylinderGeometry(0.26, 0.26, 1.8, 24);
      const shankMesh = new THREE.Mesh(shankGeo, chromeMat);
      shankMesh.position.y = -1.1;
      group.add(shankMesh);

      return group;
    };

    // 4. Hex Nut
    const createHexNut = (): THREE.Group => {
      const group = new THREE.Group();
      const nutOuter = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 6);
      const nutMesh = new THREE.Mesh(nutOuter, brushedGoldMat);
      nutMesh.castShadow = true;
      group.add(nutMesh);

      const innerHole = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 16);
      const innerMesh = new THREE.Mesh(innerHole, darkTitaniumMat);
      group.add(innerMesh);

      return group;
    };

    // 5. Precision Spur Gear
    const createGear = (): THREE.Group => {
      const group = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.22, 32);
      const bodyMesh = new THREE.Mesh(bodyGeo, brushedGoldMat);
      bodyMesh.castShadow = true;
      group.add(bodyMesh);

      // Outer teeth (14 teeth)
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.45), brushedGoldMat);
        tooth.position.set(Math.cos(angle) * 1.7, 0, Math.sin(angle) * 1.7);
        tooth.rotation.y = -angle;
        group.add(tooth);
      }

      // Center Bore
      const centerHole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 24), darkTitaniumMat);
      group.add(centerHole);

      // 4 Weight Reduction Windows
      for (let j = 0; j < 4; j++) {
        const wAngle = (j / 4) * Math.PI * 2 + Math.PI / 8;
        const win = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.26, 16), darkTitaniumMat);
        win.position.set(Math.cos(wAngle) * 1.0, 0, Math.sin(wAngle) * 1.0);
        group.add(win);
      }

      return group;
    };

    // 6. Central Hardware Store Master Emblem (Assembles at 1.5s–3.0s)
    const emblemGroup = new THREE.Group();
    emblemGroup.position.set(0, 0.8, 0);

    // Outer Hexagonal Frame
    const hexFrame = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 6), brushedGoldMat);
    hexFrame.rotation.x = Math.PI / 2;
    emblemGroup.add(hexFrame);

    // Inner Chrome Bezel
    const innerBezel = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.35, 6), darkTitaniumMat);
    innerBezel.rotation.x = Math.PI / 2;
    emblemGroup.add(innerBezel);

    // Storefront Gabled Apex (Architectural hardware roof)
    const roofGeo = new THREE.ConeGeometry(1.8, 1.1, 4);
    const roofMesh = new THREE.Mesh(roofGeo, brushedGoldMat);
    roofMesh.position.set(0, 1.45, 0.25);
    roofMesh.rotation.y = Math.PI / 4;
    emblemGroup.add(roofMesh);

    // Central interlocking gear
    const masterGear = createGear();
    masterGear.scale.set(0.65, 0.65, 0.65);
    masterGear.rotation.x = Math.PI / 2;
    masterGear.position.z = 0.2;
    emblemGroup.add(masterGear);

    // Crossed Emblem Tools (Wrench + Screwdriver)
    const emblemWrench = createWrench();
    emblemWrench.scale.set(0.55, 0.55, 0.55);
    emblemWrench.rotation.z = Math.PI / 4;
    emblemWrench.position.z = 0.35;
    emblemGroup.add(emblemWrench);

    const emblemDriver = createScrewdriver();
    emblemDriver.scale.set(0.48, 0.48, 0.48);
    emblemDriver.rotation.z = -Math.PI / 4;
    emblemDriver.position.z = 0.38;
    emblemGroup.add(emblemDriver);

    scene.add(emblemGroup);
    emblemGroup.scale.set(0.001, 0.001, 0.001); // invisible at start, scales in at assembly

    // -----------------------------------------------------------
    // Floating Hardware Items (0s - 1.5s Emergence)
    // -----------------------------------------------------------
    interface FloatingItem {
      group: THREE.Group;
      startPos: THREE.Vector3;
      floatPos: THREE.Vector3;
      targetPos: THREE.Vector3;
      rotationSpeed: THREE.Vector3;
    }

    const floatingItems: FloatingItem[] = [
      {
        group: createWrench(),
        startPos: new THREE.Vector3(-9, 4, -4),
        floatPos: new THREE.Vector3(-4.5, 2.0, 1.5),
        targetPos: new THREE.Vector3(-0.4, 0.8, 0.3),
        rotationSpeed: new THREE.Vector3(0.015, 0.02, 0.01),
      },
      {
        group: createScrewdriver(),
        startPos: new THREE.Vector3(9, -3, -5),
        floatPos: new THREE.Vector3(4.2, -1.8, 1.8),
        targetPos: new THREE.Vector3(0.4, 0.8, 0.3),
        rotationSpeed: new THREE.Vector3(-0.02, 0.012, 0.018),
      },
      {
        group: createHexBolt(),
        startPos: new THREE.Vector3(-7, -4, -3),
        floatPos: new THREE.Vector3(-3.2, -2.2, 2.5),
        targetPos: new THREE.Vector3(-1.2, 0.8, 0.1),
        rotationSpeed: new THREE.Vector3(0.03, 0.02, -0.01),
      },
      {
        group: createHexNut(),
        startPos: new THREE.Vector3(6, 4.5, -4),
        floatPos: new THREE.Vector3(3.0, 2.4, 2.2),
        targetPos: new THREE.Vector3(1.2, 0.8, 0.1),
        rotationSpeed: new THREE.Vector3(0.02, -0.03, 0.02),
      },
      {
        group: createGear(),
        startPos: new THREE.Vector3(0, 8, -6),
        floatPos: new THREE.Vector3(0, 3.2, 0.5),
        targetPos: new THREE.Vector3(0, 0.8, 0.15),
        rotationSpeed: new THREE.Vector3(0.008, 0.015, -0.012),
      },
      {
        group: createHexBolt(),
        startPos: new THREE.Vector3(8, 2, -5),
        floatPos: new THREE.Vector3(4.8, 1.2, 1.2),
        targetPos: new THREE.Vector3(0.8, 1.6, 0.2),
        rotationSpeed: new THREE.Vector3(-0.02, 0.02, 0.015),
      },
      {
        group: createHexNut(),
        startPos: new THREE.Vector3(-8, 1, -4),
        floatPos: new THREE.Vector3(-4.0, 0.5, 2.0),
        targetPos: new THREE.Vector3(-0.8, 1.6, 0.2),
        rotationSpeed: new THREE.Vector3(0.025, 0.015, 0.02),
      },
    ];

    floatingItems.forEach((item) => {
      item.group.position.copy(item.startPos);
      scene.add(item.group);
    });

    // -----------------------------------------------------------
    // Particle Dust Field (Deep Atmospheric Cinematic Space)
    // -----------------------------------------------------------
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let p = 0; p < dustCount * 3; p += 3) {
      dustPositions[p] = (Math.random() - 0.5) * 30;
      dustPositions[p + 1] = (Math.random() - 0.5) * 20;
      dustPositions[p + 2] = (Math.random() - 0.5) * 20;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.08,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // -----------------------------------------------------------
    // Arabic Brand Title & Subtitle 3D Planar Meshes
    // -----------------------------------------------------------
    const createTextTexture = (
      text: string,
      fontSize: number,
      color1: string,
      color2: string,
      glowColor: string,
      isSubtitle: boolean = false
    ): THREE.CanvasTexture => {
      const tCanvas = document.createElement('canvas');
      tCanvas.width = 2048;
      tCanvas.height = 512;
      const ctx = tCanvas.getContext('2d')!;

      ctx.clearRect(0, 0, tCanvas.width, tCanvas.height);

      ctx.font = `${isSubtitle ? '500' : 'bold 900'} ${fontSize}px 'Cairo', 'Amiri', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Subtle drop shadow / ambient occlusion
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 12;

      // Metallic Brushed Gold Gradient
      const grad = ctx.createLinearGradient(0, 160, 0, 360);
      grad.addColorStop(0.0, color1);
      grad.addColorStop(0.4, '#ffffff');
      grad.addColorStop(0.65, color2);
      grad.addColorStop(1.0, '#b45309');

      ctx.fillStyle = grad;
      ctx.fillText(text, tCanvas.width / 2, tCanvas.height / 2);

      // Gold Glow Rim Stroke
      ctx.lineWidth = isSubtitle ? 2 : 4;
      ctx.strokeStyle = glowColor;
      ctx.strokeText(text, tCanvas.width / 2, tCanvas.height / 2);

      const texture = new THREE.CanvasTexture(tCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const titleTexture = createTextTexture(brandName, 140, '#fef08a', '#f59e0b', 'rgba(245, 158, 11, 0.45)');
    const titleMat = new THREE.MeshBasicMaterial({
      map: titleTexture,
      transparent: true,
      opacity: 0,
    });
    const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), titleMat);
    titleMesh.position.set(0, -2.1, 0.8);
    scene.add(titleMesh);

    const subTexture = createTextTexture(managerName, 80, '#f8fafc', '#cbd5e1', 'rgba(203, 213, 225, 0.3)', true);
    const subMat = new THREE.MeshBasicMaterial({
      map: subTexture,
      transparent: true,
      opacity: 0,
    });
    const subMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.0), subMat);
    subMesh.position.set(0, -3.4, 0.8);
    scene.add(subMesh);

    // -----------------------------------------------------------
    // Animation Loop (60 FPS, 0s to 6.0s)
    // -----------------------------------------------------------
    timelineRef.current.startTime = performance.now();
    timelineRef.current.lastTime = performance.now();
    soundPlayedRef.current = {
      introSub: false,
      assembleWhoosh: false,
      lockClank: false,
      goldenGleam: false,
    };

    const animate = (timestamp: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      if (!timelineRef.current.isPlaying) {
        timelineRef.current.lastTime = timestamp;
        renderer.render(scene, camera);
        return;
      }

      const delta = (timestamp - timelineRef.current.lastTime) / 1000;
      timelineRef.current.lastTime = timestamp;
      timelineRef.current.elapsed += delta;

      const t = timelineRef.current.elapsed;
      setCurrentTime(Math.min(6.0, t));

      // Dust rotation
      dustPoints.rotation.y += 0.001;
      dustPoints.rotation.x += 0.0005;

      // ---------------------------------------------------------
      // Timeline Phase Breakdown:
      // 0.0s – 1.5s: Objects emerge from darkness into cinematic slow motion
      // 1.5s – 3.0s: Rotate and assemble into geometric emblem with lighting
      // 3.0s – 4.5s: Emblem centers, Arabic title emerges with 3D metallic presence
      // 4.5s – 6.0s: Subtitle fades in, golden light sweeps across, pristine stable composition
      // ---------------------------------------------------------

      // Trigger Sounds along timeline
      if (t >= 0.05 && !soundPlayedRef.current.introSub) {
        soundPlayedRef.current.introSub = true;
        playCinematicSound('sub_bass');
      }
      if (t >= 1.5 && !soundPlayedRef.current.assembleWhoosh) {
        soundPlayedRef.current.assembleWhoosh = true;
        playCinematicSound('metallic_whoosh');
      }
      if (t >= 2.95 && !soundPlayedRef.current.lockClank) {
        soundPlayedRef.current.lockClank = true;
        playCinematicSound('lock_clank');
      }
      if (t >= 4.55 && !soundPlayedRef.current.goldenGleam) {
        soundPlayedRef.current.goldenGleam = true;
        playCinematicSound('golden_gleam');
      }

      // 1. Camera Animation
      if (t < 1.5) {
        const p = t / 1.5;
        camera.position.z = 18 - p * 3.5;
        camera.position.y = 0.5 - p * 0.3;
        keyLight.intensity = THREE.MathUtils.lerp(0.8, 3.2, p);
      } else if (t < 3.0) {
        const p = (t - 1.5) / 1.5;
        camera.position.z = THREE.MathUtils.lerp(14.5, 12.8, p);
        camera.position.y = THREE.MathUtils.lerp(0.2, 0.4, p);
      } else if (t < 4.5) {
        const p = (t - 3.0) / 1.5;
        camera.position.z = THREE.MathUtils.lerp(12.8, 14.8, p);
        camera.position.y = THREE.MathUtils.lerp(0.4, -0.1, p);
      } else {
        camera.position.z = 14.8;
        camera.position.y = -0.1;
      }

      // 2. Floating Hardware Objects (0s - 3s)
      floatingItems.forEach((item) => {
        item.group.rotation.x += item.rotationSpeed.x;
        item.group.rotation.y += item.rotationSpeed.y;
        item.group.rotation.z += item.rotationSpeed.z;

        if (t < 1.5) {
          // Emerge into slow motion float
          const p = Math.min(1, t / 1.5);
          const easeOut = Math.sin((p * Math.PI) / 2);
          item.group.position.lerpVectors(item.startPos, item.floatPos, easeOut);
          item.group.scale.setScalar(THREE.MathUtils.lerp(0.2, 1.0, easeOut));
        } else if (t < 3.0) {
          // Fly and assemble into central emblem
          const p = (t - 1.5) / 1.5;
          const easeInCubic = p * p * (3 - 2 * p); // smoothstep
          item.group.position.lerpVectors(item.floatPos, item.targetPos, easeInCubic);
          const shrink = Math.max(0.001, 1 - p * 0.85);
          item.group.scale.setScalar(shrink);
          if (p > 0.95) {
            item.group.visible = false;
          }
        } else {
          item.group.visible = false;
        }
      });

      // 3. Central Hardware Store Emblem (1.5s - 6s)
      if (t >= 1.5 && t < 3.0) {
        const p = (t - 1.5) / 1.5;
        const scaleVal = THREE.MathUtils.lerp(0.01, 1.0, p);
        emblemGroup.scale.setScalar(scaleVal);
        emblemGroup.rotation.z = (1 - p) * Math.PI * 1.5;
        emblemGroup.rotation.y = (1 - p) * Math.PI * 0.8;
      } else if (t >= 3.0) {
        emblemGroup.visible = true;
        emblemGroup.scale.setScalar(1.0);
        emblemGroup.rotation.z = 0;
        emblemGroup.rotation.y = Math.sin(t * 1.2) * 0.06; // subtle idle luxury breathing
        masterGear.rotation.z = t * 0.4; // gear spins gently
      }

      // 4. Arabic Title "متجر خردوات المامو" (3.0s - 6s)
      if (t >= 3.0 && t < 4.5) {
        const p = (t - 3.0) / 1.5;
        const ease = Math.min(1, p * 1.4);
        titleMat.opacity = ease;
        titleMesh.scale.setScalar(THREE.MathUtils.lerp(0.85, 1.0, ease));
        titleMesh.position.y = THREE.MathUtils.lerp(-2.4, -2.1, ease);
      } else if (t >= 4.5) {
        titleMat.opacity = 1.0;
        titleMesh.scale.setScalar(1.0);
        titleMesh.position.y = -2.1;
      }

      // 5. Subtitle "بإدارة أحمد نوار المامو" (4.5s - 6s)
      if (t >= 4.5 && t <= 6.0) {
        const p = (t - 4.5) / 1.5;
        subMat.opacity = Math.min(1, p * 1.6);
        subMesh.position.y = THREE.MathUtils.lerp(-3.7, -3.4, Math.min(1, p * 1.4));
      }

      // 6. Golden Light Sweep across the Logo (4.6s - 5.6s)
      if (t >= 4.5 && t <= 5.8) {
        const p = (t - 4.5) / 1.3;
        sweepSpotLight.intensity = Math.sin(p * Math.PI) * 7.5;
        sweepSpotLight.position.x = THREE.MathUtils.lerp(-10, 10, p);
        sweepSpotLight.target = emblemGroup;
      } else {
        sweepSpotLight.intensity = 0;
      }

      // Completion check at 6.0 seconds
      if (t >= 6.0) {
        timelineRef.current.isPlaying = false;
        setIsPlaying(false);
        setIsCompleted(true);
      }

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      titleTexture.dispose();
      subTexture.dispose();
    };
  }, [isOpen, brandName, managerName, playCinematicSound]);

  // -------------------------------------------------------------
  // Controls Handlers
  // -------------------------------------------------------------
  const handleReplay = () => {
    timelineRef.current.startTime = performance.now();
    timelineRef.current.lastTime = performance.now();
    timelineRef.current.elapsed = 0;
    timelineRef.current.isPlaying = true;
    soundPlayedRef.current = {
      introSub: false,
      assembleWhoosh: false,
      lockClank: false,
      goldenGleam: false,
    };
    setCurrentTime(0);
    setIsPlaying(true);
    setIsCompleted(false);
    initAudio();
  };

  const handleTogglePlay = () => {
    initAudio();
    timelineRef.current.isPlaying = !timelineRef.current.isPlaying;
    timelineRef.current.lastTime = performance.now();
    setIsPlaying(timelineRef.current.isPlaying);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-2 sm:p-4 md:p-6 font-['Cairo',sans-serif]"
    >
      {/* 16:9 Full HD Cinematic Container */}
      <div className="relative w-full max-w-[1920px] max-h-[1080px] aspect-video rounded-2xl overflow-hidden bg-[#070A0F] shadow-2xl border border-slate-800/80 flex flex-col justify-between">
        {/* Top Cinematic Overlay Header */}
        <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-black tracking-wider text-amber-300">
                المقدمة السينمائية 3D • 6 ثوانٍ
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
                16:9 • 60 FPS • Real-time Three.js
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'تشغيل المؤثرات الصوتية' : 'كتم الصوت'}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              <span className="hidden sm:inline">{isMuted ? 'صامت' : 'مؤثرات 3D'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              title="ملء الشاشة"
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              title="إغلاق والعودة للتطبيق"
              className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-700/40 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Three.js 3D WebGL Canvas */}
        <div className="relative w-full h-full flex items-center justify-center">
          <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" onClick={handleTogglePlay} />

          {/* Dynamic Golden Sweep Ray Overlay on 4.5s */}
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/15 to-transparent transition-opacity duration-700 ${
              currentTime >= 4.5 && currentTime <= 5.8 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transform: `translateX(${(currentTime - 4.5) * 120 - 50}%) rotate(-25deg)`,
            }}
          />

          {/* End State Badge when 6s is reached */}
          {isCompleted && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-24 z-30 flex items-center gap-3 bg-slate-900/90 border border-amber-500/40 rounded-xl px-5 py-2.5 shadow-2xl backdrop-blur-md animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-right">
                <p className="text-xs font-bold text-white leading-tight">متجر خردوات المامو جاهز للعمل</p>
                <p className="text-[10px] text-amber-300 font-medium">{managerName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mr-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                الدخول للنظام
              </button>
            </div>
          )}
        </div>

        {/* Bottom Cinematic Control Dock */}
        <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-2.5">
          {/* Timeline Bar (0.0s to 6.0s) */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-amber-400 tabular-nums">
              {currentTime.toFixed(2)} ث
            </span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 transition-all duration-75"
                style={{ width: `${(currentTime / 6.0) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400">6.00 ث</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
              </button>

              <button
                type="button"
                onClick={handleReplay}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700/60 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>إعادة العرض (6 ثوانٍ)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>تخطي إلى لوحة التحكم</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
