import * as THREE from 'three';
import { BALL_RADIUS } from './ball';
import { createHumanoid, type HumanoidRig } from './humanoid';

export interface DefensiveWall {
  group: THREE.Group;
  setup(ballSpot: THREE.Vector3): number;
  jump(): void;
  update(dt: number, elapsed: number): void;
  collideBall(pos: THREE.Vector3, vel: THREE.Vector3): boolean;
}

const MAX_WALL = 4;

export function createDefensiveWall(scene: THREE.Scene): DefensiveWall {
  const group = new THREE.Group();
  scene.add(group);

  const mats = {
    jersey: new THREE.MeshStandardMaterial({ color: 0x1e3a6e, roughness: 0.72 }),
    shorts: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.75 }),
    socks: new THREE.MeshStandardMaterial({ color: 0x1e3a6e, roughness: 0.7 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.4 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd39873, roughness: 0.65 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.85 }),
  };

  const defenders: HumanoidRig[] = [];
  for (let i = 0; i < MAX_WALL; i++) {
    const d = createHumanoid(mats);
    d.group.visible = false;
    group.add(d.group);
    defenders.push(d);
  }

  let activeCount = 0;
  let jumping = false;
  let jumpT = 0;
  const JUMP_DUR = 0.68;

  const toGoal = new THREE.Vector3();
  const side = new THREE.Vector3();
  const wallCenter = new THREE.Vector3();

  function applyWallStance(d: HumanoidRig, jumpHeight: number, elapsed: number, phaseOffset: number) {
    d.group.position.y = jumpHeight;
    const sway = Math.sin(elapsed * 2.3 + phaseOffset) * 0.01;
    d.hips.position.y = 0.72 + sway;   // cartoon rig hips height
    d.torsoPivot.rotation.set(0.08, 0, 0);
    // Arms crossed in front protecting body
    d.leftArm.shoulder.rotation.set(0.55, -0.35, 0.2);
    d.leftArm.elbow.rotation.set(1.05, 0, 0);
    d.rightArm.shoulder.rotation.set(0.55, 0.35, -0.2);
    d.rightArm.elbow.rotation.set(1.05, 0, 0);

    const tuck = Math.min(1, jumpHeight / 0.42);
    d.leftLeg.hip.rotation.set(0.25 * tuck, 0, 0.04);
    d.leftLeg.knee.rotation.set(-0.65 * tuck, 0, 0);
    d.rightLeg.hip.rotation.set(0.25 * tuck, 0, -0.04);
    d.rightLeg.knee.rotation.set(-0.65 * tuck, 0, 0);
  }

  function setup(ballSpot: THREE.Vector3): number {
    jumping = false;
    jumpT = 0;

    // Randomly decide whether a wall appears (~65% chance)
    const hasWall = Math.random() < 0.65;
    activeCount = hasWall ? 2 + Math.floor(Math.random() * 3) : 0;

    toGoal.set(-ballSpot.x, 0, -ballSpot.z);
    const dist = toGoal.length();
    toGoal.normalize();
    side.set(-toGoal.z, 0, toGoal.x);

    const wallDist = Math.min(9.15, dist * 0.54);
    // Offset slightly toward near post so curling around or over is rewarding
    const nearBias = Math.sign(ballSpot.x || 1) * -0.32;
    wallCenter
      .copy(ballSpot)
      .setY(0)
      .addScaledVector(toGoal, wallDist)
      .addScaledVector(side, nearBias);

    const yaw = Math.atan2(toGoal.x, toGoal.z); // face toward ball (opposite toGoal)
    const spacing = 0.52;

    for (let i = 0; i < MAX_WALL; i++) {
      const d = defenders[i];
      if (i < activeCount) {
        const offset = (i - (activeCount - 1) / 2) * spacing;
        d.group.position.copy(wallCenter).addScaledVector(side, offset);
        d.group.rotation.y = yaw;
        d.group.visible = true;
        applyWallStance(d, 0, 0, i * 0.7);
      } else {
        d.group.visible = false;
      }
    }

    return activeCount;
  }

  function jump() {
    if (activeCount > 0) {
      jumping = true;
      jumpT = 0;
    }
  }

  function update(dt: number, elapsed: number) {
    if (activeCount === 0) return;

    let jumpH = 0;
    if (jumping) {
      jumpT += dt;
      const u = Math.min(1, jumpT / JUMP_DUR);
      jumpH = Math.sin(u * Math.PI) * 0.44;
      if (u >= 1) {
        jumping = false;
        jumpH = 0;
      }
    }

    for (let i = 0; i < activeCount; i++) {
      applyWallStance(defenders[i], jumpH, elapsed, i * 0.7);
    }
  }

  function collideBall(pos: THREE.Vector3, vel: THREE.Vector3): boolean {
    if (activeCount === 0) return false;

    const rad = 0.24 + BALL_RADIUS;
    for (let i = 0; i < activeCount; i++) {
      const d = defenders[i];
      const baseY = d.group.position.y;
      const topY = baseY + 1.78;
      if (pos.y > topY + BALL_RADIUS) continue;

      const dx = pos.x - d.group.position.x;
      const dz = pos.z - d.group.position.z;
      const distXZ = Math.hypot(dx, dz);

      if (distXZ > 1e-4 && distXZ < rad) {
        const nx = dx / distXZ;
        const nz = dz / distXZ;
        pos.x = d.group.position.x + nx * (rad + 0.01);
        pos.z = d.group.position.z + nz * (rad + 0.01);

        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= 1.52 * vn * nx;
          vel.z -= 1.52 * vn * nz;
          vel.y = vel.y * 0.65 + 1.5;
          vel.multiplyScalar(0.65);
        }
        return true;
      }
    }
    return false;
  }

  return { group, setup, jump, update, collideBall };
}
