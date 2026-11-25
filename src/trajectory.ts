import * as THREE from 'three';
import { BALL_RADIUS } from './ball';
import { GOAL } from './pitch';

export interface ShotPlan {
  curve: THREE.CatmullRomCurve3;
  target: THREE.Vector3;
  duration: number;
  launchDir: THREE.Vector3;
  curveSign: number;
  onTarget: boolean;
}

const ray = new THREE.Raycaster();

function intersectZPlane(ndc: THREE.Vector2, camera: THREE.Camera, zPlane: number, out: THREE.Vector3): boolean {
  ray.setFromCamera(ndc, camera);
  const { origin, direction } = ray.ray;
  if (Math.abs(direction.z) < 1e-4) return false;
  const t = (zPlane - origin.z) / direction.z;
  if (t <= 0) return false;
  out.copy(origin).addScaledVector(direction, t);
  return true;
}

function sampleStrokeAt(stroke: THREE.Vector2[], frac: number): THREE.Vector2 {
  if (stroke.length === 1) return stroke[0].clone();
  const cum = [0];
  for (let i = 1; i < stroke.length; i++) {
    cum.push(cum[i - 1] + stroke[i].distanceTo(stroke[i - 1]));
  }
  const total = cum[cum.length - 1];
  if (total < 1e-5) return stroke[0].clone();
  const target = frac * total;
  let idx = 0;
  while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
  const span = cum[idx + 1] - cum[idx] || 1;
  const u = (target - cum[idx]) / span;
  return new THREE.Vector2().lerpVectors(stroke[idx], stroke[idx + 1], u);
}

/**
 * Converts a 2D screen stroke (NDC -1..1) drawn from the ball toward goal into a smooth 3D curve.
 */
export function buildShotPlan(
  ballPos: THREE.Vector3,
  stroke: THREE.Vector2[],
  camera: THREE.Camera,
): ShotPlan | null {
  if (stroke.length < 3) return null;
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  const dragLen = first.distanceTo(last);
  if (dragLen < 0.06 || last.y <= first.y + 0.02) return null;

  const target = new THREE.Vector3();
  if (!intersectZPlane(last, camera, GOAL.z, target)) return null;

  target.x = THREE.MathUtils.clamp(target.x, -9.5, 9.5);
  target.y = THREE.MathUtils.clamp(target.y, BALL_RADIUS, 5.2);
  target.z = GOAL.z;

  // Map 1/3 and 2/3 points of the drawn polyline onto intermediate Z planes to capture curl/S-bends
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const z1 = THREE.MathUtils.lerp(ballPos.z, GOAL.z, 0.34);
  const z2 = THREE.MathUtils.lerp(ballPos.z, GOAL.z, 0.68);
  const s1 = sampleStrokeAt(stroke, 0.34);
  const s2 = sampleStrokeAt(stroke, 0.68);

  if (!intersectZPlane(s1, camera, z1, p1)) p1.lerpVectors(ballPos, target, 0.34);
  if (!intersectZPlane(s2, camera, z2, p2)) p2.lerpVectors(ballPos, target, 0.68);

  // Boost lateral bend slightly relative to straight chord so curls feel dramatic and responsive
  const chord1X = THREE.MathUtils.lerp(ballPos.x, target.x, 0.34);
  const chord2X = THREE.MathUtils.lerp(ballPos.x, target.x, 0.68);
  p1.x = THREE.MathUtils.clamp(chord1X + (p1.x - chord1X) * 1.45, -11, 11);
  p2.x = THREE.MathUtils.clamp(chord2X + (p2.x - chord2X) * 1.45, -11, 11);

  // Natural ballistic loft arc between ball height and target height
  const dist = ballPos.distanceTo(target);
  const loft = Math.min(2.2, 0.25 + dist * 0.028 + target.y * 0.22);
  p1.y = Math.max(BALL_RADIUS + 0.05, THREE.MathUtils.lerp(ballPos.y, target.y, 0.34) + loft * 0.88);
  p2.y = Math.max(BALL_RADIUS + 0.05, THREE.MathUtils.lerp(ballPos.y, target.y, 0.68) + loft * 0.88);
  p1.z = z1;
  p2.z = z2;

  const curve = new THREE.CatmullRomCurve3([ballPos.clone(), p1, p2, target.clone()], false, 'catmullrom', 0.5);
  const curveLen = curve.getLength();
  // Realistic shot speed (~24..29 m/s) scaled gently with height/distance
  const speed = THREE.MathUtils.clamp(22 + dist * 0.25, 22, 30);
  const duration = curveLen / speed;

  const launchDir = curve.getTangent(0.02).normalize();
  const curveSign = Math.sign((p1.x - chord1X) + (p2.x - chord2X));
  const hw = GOAL.width / 2 - BALL_RADIUS * 0.5;
  const onTarget = Math.abs(target.x) <= hw && target.y <= GOAL.height - BALL_RADIUS * 0.5;

  return { curve, target, duration, launchDir, curveSign, onTarget };
}

