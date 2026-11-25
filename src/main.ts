import './style.css';
import * as THREE from 'three';
import { createPitch, GOAL } from './pitch';
import { BALL_RADIUS, createBall } from './ball';
import { createPlayer } from './player';
import { createGoalkeeper } from './goalkeeper';
import { createDefensiveWall } from './wall';
import { createCanvasHud } from './hud';
import { buildShotPlan, collideGoalFrame, createTrajectoryPreview, type ShotPlan } from './trajectory';
import { createStadium } from './stadium';

type Phase = 'aiming' | 'running' | 'flying' | 'result';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const resetBtn = document.querySelector<HTMLButtonElement>('#reset-btn')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x132638);
scene.fog = new THREE.Fog(0x132638, 35, 95);

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 160);

const hemi = new THREE.HemisphereLight(0xaad0ff, 0x1a3320, 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4df, 2.3);
sun.position.set(14, 24, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -24;
sun.shadow.camera.right = 24;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 75;
sun.shadow.bias = -0.0005;
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x9ec9ff, 0.8);
rimLight.position.set(-16, 12, -18);
scene.add(rimLight);

const pitch = createPitch();
scene.add(pitch.group);

createStadium(scene);

const ball = createBall(scene);
const player = createPlayer(scene);
const keeper = createGoalkeeper(scene);
const wall = createDefensiveWall(scene);
const preview = createTrajectoryPreview(scene);
const hud = createCanvasHud();

let phase: Phase = 'aiming';
let goalCount = 0;
let shotCount = 0;
let activePlan: ShotPlan | null = null;
let flightT = 0;
let freePhysics = false;
let scoredThisShot = false;
let hitPostThisShot = false;
let savedByKeeper = false;
let blockedByWall = false;
let resultTimer = 0;
let emotionTriggered = false;

const ballSpot = new THREE.Vector3(0, BALL_RADIUS, 20);
let hasPlacedOnce = false;
const camTargetPos = new THREE.Vector3();
const camLookAt = new THREE.Vector3();
const camSmoothLook = new THREE.Vector3(0, 1.1, 2);

function updateCameraGoals(immediate = false) {
  const dirToGoal = new THREE.Vector3(-ballSpot.x, 0, -ballSpot.z).normalize();
  if (phase === 'aiming' || phase === 'running') {
    camTargetPos.copy(ballSpot).addScaledVector(dirToGoal, -6.2);
    camTargetPos.y = 2.65;
    camLookAt.set(ballSpot.x * 0.35, 1.15, 2.0);
  } else {
    const followZ = Math.max(8.5, ball.pos.z + 5.5);
    camTargetPos.set(ball.pos.x * 0.45, 2.8 + ball.pos.y * 0.25, followZ);
    camLookAt.set(ball.pos.x * 0.65, Math.max(0.8, ball.pos.y * 0.65), Math.min(ball.pos.z, 1.5));
  }

  if (immediate) {
    camera.position.copy(camTargetPos);
    camSmoothLook.copy(camLookAt);
    camera.lookAt(camSmoothLook);
  }
}

function pickNewSpot() {
  for (let tries = 0; tries < 12; tries++) {
    const x = (Math.random() - 0.5) * 20;
    const z = 16.5 + Math.random() * 10.5;
    if (!hasPlacedOnce || Math.hypot(x - ballSpot.x, z - ballSpot.z) >= 5.5) {
      ballSpot.set(x, BALL_RADIUS, z);
      hasPlacedOnce = true;
      return;
    }
  }
  ballSpot.set((Math.random() - 0.5) * 18, BALL_RADIUS, 17 + Math.random() * 9);
  hasPlacedOnce = true;
}

function setupRound() {
  phase = 'aiming';
  activePlan = null;
  flightT = 0;
  freePhysics = false;
  scoredThisShot = false;
  hitPostThisShot = false;
  savedByKeeper = false;
  blockedByWall = false;
  resultTimer = 0;
  emotionTriggered = false;
  preview.clear();

  pickNewSpot();
  ball.reset(ballSpot.x, ballSpot.z);

  const toGoal = new THREE.Vector3(-ballSpot.x, 0, -ballSpot.z).normalize();
  player.placeReady(ball.pos, toGoal);
  keeper.reset(ballSpot);
  const wallCount = wall.setup(ballSpot);

  updateCameraGoals(true);
  hud.setState({
    banner: null,
    hint:
      wallCount > 0
        ? `Topa basıp kaleye doğru falso çiz ve bırak (${wallCount}'lü baraj)`
        : 'Topa basıp kaleye doğru falso çiz ve bırak (baraj yok)',
  });
}

