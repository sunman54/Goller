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

export function createPlayer(scene: THREE.Scene): Player {
  // Bright cartoon colours for the striker
  const rig = createHumanoid({
    jersey: new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.55 }),   // vivid red
    shorts: new THREE.MeshStandardMaterial({ color: 0x1d2b53, roughness: 0.65 }),   // deep navy
    socks:  new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.6 }),
    skin:   new THREE.MeshStandardMaterial({ color: 0xf4c48e, roughness: 0.6 }),    // warm cartoon skin
    hair:   new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.8 }),
    boots:  new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.35, metalness: 0.05 }), // bright yellow boots
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
    hips.position.set(0, 0.72, 0);
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.05, 0, 0);
    neckPivot.rotation.set(0, 0, 0);
    headPivot.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(0.1, 0, 0.18);
    leftArm.elbow.rotation.set(-0.3, 0, 0);
    rightArm.shoulder.rotation.set(0.1, 0, -0.18);
    rightArm.elbow.rotation.set(-0.3, 0, 0);
    leftLeg.hip.rotation.set(0, 0, 0);
    leftLeg.knee.rotation.set(0, 0, 0);
    rightLeg.hip.rotation.set(0, 0, 0);
    rightLeg.knee.rotation.set(0, 0, 0);
  }

  function placeReady(ballPos: THREE.Vector3, aimDir: THREE.Vector3) {
    mode = 'idle'; impactCb = null; emotionT = 0;
    tmpDir.copy(aimDir).setY(0).normalize();
    tmpSide.set(-tmpDir.z, 0, tmpDir.x);
    group.position.copy(ballPos).setY(0)
      .addScaledVector(tmpDir, -1.9)
      .addScaledVector(tmpSide, -0.5);
    currentYaw = Math.atan2(-tmpDir.x, -tmpDir.z);
    group.rotation.y = currentYaw;
    resetJoints();
  }

  function startKick(ballPos: THREE.Vector3, kickDir: THREE.Vector3, curveSign: number, onImpact: () => void) {
    mode = 'kicking'; animT = 0; impactFired = false; impactCb = onImpact; kickCurve = curveSign;
    tmpDir.copy(kickDir).setY(0).normalize();
    tmpSide.set(-tmpDir.z, 0, tmpDir.x);
    startPos.copy(group.position);
    strikePos.copy(ballPos).setY(0)
      .addScaledVector(tmpDir, -0.2)
      .addScaledVector(tmpSide, -0.22);
    targetYaw = Math.atan2(-tmpDir.x, -tmpDir.z);
  }

  function celebrateGoal() { mode = 'celebrate'; emotionT = 0; }
  function reactMiss()      { mode = 'miss';      emotionT = 0; }

  /* ── EMOTION POSES ─────────────────────────────────────────────── */
  function applyCelebrate(t: number) {
    const joy = Math.min(1, t * 2);
    const bounce = Math.sin(t * 11) * joy;
    hips.position.y = 0.72 + Math.abs(bounce) * 0.1;
    hips.rotation.set(0, bounce * 0.15, 0);
    torsoPivot.rotation.set(-0.25 * joy, 0, 0);
    neckPivot.rotation.set(-0.1 * joy, 0, 0);
    // Big cartoon eyes "squint" – head tilts back
    headPivot.rotation.set(-0.4 * joy + bounce * 0.1, 0, 0);
    // Arms wide V
    leftArm.shoulder.rotation.set(-1.1 * joy, 0, 0.7 + joy * 0.5);
    leftArm.elbow.rotation.set(-0.9 * joy, 0, 0);
    rightArm.shoulder.rotation.set(-1.1 * joy, 0, -(0.7 + joy * 0.5));
    rightArm.elbow.rotation.set(-0.9 * joy, 0, 0);
    // Knees slightly bent – happy bounce
    leftLeg.hip.rotation.set(0.1 * joy, 0, 0.08);
    leftLeg.knee.rotation.set(-0.2 * joy, 0, 0);
    rightLeg.hip.rotation.set(0.1 * joy, 0, -0.08);
    rightLeg.knee.rotation.set(-0.2 * joy, 0, 0);
  }

  function applyMiss(t: number) {
    const slump = Math.min(1, t * 2);
    const shake = Math.sin(t * 16) * Math.max(0, 0.4 - t) * 0.4;
    hips.position.y = 0.68 + (1 - slump) * 0.04;
    hips.rotation.set(0, shake, 0);
    torsoPivot.rotation.set(0.5 * slump, 0, 0);
    neckPivot.rotation.set(0.2 * slump, 0, 0);
    // Head droops – exaggerated cartoon sadness
    headPivot.rotation.set(0.45 * slump, shake * 0.5, 0);
    // Hands on head
    leftArm.shoulder.rotation.set(-0.5 * slump, 0, 0.5);
    leftArm.elbow.rotation.set(-1.1 * slump, 0, 0);
    rightArm.shoulder.rotation.set(-0.5 * slump, 0, -0.5);
    rightArm.elbow.rotation.set(-1.1 * slump, 0, 0);
    leftLeg.hip.rotation.set(0.3 * slump, 0, 0.1);
    leftLeg.knee.rotation.set(-0.4 * slump, 0, 0);
    rightLeg.hip.rotation.set(0.3 * slump, 0, -0.1);
    rightLeg.knee.rotation.set(-0.4 * slump, 0, 0);
  }

  /* ── UPDATE ────────────────────────────────────────────────────── */
  function update(dt: number, elapsed: number) {
    if (mode === 'celebrate') { emotionT += dt; applyCelebrate(emotionT); return; }
    if (mode === 'miss')      { emotionT += dt; applyMiss(emotionT);      return; }

    if (mode === 'idle') {
      const b = Math.sin(elapsed * 2.6);
      hips.position.y = 0.72 + b * 0.012;
      torsoPivot.rotation.x = 0.05 + b * 0.02;
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(0, Math.sin(elapsed * 1.1) * 0.06, 0); // slight idle head sway
      leftArm.shoulder.rotation.z = 0.2 + b * 0.03;
      rightArm.shoulder.rotation.z = -0.2 - b * 0.03;
      leftLeg.hip.rotation.x = 0.12;
      leftLeg.knee.rotation.x = -0.22;
      rightLeg.hip.rotation.x = -0.12;
      rightLeg.knee.rotation.x = -0.18;
      return;
    }

    // kicking
    animT += dt;
    const IMPACT_T = 0.60;
    const END_T = 1.2;

    const runU = smoothstep(0, IMPACT_T, animT);
    group.position.lerpVectors(startPos, strikePos, runU);

    if (animT > IMPACT_T) {
      const fU = smoothstep(IMPACT_T, END_T, animT);
      tmpDir.set(-Math.sin(targetYaw), 0, -Math.cos(targetYaw));
      group.position.copy(strikePos).addScaledVector(tmpDir, fU * 0.5);
    }

    let dYaw = targetYaw - currentYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    group.rotation.y = currentYaw + dYaw * smoothstep(0, 0.35, animT);

    if (animT < 0.42) {
      const stride = Math.sin((animT / 0.42) * Math.PI * 2.5);
      hips.position.y = 0.70 + Math.abs(stride) * 0.05;
      torsoPivot.rotation.x = 0.2;
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(-0.05, 0, 0);
      leftLeg.hip.rotation.x = stride * 0.6;
      leftLeg.knee.rotation.x = -Math.max(0, -stride) * 0.9 - 0.15;
      rightLeg.hip.rotation.x = -stride * 0.6;
      rightLeg.knee.rotation.x = -Math.max(0, stride) * 0.9 - 0.15;
      leftArm.shoulder.rotation.set(-stride * 0.5, 0, 0.3);
      rightArm.shoulder.rotation.set(stride * 0.5, 0, -0.3);
    } else if (animT < IMPACT_T) {
      const u = (animT - 0.42) / (IMPACT_T - 0.42);
      const back = smoothstep(0, 0.45, u) * (1 - smoothstep(0.45, 1.0, u));
      const whip = smoothstep(0.42, 1.0, u);

      hips.position.y = 0.68;
      hips.rotation.y = (0.35 - whip * 0.55) * 0.9;
      torsoPivot.rotation.set(0.15 - whip * 0.1, -0.22 + whip * 0.3, -0.2 - kickCurve * 0.08);
      neckPivot.rotation.set(0, 0, 0);
      headPivot.rotation.set(-0.08, 0, 0);

      leftLeg.hip.rotation.set(0.2, 0, 0.1);
      leftLeg.knee.rotation.set(-0.4, 0, 0);
      rightLeg.hip.rotation.set(-0.9 * back + 0.5 * whip, 0, -0.15 * (1 - whip));
      rightLeg.knee.rotation.set(-1.1 * back - 0.12 * whip, 0, 0);

      leftArm.shoulder.rotation.set(-0.4 + whip * 0.8, 0, 0.75);
      leftArm.elbow.rotation.set(-0.5, 0, 0);
      rightArm.shoulder.rotation.set(0.4 - whip * 0.8, 0, -0.4);
    } else {
      if (!impactFired) { impactFired = true; impactCb?.(); }
      const f = smoothstep(IMPACT_T, END_T, animT);
      const decay = 1 - f;
      hips.position.y = 0.70 + f * 0.04;
      hips.rotation.y = -0.2 * decay;
      torsoPivot.rotation.set(0.1, 0.12 * decay, -0.18 * decay);
      leftLeg.hip.rotation.set(0.15 * decay, 0, 0.08 * decay);
      leftLeg.knee.rotation.set(-0.3 * decay, 0, 0);
      rightLeg.hip.rotation.set(0.85 * decay - 0.08, 0, 0.15 * decay);
      rightLeg.knee.rotation.set(-0.22 * decay, 0, 0);
      leftArm.shoulder.rotation.set(0.3 * decay, 0, 0.6 * decay + 0.2);
      rightArm.shoulder.rotation.set(-0.3 * decay, 0, -0.35 * decay - 0.2);
      if (animT >= END_T) mode = 'idle';
    }
  }

  return { group, placeReady, startKick, celebrateGoal, reactMiss, update };
}