export interface TrajectoryPreview {
  update(plan: ShotPlan | null): void;
  clear(): void;
}

export function createTrajectoryPreview(scene: THREE.Scene): TrajectoryPreview {
  const COUNT = 26;
  const dots: THREE.Mesh[] = [];
  const dotGeo = new THREE.SphereGeometry(0.075, 12, 10);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0xffe45e,
    transparent: true,
    opacity: 0.9,
  });

  const group = new THREE.Group();
  scene.add(group);
  for (let i = 0; i < COUNT; i++) {
    const m = new THREE.Mesh(dotGeo, dotMat);
    m.visible = false;
    group.add(m);
    dots.push(m);
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.26, 28),
    new THREE.MeshBasicMaterial({ color: 0xffe45e, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ring.visible = false;
  group.add(ring);

  function update(plan: ShotPlan | null) {
    if (!plan) {
      clear();
      return;
    }
    const col = plan.onTarget ? 0x7dff9b : 0xffe45e;
    dotMat.color.setHex(col);
    (ring.material as THREE.MeshBasicMaterial).color.setHex(col);

    for (let i = 0; i < COUNT; i++) {
      const u = (i + 1) / COUNT;
      const p = plan.curve.getPoint(u);
      const m = dots[i];
      m.position.copy(p);
      const s = 0.55 + 0.55 * Math.sin(u * Math.PI);
      m.scale.setScalar(s);
      m.visible = true;
    }

    ring.position.copy(plan.target);
    ring.position.z = GOAL.z + 0.02;
    ring.visible = true;
  }

  function clear() {
    for (const d of dots) d.visible = false;
    ring.visible = false;
  }

  return { update, clear };
}

/**
 * Checks sphere collision against the two goalposts and crossbar.
 * Returns true if a bounce occurred and reflects `vel` + pushes `pos` out.
 */
export function collideGoalFrame(pos: THREE.Vector3, vel: THREE.Vector3): boolean {
  const hw = GOAL.width / 2;
  const h = GOAL.height;
  const minDist = BALL_RADIUS + GOAL.postRadius;
  let hit = false;

  // Left & Right vertical posts: x = ±hw, z = 0, y in [0, h]
  for (const px of [-hw, hw]) {
    if (pos.y <= h + BALL_RADIUS) {
      const dx = pos.x - px;
      const dz = pos.z - GOAL.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < minDist) {
        const nx = dx / d;
        const nz = dz / d;
        pos.x = px + nx * minDist;
        pos.z = GOAL.z + nz * minDist;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= 1.68 * vn * nx;
          vel.z -= 1.68 * vn * nz;
          vel.y *= 0.88;
          hit = true;
        }
      }
    }
  }

  // Crossbar: y = h, z = 0, x in [-hw, hw]
  if (Math.abs(pos.x) <= hw + GOAL.postRadius) {
    const dy = pos.y - h;
    const dz = pos.z - GOAL.z;
    const d = Math.hypot(dy, dz);
    if (d > 1e-5 && d < minDist) {
      const ny = dy / d;
      const nz = dz / d;
      pos.y = h + ny * minDist;
      pos.z = GOAL.z + nz * minDist;
      const vn = vel.y * ny + vel.z * nz;
      if (vn < 0) {
        vel.y -= 1.68 * vn * ny;
        vel.z -= 1.68 * vn * nz;
        vel.x *= 0.88;
        hit = true;
      }
    }
  }

  return hit;
}

