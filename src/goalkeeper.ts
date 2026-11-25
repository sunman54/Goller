import * as THREE from 'three';
import { BALL_RADIUS } from './ball';
import { createHumanoid } from './humanoid';
import { GOAL } from './pitch';

export interface Goalkeeper {
  group: THREE.Group;
  reset(ballSpot: THREE.Vector3): void;
  reactToShot(target: THREE.Vector3, duration: number): void;
  update(dt: number, elapsed: number): void;
  collideBall(pos: THREE.Vector3, vel: THREE.Vector3): boolean;
}

export function createGoalkeeper(scene: THREE.Scene): Goalkeeper {
  const rig = createHumanoid({
    jersey: new THREE.MeshStandardMaterial({ color: 0xd4f235, roughness: 0.65 }),
    shorts: new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.75 }),
    socks: new THREE.MeshStandardMaterial({ color: 0xd4f235, roughness: 0.7 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd69c77, roughness: 0.65 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x261d17, roughness: 0.85 }),
    gloves: new THREE.MeshStandardMaterial({ color: 0xf7faf8, roughness: 0.5 }),
  });

  const { group, hips, torsoPivot, leftArm, rightArm, leftLeg, rightLeg } = rig;
  // Face +Z (toward the shooter)
  group.rotation.y = Math.PI;
  scene.add(group);

  let mode: 'ready' | 'diving' = 'ready';
  let baseX = 0;
  let diveT = 0;
  let diveDuration = 0.7;
  let diveStartX = 0;
  let diveTargetX = 0;
  let divePeakY = 0;
  let diveSide = 0; // -1 left, +1 right (in world X)
  const reactionDelay = 0.14;

  const torsoWorld = new THREE.Vector3();
  const handsWorld = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function applyReadyPose(elapsed: number) {
    const bounce = Math.sin(elapsed * 5.2);
    hips.position.set(0, 0.88 + Math.abs(bounce) * 0.025, 0);
    hips.rotation.set(0, 0, 0);
    torsoPivot.rotation.set(0.22, 0, 0);
    leftLeg.hip.rotation.set(0.32, 0, 0.16);
    leftLeg.knee.rotation.set(-0.55, 0, 0);
    rightLeg.hip.rotation.set(0.32, 0, -0.16);
    rightLeg.knee.rotation.set(-0.55, 0, 0);

    leftArm.shoulder.rotation.set(0.55, 0, 0.45);
    leftArm.elbow.rotation.set(0.85, 0, 0);
    rightArm.shoulder.rotation.set(0.55, 0, -0.45);
    rightArm.elbow.rotation.set(0.85, 0, 0);
  }

  function reset(ballSpot: THREE.Vector3) {
    mode = 'ready';
    diveT = 0;
    // Slight positioning bias toward the near side of the ball's angle
    baseX = THREE.MathUtils.clamp(ballSpot.x * 0.12, -1.0, 1.0);
    group.position.set(baseX, 0, GOAL.z + 0.35);
    group.rotation.set(0, Math.PI, 0);
    applyReadyPose(0);
  }

  function reactToShot(target: THREE.Vector3, shotDuration: number) {
    mode = 'diving';
    diveT = 0;
    diveStartX = group.position.x;

    // Keeper guesses/reads target X, limited by human dive reach & speed
    const clampedX = THREE.MathUtils.clamp(target.x, -GOAL.width / 2 + 0.35, GOAL.width / 2 - 0.35);
    const maxDiveDist = Math.max(0.6, (shotDuration - reactionDelay) * 5.4);
    const dx = clampedX - diveStartX;
    diveTargetX = diveStartX + Math.sign(dx) * Math.min(Math.abs(dx), maxDiveDist);
    diveSide = Math.sign(dx);

    diveDuration = THREE.MathUtils.clamp(shotDuration - reactionDelay, 0.35, 0.85);
    divePeakY = THREE.MathUtils.clamp(target.y - 0.85, 0, 1.15);
  }

  function update(dt: number, elapsed: number) {
    if (mode === 'ready') {
      group.position.x = baseX + Math.sin(elapsed * 2.1) * 0.25;
      group.position.y = 0;
      applyReadyPose(elapsed);
      return;
    }

    diveT += dt;
    if (diveT < reactionDelay) {
      applyReadyPose(elapsed);
      return;
    }

    const u = Math.min(1, (diveT - reactionDelay) / diveDuration);
    const easeOut = 1 - (1 - u) * (1 - u);
    const airArc = Math.sin(u * Math.PI);

    group.position.x = THREE.MathUtils.lerp(diveStartX, diveTargetX, easeOut);
    group.position.y = divePeakY * airArc;

    // Lean and stretch horizontally into the dive (remember keeper faces +Z, so local +X is world -X)
    const localTilt = diveSide * Math.min(1.22, Math.abs(diveTargetX - diveStartX) * 0.55) * easeOut;
    hips.position.y = 0.88;
    hips.rotation.set(0, 0, localTilt);
    torsoPivot.rotation.set(0.15, 0, 0);

    // Outstretched arms & gloves reaching up and outward into the dive
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
    // Torso center & outstretched hands/head reach
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
        // Push ball outward toward pitch (+Z) if hit head-on
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

  return { group, reset, reactToShot, update, collideBall };
}
