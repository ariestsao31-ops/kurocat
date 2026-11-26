/**
 * Two-cat handover when the active skin changes.
 *
 * The official cats are front-facing typists, so the motion stays inside that rig:
 * the incoming cat walks in from the left, both rise into a nose-to-nose standoff
 * (arched back, lowered head, ears back, narrowed eyes), the outgoing cat walks off
 * to the right, and the incoming cat takes the typist seat. A low yowl plays only
 * during the standoff. Re-selecting the same cat never starts this timeline.
 */

export interface HandoverActorPose {
  /** Horizontal offset from the typist seat. Negative is left, positive is right. */
  x: number;
  /** 0 = seated typist, 1 = standing. */
  stand: number;
  /** 0 = relaxed, 1 = arched standoff. */
  arch: number;
  /** -1 faces left, 0 faces the viewer, +1 faces right. */
  facing: number;
  /** Walk-cycle phase in revolutions. */
  gait: number;
  /** 0 = planted, 1 = stepping. */
  walking: number;
  /** Ears pinned and eyes narrowed. */
  glare: number;
}

export interface HandoverFrame {
  incoming: HandoverActorPose;
  outgoing: HandoverActorPose;
  /** Low yowl, only while the standoff is actually held. */
  growl: boolean;
  done: boolean;
}

/** World-unit multiplier for the 3D cat root. */
export const HANDOVER_X_3D = 1.02;
/** Logical-pixel multiplier for the 2D canvas. */
export const HANDOVER_X_2D = 148;

const ENTER_END = 1.25;
const STANDOFF_END = 4.45;
const LEAVE_END = 5.7;
const SEAT_END = 7.25;
const SIT_END = 8.25;
export const HANDOVER_SECONDS = 8.45;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(start: number, end: number, t: number): number {
  if (end <= start) return t >= end ? 1 : 0;
  const u = clamp01((t - start) / (end - start));
  return u * u * (3 - 2 * u);
}

function actor(
  x: number,
  stand: number,
  arch: number,
  facing: number,
  gait: number,
  walking: number,
): HandoverActorPose {
  return {
    x,
    stand: clamp01(stand),
    arch: clamp01(arch),
    facing: Math.max(-1, Math.min(1, facing)),
    gait,
    walking: clamp01(walking),
    glare: clamp01(arch),
  };
}

export function handoverInvolvesDafeiyu(fromId: string, toId: string): boolean {
  return fromId === 'dafeiyu' || toId === 'dafeiyu';
}

/**
 * Sample the handover at `elapsed` seconds from the moment the skin change was requested.
 * The outgoing cat is whoever was on the typist seat; the incoming cat is the new skin.
 */
export function sampleHandover(elapsed: number): HandoverFrame {
  const t = Math.max(0, elapsed);
  const gait = t * 2.15;
  const arch = smooth(1.15, 1.48, t) * (1 - smooth(4.22, 4.55, t));

  const enter = smooth(0.04, ENTER_END, t);
  const stepOut = smooth(0.18, 1.02, t);
  const leave = smooth(4.48, LEAVE_END, t);
  const toSeat = smooth(5.68, SEAT_END, t);
  const sit = smooth(SEAT_END, SIT_END, t);

  let inX = lerp(-2.15, -0.58, enter);
  if (t >= ENTER_END && t < 5.68) inX = -0.58;
  else if (t >= 5.68) inX = lerp(-0.58, 0, toSeat);

  let outX = lerp(0, 0.46, stepOut);
  if (t >= 1.02 && t < 4.48) outX = 0.46;
  else if (t >= 4.48) outX = lerp(0.46, 2.25, leave);

  const inStand = t < SEAT_END ? 1 : 1 - sit;
  const outStand = t < 1.02 ? stepOut : 1;

  let inFacing = 1;
  if (t >= SEAT_END) inFacing = lerp(1, 0, sit);

  let outFacing = lerp(0, -1, stepOut);
  if (t >= 1.02 && t < 4.48) outFacing = -1;
  else if (t >= 4.48) outFacing = lerp(-1, 1, smooth(4.48, 5.12, t));

  const inWalk =
    (1 - smooth(ENTER_END - 0.18, ENTER_END + 0.02, t)) +
    smooth(5.55, 5.82, t) * (1 - smooth(SEAT_END - 0.16, SEAT_END, t));
  const outWalk = smooth(4.4, 4.68, t) * (1 - smooth(LEAVE_END - 0.12, LEAVE_END + 0.04, t));

  return {
    incoming: actor(inX, inStand, arch, inFacing, gait, Math.min(1, inWalk)),
    outgoing: actor(outX, outStand, arch, outFacing, gait + 0.5, outWalk),
    growl: arch > 0.42,
    done: t >= HANDOVER_SECONDS,
  };
}
