import * as THREE from 'three';
import { createHumanoid } from './humanoid';
import {
  createJerseyMaterial,
  createShortsMaterial,
  createSocksMaterial,
  createBootMaterial,
  createSkinMaterial,
  createHairMaterial,
} from './textures';

export interface Player {
  group: THREE.Group;
  placeReady(ballPos: THREE.Vector3, aimDir: THREE.Vector3): void;
  startKick(ballPos: THREE.Vector3, kickDir: THREE.Vector3, curveSign: number, onImpact: () => void): void;
  celebrateGoal(): void;
  reactMiss(): void;
  update(dt: number, elapsed: number): void;
}

export function createPlayer(scene: THREE.Scene): Player {
  // Pro athletic red/navy home kit with procedural micro-textures
  const rig = createHumanoid({
    jersey: createJerseyMaterial({
      baseColor: '#b91c1c',
      accentColor: '#991b1b',
      trimColor: '#ffffff',
      numberText: '10',
    }),
    shorts: createShortsMaterial('#f8fafc', '#b91c1c'),
    socks: createSocksMaterial('#b91c1c', '#ffffff'),
    skin: createSkinMaterial('#c98e6b'),
    hair: createHairMaterial('#18110e'),
    boots: createBootMaterial('#0f172a', '#eab308'),
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

  const smoothstep = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function resetJoints() {
    hips.position.set(0, 0.94, 0);
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.06, 0, 0);
    neckPivot.rotation.set(0, 0, 0);
    headPivot.rotation.set(-0.04, 0, 0);
    leftArm.shoulder.rotation.set(0.12, 0, 0.16);
    leftArm.elbow.rotation.set(-0.35, 0, 0);
    rightArm.shoulder.rotation.set(0.12, 0, -0.16);
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
      .copy(ballPos)
      .setY(0)
      .addScaledVector(tmpDir, -2.1)
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
      .copy(ballPos)
      .setY(0)
      .addScaledVector(tmpDir, -0.22)
      .addScaledVector(tmpSide, -0.26);

    targetYaw = Math.atan2(-tmpDir.x, -tmpDir.z);
  }

  function celebrateGoal() {
    mode = 'celebrate';
    emotionT = 0;
  }

  function reactMiss() {
    mode = 'miss';
    emotionT = 0;
  }

  /* ── ATHLETIC CELEBRATION (Iconic knee slide / roar) ───────────── */
  function applyCelebrate(t: number) {
    const joy = Math.min(1, t * 2.2);
    const bounce = Math.sin(t * 8.5) * joy;

    hips.position.y = 0.94 + Math.abs(bounce) * 0.08;
    hips.rotation.set(0, bounce * 0.12, 0);
    torsoPivot.rotation.set(-0.2 * joy, bounce * 0.06, 0);
    neckPivot.rotation.set(-0.15 * joy, 0, 0);
    headPivot.rotation.set(-0.25 * joy + bounce * 0.08, 0, 0); // Looking up with pride

    // Arms pumped high in victory
    leftArm.shoulder.rotation.set(-1.0 * joy + bounce * 0.1, 0, 0.65 + joy * 0.55);
    leftArm.elbow.rotation.set(-1.1 * joy, 0, 0);
    rightArm.shoulder.rotation.set(-1.0 * joy + bounce * 0.1, 0, -(0.65 + joy * 0.55));
    rightArm.elbow.rotation.set(-1.1 * joy, 0, 0);

    // Dynamic running celebration step
    leftLeg.hip.rotation.set(0.12 * joy, 0, 0.08);
    leftLeg.knee.rotation.set(-0.22 * joy, 0, 0);
    rightLeg.hip.rotation.set(0.12 * joy, 0, -0.08);
    rightLeg.knee.rotation.set(-0.22 * joy, 0, 0);
  }

  /* ── ATHLETIC MISS (Hands on hips / head in hands) ─────────────── */
  function applyMiss(t: number) {
    const slump = Math.min(1, t * 2.2);
    const headShake = Math.sin(t * 9) * Math.max(0, 0.55 - t * 0.3) * 0.32;

    hips.position.y = 0.92 - slump * 0.04;
    hips.rotation.set(0, headShake * 0.3, 0);
    torsoPivot.rotation.set(0.38 * slump, headShake * 0.4, 0);
    neckPivot.rotation.set(0.18 * slump, 0, 0);
    headPivot.rotation.set(0.28 * slump, headShake, 0);

    // Hands on hips / head in despair
    leftArm.shoulder.rotation.set(-0.45 * slump, 0, 0.55);
    leftArm.elbow.rotation.set(-1.2 * slump, 0, 0);
    rightArm.shoulder.rotation.set(-0.45 * slump, 0, -0.55);
    rightArm.elbow.rotation.set(-1.2 * slump, 0, 0);

    leftLeg.hip.rotation.set(0.22 * slump, 0, 0.08);
    leftLeg.knee.rotation.set(-0.35 * slump, 0, 0);
    rightLeg.hip.rotation.set(0.22 * slump, 0, -0.08);
    rightLeg.knee.rotation.set(-0.35 * slump, 0, 0);
  }

  /* ── UPDATE LOOP ───────────────────────────────────────────────── */
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
      headPivot.rotation.set(-0.04, Math.sin(elapsed * 1.2) * 0.05, 0);
      leftArm.shoulder.rotation.z = 0.22 + b * 0.03;
      rightArm.shoulder.rotation.z = -0.22 - b * 0.03;
      leftLeg.hip.rotation.x = 0.14;
      leftLeg.knee.rotation.x = -0.25;
      rightLeg.hip.rotation.x = -0.14;
      rightLeg.knee.rotation.x = -0.2;
      return;
    }

    // Kicking run-up & strike
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
      headPivot.rotation.set(-0.08, 0, 0);

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
