import * as THREE from 'three';

export interface HumanoidMaterials {
  jersey: THREE.Material;
  shorts: THREE.Material;
  socks: THREE.Material;
  boots: THREE.Material;
  skin: THREE.Material;
  hair: THREE.Material;
  gloves?: THREE.Material;
}

export interface HumanoidRig {
  group: THREE.Group;
  hips: THREE.Group;
  torsoPivot: THREE.Group;
  headPivot: THREE.Group;
  leftArm: { shoulder: THREE.Group; elbow: THREE.Group };
  rightArm: { shoulder: THREE.Group; elbow: THREE.Group };
  leftLeg: { hip: THREE.Group; knee: THREE.Group };
  rightLeg: { hip: THREE.Group; knee: THREE.Group };
}

function makeBox(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  return m;
}

/**
 * Builds an articulated ~1.80 m footballer rig facing local -Z.
 */
export function createHumanoid(mats: HumanoidMaterials): HumanoidRig {
  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.y = 0.94;
  group.add(hips);
  hips.add(makeBox(0.32, 0.16, 0.2, mats.shorts));

  const torsoPivot = new THREE.Group();
  torsoPivot.position.y = 0.08;
  hips.add(torsoPivot);

  const torso = makeBox(0.36, 0.46, 0.22, mats.jersey);
  torso.position.y = 0.23;
  torsoPivot.add(torso);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.5;
  torsoPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), mats.skin);
  head.position.y = 0.11;
  head.castShadow = true;
  headPivot.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.121, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.hair,
  );
  hair.position.set(0, 0.125, -0.01);
  hair.rotation.x = -0.15;
  headPivot.add(hair);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.23, 0.42, 0);
    torsoPivot.add(shoulder);

    const sleeve = makeBox(0.11, 0.14, 0.11, mats.jersey);
    sleeve.position.y = -0.06;
    shoulder.add(sleeve);

    const upperArm = makeBox(0.095, 0.18, 0.095, mats.skin);
    upperArm.position.y = -0.2;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);

    const forearm = makeBox(0.082, 0.22, 0.082, mats.skin);
    forearm.position.y = -0.11;
    elbow.add(forearm);

    if (mats.gloves) {
      const glove = makeBox(0.11, 0.12, 0.09, mats.gloves);
      glove.position.y = -0.25;
      elbow.add(glove);
    }

    return { shoulder, elbow };
  };

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, -0.04, 0);
    hips.add(hip);

    const shortLeg = makeBox(0.14, 0.22, 0.15, mats.shorts);
    shortLeg.position.y = -0.1;
    hip.add(shortLeg);

    const thigh = makeBox(0.125, 0.24, 0.13, mats.skin);
    thigh.position.y = -0.28;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);

    const shin = makeBox(0.1, 0.36, 0.105, mats.socks);
    shin.position.y = -0.18;
    knee.add(shin);

    const boot = makeBox(0.105, 0.08, 0.24, mats.boots);
    boot.position.set(0, -0.4, -0.05);
    knee.add(boot);

    return { hip, knee };
  };

  return {
    group,
    hips,
    torsoPivot,
    headPivot,
    leftArm: makeArm(-1),
    rightArm: makeArm(1),
    leftLeg: makeLeg(-1),
    rightLeg: makeLeg(1),
  };
}

