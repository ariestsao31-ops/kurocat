import * as THREE from 'three';
import type { CatSkinConfig } from './catSkins';
import type { HandoverActorPose } from './catHandover';
import { resolveFurPalette3D } from './furShader3d';

/**
 * Side-standing quadruped used only for the 3D breed handover.
 *
 * The typist body is a wide seated pear. Yawing two of those into each other
 * is what clipped chests and paws. This mesh is a side silhouette: long in X,
 * standing on four legs, arched when angry. Local +X is the nose.
 * The nose leather is the only point that reaches the center line.
 */

const HEAD_X = 0.5;
const HEAD_R = 0.22;
/** Nose center in the group's local space. This is the only point that may touch the other cat. */
const NOSE_X = 0.74;

interface Limb {
  mesh: THREE.Mesh;
  homeX: number;
  hipY: number;
  phase: number;
}

export class SideStandCat3D {
  readonly group = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly back: THREE.Mesh;
  private readonly head: THREE.Object3D;
  private readonly eye: THREE.Mesh;
  private readonly ears: THREE.Object3D;
  private readonly limbs: Limb[];

  constructor(skin: CatSkinConfig) {
    const p = resolveFurPalette3D(skin, '3d');
    const fur = this.mat(p.fur, 0.82);
    const face = this.mat(p.points > 0.35 ? p.point : p.fur, 0.78);
    const ear = this.mat(p.earOuter || (p.points > 0.35 ? p.point : p.fur), 0.8);
    const inner = this.mat(p.inner, 0.7);
    const eye = this.mat(p.eyeTop, 0.35);
    const pupil = this.mat(p.pupil, 0.4);
    const nose = this.mat(p.nose || (p.isDarkFur ? '#2a2a30' : '#c98492'), 0.45);
    const whisker = this.mat(p.whisker, 0.5);

    const add = (mesh: THREE.Mesh, x: number, y: number, z = 0) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = false;
      this.group.add(mesh);
      return mesh;
    };
    const ball = (material: THREE.Material, r: number, x: number, y: number, z = 0) =>
      add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), material), x, y, z);

    // Hindquarter → arched back → chest. The chest stays well behind the nose.
    ball(fur, 0.15, -0.92, 0.42);
    ball(fur, 0.2, -0.7, 0.52);
    ball(fur, 0.21, -0.48, 0.66);
    this.back = ball(p.stripes > 0.2 ? this.mat(p.dark, 0.82) : fur, 0.22, -0.24, 0.78);
    ball(fur, 0.19, 0.0, 0.66);
    ball(fur, 0.15, 0.22, 0.56);
    if (p.calico > 0.2) ball(this.mat(p.patchA, 0.82), 0.12, -0.5, 0.62, 0.08);

    this.head = new THREE.Group();
    this.head.position.set(HEAD_X, 0.66, 0);
    this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 20, 16), face);
    this.head.add(skull);

    this.ears = new THREE.Group();
    this.head.add(this.ears);
    for (const s of [1, -1] as const) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), ear);
      cone.position.set(-0.02, 0.18, s * 0.07);
      cone.rotation.z = 0.35;
      this.ears.add(cone);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), inner);
      cup.position.set(0.01, 0.16, s * 0.07);
      this.ears.add(cup);
    }

    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), eye);
    this.eye.position.set(0.06, 0.04, 0.16);
    this.head.add(this.eye);
    const pupilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), pupil);
    pupilMesh.position.set(0.03, 0, 0.04);
    this.eye.add(pupilMesh);

    const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), nose);
    noseMesh.position.set(NOSE_X - HEAD_X, -0.02, 0.02);
    this.head.add(noseMesh);

    for (const dy of [-0.02, 0.01, 0.04]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), whisker);
      w.rotation.z = Math.PI / 2;
      w.position.set(0.22, dy - 0.02, 0.1);
      this.head.add(w);
    }

    this.limbs = [];
    const legGeo = new THREE.CylinderGeometry(0.045, 0.055, 1, 8);
    const pawGeo = new THREE.SphereGeometry(0.07, 10, 8);
    const spec: Array<[number, number, number]> = [
      [0.18, 0.5, 0],
      [0.0, 0.52, Math.PI],
      [-0.58, 0.46, 0],
      [-0.82, 0.4, Math.PI],
    ];
    for (const [x, hip, phase] of spec) {
      const mesh = new THREE.Mesh(legGeo, fur);
      const paw = new THREE.Mesh(pawGeo, this.mat(p.paw, 0.7));
      this.group.add(mesh, paw);
      this.limbs.push({ mesh, homeX: x, hipY: hip, phase });
      paw.userData.homeX = x;
    }

    const tailMat = this.mat(p.tailBase || (p.points > 0.35 ? p.point : p.fur), 0.8);
    ball(tailMat, 0.09, -1.05, 0.62);
    ball(tailMat, 0.07, -1.12, 0.88);
    ball(p.tailTip ? this.mat(p.tailTip, 0.8) : tailMat, 0.055, -1.0, 1.08);
  }

  /** Nose world X is the only part allowed to approach the other cat. */
  place(pose: HandoverActorPose): void {
    const face: 1 | -1 = pose.facing >= 0 ? 1 : -1;
    const arch = pose.arch;
    const contact = -face * 0.02;
    const travel = pose.x * 0.95;
    const noseWorld = travel * (1 - arch) + contact * arch;
    const bob = Math.abs(Math.sin(pose.gait * Math.PI * 2)) * 0.04 * pose.walking;
    const size = 1.15;
    this.group.scale.set(face * size, size, size);
    this.group.position.set(noseWorld - face * NOSE_X * size, 0.0 + bob, face === 1 ? -0.02 : 0.02);
    this.group.rotation.y = 0;

    this.back.position.y = 0.78 + arch * 0.16;
    this.head.position.y = 0.64 - arch * 0.08;
    this.head.rotation.z = -0.35 * arch;
    this.ears.rotation.z = -0.45 * pose.glare;
    const slit = 1 - pose.glare * 0.62;
    this.eye.scale.set(1, Math.max(0.28, slit), 1);

    for (const limb of this.limbs) {
      const step = Math.max(0, Math.sin(pose.gait * Math.PI * 2 + limb.phase)) * 0.14 * pose.walking;
      const footY = step;
      const len = Math.max(0.18, limb.hipY - footY);
      limb.mesh.scale.y = len;
      limb.mesh.position.set(limb.homeX, footY + len * 0.5, 0);
    }
    this.plantPaws(pose);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const material of this.materials) material.dispose();
  }

  private plantPaws(pose: HandoverActorPose): void {
    const paws = this.group.children.filter((child) => child.userData.homeX !== undefined) as THREE.Mesh[];
    for (const paw of paws) {
      const homeX = paw.userData.homeX as number;
      const phase = homeX > -0.2 ? 0 : Math.PI;
      const step = Math.max(0, Math.sin(pose.gait * Math.PI * 2 + phase)) * 0.14 * pose.walking;
      paw.position.set(homeX + 0.04, 0.05 + step, 0.02);
    }
  }

  private mat(color: string, _roughness: number): THREE.MeshBasicMaterial {
    // The typist is lit by its own fur shader, not scene lights. Basic color keeps each breed readable.
    const material = new THREE.MeshBasicMaterial({ color });
    this.materials.push(material);
    return material;
  }
}