let drawing = false;
const strokeNDC: THREE.Vector2[] = [];
const ndc = new THREE.Vector2();

function toNDC(ev: PointerEvent, out: THREE.Vector2) {
  const rect = canvas.getBoundingClientRect();
  out.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (phase !== 'aiming') return;
  toNDC(ev, ndc);

  const ballScreen = ball.pos.clone().project(camera);
  const distToBall = Math.hypot(ndc.x - ballScreen.x, ndc.y - ballScreen.y);
  if (distToBall > 0.55 && ndc.y > 0.25) return;

  drawing = true;
  strokeNDC.length = 0;
  strokeNDC.push(new THREE.Vector2(ballScreen.x, ballScreen.y));
  strokeNDC.push(ndc.clone());
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drawing || phase !== 'aiming') return;
  toNDC(ev, ndc);
  const prev = strokeNDC[strokeNDC.length - 1];
  if (prev.distanceTo(ndc) > 0.015) {
    strokeNDC.push(ndc.clone());
    activePlan = buildShotPlan(ball.pos, strokeNDC, camera);
    preview.update(activePlan);
  }
});

function finishDraw() {
  if (!drawing) return;
  drawing = false;

  if (phase !== 'aiming') return;
  const plan = buildShotPlan(ball.pos, strokeNDC, camera);
  if (!plan) {
    preview.clear();
    activePlan = null;
    return;
  }

  activePlan = plan;
  preview.update(plan);
  phase = 'running';
  shotCount++;
  hud.setState({ shots: shotCount, hint: 'Şut çekiliyor...' });

  player.startKick(ball.pos, plan.launchDir, plan.curveSign, () => {
    phase = 'flying';
    flightT = 0;
    freePhysics = false;
    preview.clear();

    const tangent = plan.curve.getTangent(0).normalize();
    const speed = plan.curve.getLength() / plan.duration;
    ball.vel.copy(tangent).multiplyScalar(speed);
    ball.spin.set(-tangent.z * 8, -plan.curveSign * 18, tangent.x * 8);

    keeper.reactToShot(plan.target, plan.duration);
    wall.jump();
  });
}

canvas.addEventListener('pointerup', finishDraw);
canvas.addEventListener('pointercancel', () => {
  drawing = false;
  preview.clear();
  activePlan = null;
});

resetBtn.addEventListener('click', setupRound);
window.addEventListener('keydown', (ev) => {
  if (ev.key.toLowerCase() === 'r') setupRound();
});

function resize() {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hud.resize(w, h, dpr);
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);
resize();

setupRound();

const prevPos = new THREE.Vector3();
const clock = new THREE.Clock();

