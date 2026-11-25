import * as THREE from 'three';
import { createHumanoid } from './humanoid';

export interface Player {
  group: THREE.Group;
  placeReady(ballPos: THREE.Vector3, aimDir: THREE.Vector3): void;
  startKick(ballPos: THREE.Vector3, kickDir: THREE.Vector3, curveSign: number, onImpact: () => void): void;
  celebrateGoal(): void;
  reactMiss(): void;
  update(dt: number, elapsed: number): void;
}

function createJerseyTexture(): THREE.CanvasTexture {
  const w = 256, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;

  // Base colour
  ctx.fillStyle = '#c82333';
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical stripe sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 14, h);

  // White collar
  ctx.fillStyle = '#f5f6f3';
  ctx.fillRect(0, 0, w, 18);

  // Jersey number
  ctx.fillStyle = '#f8faf8';
  ctx.font = '900 84px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('10', w * 0.5, h * 0.52);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPlayer(scene: THREE.Scene): Player {
  const rig = createHumanoid({
    jersey: new THREE.MeshStandardMaterial({ map: createJerseyTexture(), roughness: 0.72 }),
    shorts: new THREE.MeshStandardMaterial({ color: 0xf4f5f2, roughness: 0.75 }),
    socks: new THREE.MeshStandardMaterial({ color: 0xc82333, roughness: 0.7 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd9a17c, roughness: 0.65 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x1e1916, roughness: 0.85 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.38, metalness: 0.15 }),
  });
  scene.add(rig.group);

  const { group, hips, torsoPivot, neckPivot, headPivot, leftArm, rightArm, leftLeg, rightLeg } = rig;

  type Mode = 'idle' | 'kicking' | 'celebrate' | 'miss';
  let mode: Mode = 'idle';
  let animT = 0;
  let emotionT = 0;
  let impactFired = false;
  let impactCb: (() => void) | null = null;
  let kickCurve = 0;

  const startPos = new THREE.Vector3();
  const strikePos = new THREE.Vector3();
  let currentYaw = 0;
  let targetYaw = 0;

  const tmpDir = new THREE.Vector3();
  const tmpSide = new THREE.Vector3();

  function resetJoints() {
    hips.position.set(0, 0.94, 0);
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.06, 0, 0);
    neckPivot.rotation.set(0, 0, 0);
    headPivot.rotation.set(-0.04, 0, 0);
    leftArm.shoulder.rotation.set(0.1, 0, 0.16);
    leftArm.elbow.rotation.set(-0.35, 0, 0);
    rightArm.shoulder.rotation.set(0.1, 0, -0.16);
    rightArm.elbow.rotation.set(-0.35, 0, 0);
    leftLeg.hip.rotation.set(0, 0, 0);
    leftLeg.knee.rotation.set(0, 0, 0);
    rightLeg.hip.rotation.set(0, 0, 0);
    rightLeg.knee.rotation.set(0, 0, 0);
  }

  function placeReady(ballPos: THREE.Vector3, aimDir: THREE.Vector3) {
    mode = 'idle';
    impactCb = null;
    emotionT = 0;
    tmpDir.copy(aimDir).setY(0).normalize();
    tmpSide.set(-tmpDir.z, 0, tmpDir.x);

    group.position
      .copy(ballPos).setY(0)
      .addScaledVector(tmpDir, -2.0)
      .addScaledVector(tmpSide, -0.55);

    currentYaw = Math.atan2(-tmpDir.x, -tmpDir.z);
    group.rotation.y = currentYaw;
    resetJoints();
  }

  function startKick(ballPos: THREE.Vector3, kickDir: THREE.Vector3, curveSign: number, onImpact: () => void) {
    mode = 'kicking';
    animT = 0;
    impactFired = false;
    impactCb = onImpact;
    kickCurve = curveSign;

    tmpDir.copy(kickDir).setY(0).normalize();
    tmpSide.set(-tmpDir.z, 0, tmpDir.x);

    startPos.copy(group.position);
    strikePos
      .copy(ballPos).setY(0)
      .addScaledVector(tmpDir, -0.22)
      .addScaledVector(tmpSide, -0.26);

    targetYaw = Math.atan2(-tmpDir.x, -tmpDir.z);
  }

  /** Sliding-knee / arms-wide celebration */
  function celebrateGoal() {
    mode = 'celebrate';
    emotionT = 0;
  }

  /** Head-down / hands-on-knees frustration */
  function reactMiss() {
    mode = 'miss';
    emotionT = 0;
  }

  const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function applyCelebrate(t: number) {
    // Phase 1 (0-0.5s): Slide on knees
    const slide = smoothstep(0, 0.5, t);
    // Phase 2 (0.5+): Arms out, head back, jumping joy
    const joy = smoothstep(0.5, 1.2, t);
    const bounce = Math.sin(t * 9) * joy;

    hips.position.y = 0.78 + joy * 0.18 + Math.abs(bounce) * 0.06;
    hips.rotation.set(0.3 * slide * (1 - joy), bounce * 0.1, 0);
    torsoPivot.rotation.set(-0.2 * joy + 0.1 * slide, bounce * 0.08, 0);
    neckPivot.rotation.set(-0.15 * joy, 0, 0);
    headPivot.rotation.set(-0.3 * joy, bounce * 0.08, 0); // head back = looking up in joy

    // Arms out wide
    leftArm.shoulder.rotation.set(-0.5 * joy + bounce * 0.1, 0, 0.6 + joy * 0.8);
    leftArm.elbow.rotation.set(-0.9 * joy, 0, 0);
    rightArm.shoulder.rotation.set(-0.5 * joy + bounce * 0.1, 0, -(0.6 + joy * 0.8));
    rightArm.elbow.rotation.set(-0.9 * joy, 0, 0);

    // Sliding legs
    leftLeg.hip.rotation.set(0.5 * slide + 0.1 * joy, 0, 0.1);
    leftLeg.knee.rotation.set(-0.9 * slide, 0, 0);
    rightLeg.hip.rotation.set(0.5 * slide + 0.1 * joy, 0, -0.1);
    rightLeg.knee.rotation.set(-0.9 * slide, 0, 0);
  }

  function applyMiss(t: number) {
    const slump = Math.min(1, t * 2.5);
    const shake = Math.sin(t * 14) * Math.max(0, 0.5 - t) * 0.3;

    hips.position.y = 0.9 - slump * 0.05;
    hips.rotation.set(0, shake, 0);
    torsoPivot.rotation.set(0.4 * slump, shake * 0.5, 0);  // hunched
    neckPivot.rotation.set(0.2 * slump, 0, 0);
    headPivot.rotation.set(0.3 * slump, shake * 0.4, 0);   // head looking down

    // Hands on knees
    leftArm.shoulder.rotation.set(0.5 * slump, 0, 0.5 + slump * 0.4);
    leftArm.elbow.rotation.set(-0.8 * slump, 0, 0);
    rightArm.shoulder.rotation.set(0.5 * slump, 0, -(0.5 + slump * 0.4));
    rightArm.elbow.rotation.set(-0.8 * slump, 0, 0);

    leftLeg.hip.rotation.set(0.3 * slump, 0, 0.1);
    leftLeg.knee.rotation.set(-0.5 * slump, 0, 0);
    rightLeg.hip.rotation.set(0.3 * slump, 0, -0.1);
    rightLeg.knee.rotation.set(-0.5 * slump, 0, 0);
  }

  function update(dt: number, elapsed: number) {
    if (mode === 'celebrate') {
      emotionT += dt;
      applyCelebrate(emotionT);
      return;
    }

    if (mode === 'miss') {
      emotionT += dt;
      applyMiss(emotionT);
      return;
    }

    if (mode === 'idle') {
      const b = Math.sin(elapsed * 2.4);
      hips.position.y = 0.94 + b * 0.012;
      torsoPivot.rotation.x = 0.08 + b * 0.02;
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(-0.04, 0, 0);
      leftArm.shoulder.rotation.z = 0.22 + b * 0.03;
      rightArm.shoulder.rotation.z = -0.22 - b * 0.03;
      leftLeg.hip.rotation.x = 0.14;
      leftLeg.knee.rotation.x = -0.25;
      rightLeg.hip.rotation.x = -0.14;
      rightLeg.knee.rotation.x = -0.2;
      return;
    }

    // kicking
    animT += dt;
    const IMPACT_T = 0.62;
    const END_T = 1.25;

    const runU = smoothstep(0, IMPACT_T, animT);
    group.position.lerpVectors(startPos, strikePos, runU);

    if (animT > IMPACT_T) {
      const followU = smoothstep(IMPACT_T, END_T, animT);
      tmpDir.set(-Math.sin(targetYaw), 0, -Math.cos(targetYaw));
      group.position.copy(strikePos).addScaledVector(tmpDir, followU * 0.55);
    }

    let dYaw = targetYaw - currentYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    group.rotation.y = currentYaw + dYaw * smoothstep(0, 0.35, animT);

    if (animT < 0.42) {
      const stride = Math.sin((animT / 0.42) * Math.PI * 2.5);
      hips.position.y = 0.92 + Math.abs(stride) * 0.045;
      torsoPivot.rotation.x = 0.22;
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(-0.04, 0, 0);
      leftLeg.hip.rotation.x = stride * 0.55;
      leftLeg.knee.rotation.x = -Math.max(0, -stride) * 0.85 - 0.15;
      rightLeg.hip.rotation.x = -stride * 0.55;
      rightLeg.knee.rotation.x = -Math.max(0, stride) * 0.85 - 0.15;
      leftArm.shoulder.rotation.set(-stride * 0.5, 0, 0.32);
      rightArm.shoulder.rotation.set(stride * 0.5, 0, -0.32);
    } else if (animT < IMPACT_T) {
      const u = (animT - 0.42) / (IMPACT_T - 0.42);
      const back = smoothstep(0, 0.45, u) * (1 - smoothstep(0.45, 1.0, u));
      const whip = smoothstep(0.42, 1.0, u);

      hips.position.y = 0.89;
      hips.rotation.y = (0.35 - whip * 0.55) * 0.9;
      torsoPivot.rotation.set(0.18 - whip * 0.12, -0.25 + whip * 0.35, -0.24 - kickCurve * 0.08);
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(-0.1, 0, 0);

      leftLeg.hip.rotation.set(0.22, 0, 0.12);
      leftLeg.knee.rotation.set(-0.42, 0, 0);
      rightLeg.hip.rotation.set(-0.95 * back + 0.55 * whip, 0, -0.18 * (1 - whip));
      rightLeg.knee.rotation.set(-1.15 * back - 0.15 * whip, 0, 0);

      leftArm.shoulder.rotation.set(-0.4 + whip * 0.8, 0, 0.78);
      leftArm.elbow.rotation.set(-0.5, 0, 0);
      rightArm.shoulder.rotation.set(0.45 - whip * 0.85, 0, -0.45);
    } else {
      if (!impactFired) {
        impactFired = true;
        impactCb?.();
      }
      const f = smoothstep(IMPACT_T, END_T, animT);
      const decay = 1 - f;
      hips.position.y = 0.9 + f * 0.04;
      hips.rotation.y = -0.22 * decay;
      torsoPivot.rotation.set(0.12, 0.15 * decay, -0.2 * decay);
      neckPivot.rotation.set(0, 0, 0);

      leftLeg.hip.rotation.set(0.18 * decay, 0, 0.08 * decay);
      leftLeg.knee.rotation.set(-0.35 * decay, 0, 0);
      rightLeg.hip.rotation.set(0.9 * decay - 0.08, 0, 0.18 * decay);
      rightLeg.knee.rotation.set(-0.25 * decay, 0, 0);
      leftArm.shoulder.rotation.set(0.35 * decay, 0, 0.65 * decay + 0.2);
      rightArm.shoulder.rotation.set(-0.35 * decay, 0, -0.4 * decay - 0.2);

      if (animT >= END_T) {
        mode = 'idle';
      }
    }
  }

  return { group, placeReady, startKick, celebrateGoal, reactMiss, update };
}
