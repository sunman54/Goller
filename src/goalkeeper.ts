import * as THREE from 'three';
import { createHumanoid } from './humanoid';
import { GOAL } from './pitch';
import { BALL_RADIUS } from './ball';
import {
  createJerseyMaterial,
  createShortsMaterial,
  createSocksMaterial,
  createBootMaterial,
  createSkinMaterial,
  createHairMaterial,
  createGloveMaterial,
} from './textures';

export interface Goalkeeper {
  group: THREE.Group;
  reset(ballSpot: THREE.Vector3): void;
  reactToShot(target: THREE.Vector3, duration: number): void;
  celebrateSave(): void;
  reactGoal(): void;
  update(dt: number, elapsed: number): void;
  collideBall(pos: THREE.Vector3, vel: THREE.Vector3): boolean;
}

export function createGoalkeeper(scene: THREE.Scene): Goalkeeper {
  // Pro high-visibility goalkeeper kit with latex gloves
  const rig = createHumanoid({
    jersey: createJerseyMaterial({
      baseColor: '#06b6d4',
      accentColor: '#0891b2',
      trimColor: '#164e63',
      numberText: '1',
      isGoalkeeper: true,
    }),
    shorts: createShortsMaterial('#0f172a', '#06b6d4'),
    socks: createSocksMaterial('#0891b2', '#0f172a'),
    boots: createBootMaterial('#0f172a', '#06b6d4'),
    skin: createSkinMaterial('#d49774'),
    hair: createHairMaterial('#221712'),
    gloves: createGloveMaterial(),
  });

  const { group, hips, torsoPivot, neckPivot, headPivot, leftArm, rightArm, leftLeg, rightLeg } = rig;
  group.rotation.y = Math.PI; // Face the shooter (+Z direction)
  scene.add(group);

  type Mode = 'ready' | 'diving' | 'celebrate' | 'sad';
  let mode: Mode = 'ready';
  let baseX = 0;
  let diveT = 0;
  let diveDuration = 0.7;
  let diveStartX = 0;
  let diveTargetX = 0;
  let divePeakY = 0;
  let diveSide = 0;
  let emotionT = 0;
  const reactionDelay = 0.14;

  const torsoWorld = new THREE.Vector3();
  const handsWorld = new THREE.Vector3();
  const normal = new THREE.Vector3();

  /* ── ATHLETIC READY CROUCH ─────────────────────────────────────── */
  function applyReady(elapsed: number) {
    const bounce = Math.sin(elapsed * 5.2);
    hips.position.set(0, 0.88 + Math.abs(bounce) * 0.025, 0);
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.22, 0, 0);
    neckPivot.rotation.set(-0.1, 0, 0);
    headPivot.rotation.set(0, Math.sin(elapsed * 1.8) * 0.08, 0); // Vigilant scanning

    leftLeg.hip.rotation.set(0.32, 0, 0.16);
    leftLeg.knee.rotation.set(-0.55, 0, 0);
    rightLeg.hip.rotation.set(0.32, 0, -0.16);
    rightLeg.knee.rotation.set(-0.55, 0, 0);

    leftArm.shoulder.rotation.set(0.55, 0, 0.45);
    leftArm.elbow.rotation.set(0.85, 0, 0);
    rightArm.shoulder.rotation.set(0.55, 0, -0.45);
    rightArm.elbow.rotation.set(0.85, 0, 0);
  }

  /* ── SAVED CELEBRATION (Fist pump & roar) ───────────────────────── */
  function applyCelebrate(t: number) {
    const joy = Math.min(1, t * 2.4);
    const bounce = Math.sin(t * 8) * joy;

    hips.position.y = 0.94 + Math.abs(bounce) * 0.08;
    hips.rotation.set(0, bounce * 0.15, 0);
    torsoPivot.rotation.set(-0.18 + bounce * 0.08, 0, 0);
    neckPivot.rotation.set(-0.15, 0, 0);
    headPivot.rotation.set(-0.25, bounce * 0.1, 0);

    // Arms raised in victory V with gloves
    leftArm.shoulder.rotation.set(-0.9 + bounce * 0.15, 0, 0.6);
    leftArm.elbow.rotation.set(-1.2 + bounce * 0.2, 0, 0);
    rightArm.shoulder.rotation.set(-0.9 + bounce * 0.15, 0, -0.6);
    rightArm.elbow.rotation.set(-1.2 + bounce * 0.2, 0, 0);

    leftLeg.hip.rotation.set(-0.2 + Math.abs(bounce) * 0.15, 0, 0.1);
    leftLeg.knee.rotation.set(-0.15, 0, 0);
    rightLeg.hip.rotation.set(-0.2 + Math.abs(bounce) * 0.15, 0, -0.1);
    rightLeg.knee.rotation.set(-0.15, 0, 0);
  }

  /* ── CONCEDED GOAL REACTION (Hands on hips / head down) ─────────── */
  function applySad(t: number) {
    const slump = Math.min(1, t * 2.2);
    hips.position.y = 0.88 - slump * 0.06;
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.48 * slump, 0, 0);
    neckPivot.rotation.set(0.25 * slump, 0, 0);
    headPivot.rotation.set(0.28 * slump, 0, 0);

    // Gloves covering face in despair
    leftArm.shoulder.rotation.set(-0.58 * slump, 0, 0.35);
    leftArm.elbow.rotation.set(-0.95 * slump, 0, 0);
    rightArm.shoulder.rotation.set(-0.58 * slump, 0, -0.35);
    rightArm.elbow.rotation.set(-0.95 * slump, 0, 0);

    leftLeg.hip.rotation.set(0.25 * slump, 0, 0.12);
    leftLeg.knee.rotation.set(-0.4 * slump, 0, 0);
    rightLeg.hip.rotation.set(0.25 * slump, 0, -0.12);
    rightLeg.knee.rotation.set(-0.4 * slump, 0, 0);
  }

  /* ── API ──────────────────────────────────────────────────────── */
  function reset(ballSpot: THREE.Vector3) {
    mode = 'ready';
    diveT = 0;
    emotionT = 0;
    baseX = THREE.MathUtils.clamp(ballSpot.x * 0.12, -1.0, 1.0);
    group.position.set(baseX, 0, GOAL.z + 0.35);
    group.rotation.set(0, Math.PI, 0);
    applyReady(0);
  }

  function reactToShot(target: THREE.Vector3, shotDuration: number) {
    mode = 'diving';
    diveT = 0;
    diveStartX = group.position.x;
    const clampedX = THREE.MathUtils.clamp(target.x, -GOAL.width / 2 + 0.35, GOAL.width / 2 - 0.35);
    const maxDiveDist = Math.max(0.6, (shotDuration - reactionDelay) * 5.4);
    const dx = clampedX - diveStartX;
    diveTargetX = diveStartX + Math.sign(dx) * Math.min(Math.abs(dx), maxDiveDist);
    diveSide = Math.sign(dx);
    diveDuration = THREE.MathUtils.clamp(shotDuration - reactionDelay, 0.35, 0.85);
    divePeakY = THREE.MathUtils.clamp(target.y - 0.85, 0, 1.15);
  }

  function celebrateSave() {
    mode = 'celebrate';
    emotionT = 0;
  }

  function reactGoal() {
    mode = 'sad';
    emotionT = 0;
  }

  function update(dt: number, elapsed: number) {
    if (mode === 'ready') {
      group.position.x = baseX + Math.sin(elapsed * 2.1) * 0.25;
      group.position.y = 0;
      applyReady(elapsed);
      return;
    }
    if (mode === 'celebrate') {
      emotionT += dt;
      applyCelebrate(emotionT);
      return;
    }
    if (mode === 'sad') {
      emotionT += dt;
      applySad(emotionT);
      return;
    }

    // Diving animation
    diveT += dt;
    if (diveT < reactionDelay) {
      applyReady(elapsed);
      return;
    }

    const u = Math.min(1, (diveT - reactionDelay) / diveDuration);
    const easeOut = 1 - (1 - u) * (1 - u);
    const airArc = Math.sin(u * Math.PI);

    group.position.x = THREE.MathUtils.lerp(diveStartX, diveTargetX, easeOut);
    group.position.y = divePeakY * airArc;

    const localTilt = diveSide * Math.min(1.25, Math.abs(diveTargetX - diveStartX) * 0.55) * easeOut;
    hips.position.y = 0.88;
    hips.rotation.set(0, 0, localTilt);
    torsoPivot.rotation.set(0.15, 0, 0);
    neckPivot.rotation.set(-0.1, 0, 0);
    headPivot.rotation.set(0, 0, 0);

    const reach = Math.min(1, Math.abs(diveTargetX - diveStartX) * 0.8 + divePeakY * 0.5);
    leftArm.shoulder.rotation.set(0.35, 0, 0.45 + reach * 2.15);
    leftArm.elbow.rotation.set(0.25 * (1 - reach), 0, 0);
    rightArm.shoulder.rotation.set(0.35, 0, -0.45 - reach * 2.15);
    rightArm.elbow.rotation.set(0.25 * (1 - reach), 0, 0);

    leftLeg.hip.rotation.set(0.2 * (1 - reach), 0, 0.15);
    leftLeg.knee.rotation.set(-0.35 * (1 - reach), 0, 0);
    rightLeg.hip.rotation.set(0.2 * (1 - reach), 0, -0.15);
    rightLeg.knee.rotation.set(-0.35 * (1 - reach), 0, 0);
  }

  function collideBall(pos: THREE.Vector3, vel: THREE.Vector3): boolean {
    if (Math.abs(pos.z - group.position.z) > 0.75) return false;
    group.updateMatrixWorld(true);
    torsoWorld.set(0, 0.25, 0).applyMatrix4(torsoPivot.matrixWorld);
    handsWorld.set(0, 0.62, -0.18).applyMatrix4(torsoPivot.matrixWorld);

    const checks: [THREE.Vector3, number][] = [
      [torsoWorld, 0.36 + BALL_RADIUS],
      [handsWorld, 0.34 + BALL_RADIUS],
    ];

    for (const [center, rad] of checks) {
      const dist = pos.distanceTo(center);
      if (dist > 1e-4 && dist < rad) {
        normal.copy(pos).sub(center).divideScalar(dist);
        if (normal.z < 0.25) {
          normal.z = 0.55;
          normal.normalize();
        }
        pos.copy(center).addScaledVector(normal, rad + 0.01);
        const vn = vel.dot(normal);
        if (vn < 0) {
          vel.addScaledVector(normal, -1.62 * vn);
          vel.multiplyScalar(0.75);
        } else {
          vel.z = Math.abs(vel.z) * 0.55;
        }
        return true;
      }
    }
    return false;
  }

  return { group, reset, reactToShot, celebrateSave, reactGoal, update, collideBall };
}