function stepFlight(dt: number) {
  if (!activePlan) return;
  prevPos.copy(ball.pos);

  if (!freePhysics) {
    flightT += dt;
    const u = Math.min(1, flightT / activePlan.duration);
    const nextP = activePlan.curve.getPoint(u);
    const tang = activePlan.curve.getTangent(u);
    const speed = activePlan.curve.getLength() / activePlan.duration;

    ball.pos.copy(nextP);
    ball.vel.copy(tang).normalize().multiplyScalar(speed);

    if (wall.collideBall(ball.pos, ball.vel)) {
      freePhysics = true;
      blockedByWall = true;
    } else if (keeper.collideBall(ball.pos, ball.vel)) {
      freePhysics = true;
      savedByKeeper = true;
    } else if (collideGoalFrame(ball.pos, ball.vel)) {
      freePhysics = true;
      hitPostThisShot = true;
    } else if (u >= 1) {
      freePhysics = true;
    }
  } else {
    ball.vel.y -= 9.81 * dt;
    ball.pos.addScaledVector(ball.vel, dt);

    if (wall.collideBall(ball.pos, ball.vel)) blockedByWall = true;
    if (keeper.collideBall(ball.pos, ball.vel)) savedByKeeper = true;
    if (collideGoalFrame(ball.pos, ball.vel)) hitPostThisShot = true;

    if (ball.pos.y < BALL_RADIUS) {
      ball.pos.y = BALL_RADIUS;
      if (ball.vel.y < -0.5) {
        ball.vel.y = -ball.vel.y * 0.52;
      } else {
        ball.vel.y = 0;
      }
      ball.vel.x *= 0.96;
      ball.vel.z *= 0.96;
      ball.spin.multiplyScalar(0.95);
    }
  }

  const hw = GOAL.width / 2 - BALL_RADIUS * 0.25;
  const insideMouthX = Math.abs(ball.pos.x) < hw;
  const insideMouthY = ball.pos.y < GOAL.height - BALL_RADIUS * 0.25;

  if (!scoredThisShot && prevPos.z >= GOAL.z && ball.pos.z < GOAL.z && insideMouthX && insideMouthY) {
    scoredThisShot = true;
    goalCount++;
    hud.setState({ goals: goalCount, banner: { text: 'GOL!', kind: 'goal' } });
  }

  if (scoredThisShot && ball.pos.z < GOAL.z) {
    const netBackZ = -GOAL.depth * 0.88 + BALL_RADIUS;
    const netSideX = GOAL.width / 2 - BALL_RADIUS;
    const netTopY = GOAL.height - BALL_RADIUS;

    if (ball.pos.z < netBackZ) {
      ball.pos.z = netBackZ;
      pitch.rippleNet(ball.pos, Math.min(1, ball.vel.length() / 22));
      ball.vel.z = -ball.vel.z * 0.15;
      ball.vel.x *= 0.45;
      ball.vel.y *= 0.45;
    }
    if (Math.abs(ball.pos.x) > netSideX) {
      ball.pos.x = Math.sign(ball.pos.x) * netSideX;
      pitch.rippleNet(ball.pos, 0.55);
      ball.vel.x = -ball.vel.x * 0.2;
    }
    if (ball.pos.y > netTopY) {
      ball.pos.y = netTopY;
      pitch.rippleNet(ball.pos, 0.55);
      ball.vel.y = -ball.vel.y * 0.2;
    }
  }

  const pastGoal = ball.pos.z < -0.5 && !scoredThisShot;
  const deflectedAway = (savedByKeeper || blockedByWall) && ball.vel.z > 0.2;
  const stopped = freePhysics && ball.vel.lengthSq() < 0.35 && ball.pos.y <= BALL_RADIUS + 0.05;

  if (scoredThisShot && freePhysics && resultTimer === 0 && (ball.pos.z < -0.4 || ball.vel.lengthSq() < 4)) {
    phase = 'result';
    resultTimer = 0.001;

    if (!emotionTriggered) {
      emotionTriggered = true;
      player.celebrateGoal();
      keeper.reactGoal();
    }
  } else if ((pastGoal || deflectedAway || stopped) && !scoredThisShot && phase === 'flying') {
    phase = 'result';
    resultTimer = 0.001;

    if (!emotionTriggered) {
      emotionTriggered = true;
      player.reactMiss();
      keeper.celebrateSave();
    }

    if (savedByKeeper) {
      hud.setState({ banner: { text: 'KURTARDI!', kind: 'save' } });
    } else if (blockedByWall) {
      hud.setState({ banner: { text: 'BARAJ!', kind: 'wall' } });
    } else if (hitPostThisShot) {
      hud.setState({ banner: { text: 'DİREK!', kind: 'post' } });
    } else {
      hud.setState({ banner: { text: 'AUT!', kind: 'miss' } });
    }
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const elapsed = clock.elapsedTime;

  player.update(dt, elapsed);
  keeper.update(dt, elapsed);
  wall.update(dt, elapsed);
  pitch.update(dt);

  if (phase === 'flying') {
    const substeps = 4;
    for (let i = 0; i < substeps; i++) stepFlight(dt / substeps);
  } else if (phase === 'result') {
    const substeps = 3;
    for (let i = 0; i < substeps; i++) stepFlight(dt / substeps);
    resultTimer += dt;
    if (resultTimer > 2.5) {
      setupRound();
    }
  }

  ball.sync(dt);

  updateCameraGoals(false);
  camera.position.lerp(camTargetPos, 1 - Math.exp(-dt * 4.5));
  camSmoothLook.lerp(camLookAt, 1 - Math.exp(-dt * 6));
  camera.lookAt(camSmoothLook);

  renderer.render(scene, camera);
  hud.render(renderer);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
