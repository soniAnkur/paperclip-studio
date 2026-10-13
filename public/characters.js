// Role characters for Paper Machine Studio. One ceramic family, a kit per role.
// Everything moves in code (no keyframes), so motion stays smooth at any frame rate.
//   makeCharacter(role, accent) -> { root, setState(s), gesture(name), update(dt, t) }
import * as THREE from "three";

const M = {
  ceramic: () => new THREE.MeshPhysicalMaterial({ color: 0xf7f7f9, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.25 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
  color: (c, r = 0.35) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  metal: (c = 0xc9ccd2) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.9, roughness: 0.25 }),
  glow: (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true }),
};
const G = {
  sphere: (r, ws = 48, hs = 32) => new THREE.SphereGeometry(r, ws, hs),
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 10, 32),
  cyl: (rt, rb, h, s = 40) => new THREE.CylinderGeometry(rt, rb, h, s),
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  torus: (r, t, s = 64) => new THREE.TorusGeometry(r, t, 16, s),
};
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent?.add(m);
  return m;
}
const damp = (cur, target, k, dt) => cur + (target - cur) * Math.min(1, dt * k);
const ease = (x) => x * x * (3 - 2 * x);

// ------------------------------------------------------------------ humanoid base
function humanoid(accent) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything above the feet; tilts and breathes
  root.add(body);
  const torso = mesh(G.cap(0.33, 0.5), M.ceramic(), 0, 0.86, 0, body);
  torso.scale.set(1, 1, 0.9);
  mesh(G.torus(0.335, 0.03), M.color(accent), 0, 0.84, 0, body).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) mesh(G.sphere(0.1), M.ceramic(), s * 0.14, 0.12, 0.04, root).scale.set(1, 0.6, 1.3);

  const neck = new THREE.Group();
  neck.position.y = 1.42;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.28;
  neck.add(head);
  mesh(G.sphere(0.29, 64, 48), M.ceramic(), 0, 0, 0, head);
  const visor = mesh(new THREE.SphereGeometry(0.295, 64, 48, Math.PI * 0.16, Math.PI * 0.68, Math.PI * 0.3, Math.PI * 0.36), M.glass(), 0, 0, 0, head);
  visor.castShadow = false;
  const eyeMat = M.glow(0xeaf6ff);
  const eyes = [-1, 1].map((s) => mesh(G.cap(0.03, 0.06), eyeMat, s * 0.09, 0.01, 0.282, head));

  const arms = {};
  for (const [side, s] of [["L", 1], ["R", -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.4, 1.22, 0);
    body.add(pivot);
    mesh(G.cap(0.075, 0.32), M.ceramic(), 0, -0.22, 0, pivot);
    const hand = new THREE.Group();
    hand.position.y = -0.45;
    pivot.add(hand);
    mesh(G.sphere(0.085), M.color(accent), 0, 0, 0, hand);
    pivot.rotation.z = s * 0.12;
    arms[side] = { pivot, hand, rest: { x: 0, z: s * 0.12 } };
  }
  return { root, body, torso, neck, head, eyes, arms };
}

// Shared state machine: free / working / waiting, plus one-off gestures.
function rig(parts, opts = {}) {
  const w = { work: 0, wait: 0 };
  let state = "free", gesture = null, gt = 0, blinkAt = 2 + Math.random() * 3;
  const phase = Math.random() * 10;
  const api = {
    root: parts.root,
    setState(s) {
      state = s;
    },
    gesture(name) {
      gesture = name;
      gt = 0;
    },
    update(dt, t) {
      t += phase;
      w.work = damp(w.work, state === "working" ? 1 : 0, 2.6, dt);
      w.wait = damp(w.wait, state === "waiting" || state === "paused" ? 1 : 0, 2.2, dt);
      const { body, neck, head, eyes, arms } = parts;
      // breathe, settle, slump
      const breath = Math.sin(t * 1.6) * 0.012 * (1 - w.wait * 0.5);
      if (body) {
        body.scale.set(1 + breath * 0.4, 1 + breath, 1 + breath * 0.4);
        body.rotation.x = w.wait * 0.12;
        body.position.y = -w.wait * 0.04;
      }
      if (neck) {
        neck.rotation.x = w.wait * 0.32 + w.work * 0.12;
        neck.rotation.y = Math.sin(t * 0.45) * 0.28 * (1 - w.work) * (1 - w.wait);
      }
      // arms relax to rest, role action layers on top
      if (arms)
        for (const a of Object.values(arms)) {
          a.pivot.rotation.x = damp(a.pivot.rotation.x, a.rest.x + Math.sin(t * 1.6) * 0.03, 4, dt);
          a.pivot.rotation.z = damp(a.pivot.rotation.z, a.rest.z * (1 - w.wait * 0.5), 4, dt);
        }
      opts.work?.(dt, t, w, parts);
      // gestures
      if (gesture) {
        gt += dt;
        const k = Math.sin(Math.min(1, gt / 1.8) * Math.PI); // in-out envelope
        if (gesture === "wave" && arms) {
          arms.R.pivot.rotation.z = -0.12 - k * 2.5;
          arms.R.pivot.rotation.x = -k * 0.2 + Math.sin(gt * 11) * 0.22 * k;
        }
        if (gesture === "nod" && neck) neck.rotation.x += Math.sin(gt * 9) * 0.18 * k;
        if (gesture === "cheer" && arms) {
          arms.R.pivot.rotation.z = -0.12 - k * 2.7;
          arms.L.pivot.rotation.z = 0.12 + k * 2.7;
          parts.root.position.y = Math.abs(Math.sin(gt * 6)) * 0.12 * k;
        }
        if (gt > 1.8) (gesture = null), (parts.root.position.y = 0);
      }
      // blink, half-lidded when waiting
      if (eyes) {
        blinkAt -= dt;
        const blink = blinkAt < 0 ? Math.max(0.08, Math.abs(blinkAt + 0.07) / 0.07) : 1;
        if (blinkAt < -0.14) blinkAt = 2.5 + Math.random() * 3.5;
        for (const e of eyes) e.scale.y = Math.min(blink, 1 - w.wait * 0.55);
      }
    },
  };
  return api;
}

// ------------------------------------------------------------------ roles
function builder(accent) {
  const p = humanoid(accent);
  // hard hat
  const hat = new THREE.Group();
  hat.position.y = 0.06;
  p.head.add(hat);
  const yellow = M.color(0xffc21a, 0.3);
  mesh(new THREE.SphereGeometry(0.315, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), yellow, 0, 0.02, 0, hat);
  mesh(G.cyl(0.4, 0.4, 0.025, 48), yellow, 0, 0.02, 0.05, hat);
  mesh(G.box(0.05, 0.08, 0.6), yellow, 0, 0.29, 0, hat);
  // tool belt with pouches
  mesh(G.torus(0.345, 0.045), M.color(0x8a5a2b, 0.6), 0, 0.62, 0, p.body).rotation.x = Math.PI / 2;
  for (const [x, z] of [[-0.24, 0.24], [0.26, 0.2], [0, 0.33]]) mesh(G.box(0.12, 0.13, 0.08), M.color(0x6e4520, 0.6), x, 0.56, z, p.body).lookAt(0, 0.56, 0);
  // hammer in right hand
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.02, 0.05);
  hammer.rotation.x = Math.PI / 2;
  p.arms.R.hand.add(hammer);
  mesh(G.cyl(0.022, 0.022, 0.42), M.color(0x9c6b3c, 0.5), 0, 0.12, 0, hammer);
  mesh(G.box(0.2, 0.08, 0.08), M.metal(0x7d8188), 0, 0.33, 0, hammer);
  // little workbench block and sparks
  const block = mesh(G.box(0.34, 0.16, 0.24), M.metal(0x9aa0a8), -0.32, 0.24, 0.52, p.root);
  const sparkMat = M.glow(0xffb340);
  const sparks = Array.from({ length: 8 }, () => mesh(G.sphere(0.018, 8, 8), sparkMat, 0, -10, 0, p.root));
  let lastHit = 0;
  return rig(p, {
    work(dt, t, w) {
      const a = p.arms.R;
      // hammer: slow lift, quick strike
      const c = (t * 1.25) % 1;
      const swing = c < 0.7 ? ease(c / 0.7) : 1 - ease((c - 0.7) / 0.3);
      a.pivot.rotation.x = damp(a.pivot.rotation.x, (-0.5 - swing * 1.5) * w.work, 12, dt);
      a.pivot.rotation.z = damp(a.pivot.rotation.z, -0.12 + 0.35 * w.work, 6, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, 0.35 * w.work, 3, dt);
      block.visible = w.work > 0.05;
      block.scale.setScalar(Math.max(0.001, w.work));
      const hit = c > 0.97 || c < 0.02;
      if (hit && t - lastHit > 0.4 && w.work > 0.6) {
        lastHit = t;
        sparks.forEach((s, i) => {
          s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random() * 1.2, (Math.random() - 0.2) * 1.2);
          s.position.set(-0.32, 0.34, 0.52);
          s.userData.life = 0.45 + i * 0.02;
        });
      }
      for (const s of sparks) {
        if (!(s.userData.life > 0)) {
          s.visible = false;
          continue;
        }
        s.visible = true;
        s.userData.life -= dt;
        s.userData.v.y -= 6 * dt;
        s.position.addScaledVector(s.userData.v, dt);
      }
      sparkMat.opacity = 0.9;
    },
  });
}

function researcher(accent) {
  const p = humanoid(accent);
  // big expedition backpack with antenna
  const pack = new THREE.Group();
  pack.position.set(0, 0.95, -0.36);
  p.body.add(pack);
  mesh(G.cap(0.26, 0.36), M.color(0x4b4fd1, 0.45), 0, 0, 0, pack).scale.set(1.1, 1, 0.7);
  mesh(G.box(0.42, 0.14, 0.2), M.color(0x3a3db0, 0.45), 0, -0.34, 0.02, pack);
  mesh(G.cyl(0.07, 0.07, 0.5, 24), M.color(0xe8e1cf, 0.6), 0, 0.42, -0.02, pack).rotation.z = Math.PI / 2; // bedroll
  mesh(G.cyl(0.008, 0.008, 0.5, 8), M.metal(), 0.18, 0.6, 0, pack);
  const tip = mesh(G.sphere(0.03, 12, 12), M.glow(0x30d158), 0.18, 0.86, 0, pack);
  for (const s of [-1, 1]) mesh(G.cap(0.07, 0.14), M.color(0x3a3db0, 0.45), s * 0.31, -0.05, 0.05, pack);
  // goggles on the forehead
  for (const s of [-1, 1]) {
    const g = mesh(G.torus(0.065, 0.018, 32), M.metal(0xb08d57), s * 0.09, 0.17, 0.235, p.head);
    g.rotation.x = -0.5;
    mesh(G.cyl(0.06, 0.06, 0.01, 24), M.glow(0x9fd7ff), s * 0.09, 0.17, 0.235, p.head).rotation.x = Math.PI / 2 - 0.5;
  }
  // magnifier (right) and glowing flask (left)
  const mag = new THREE.Group();
  mag.position.set(0, -0.02, 0.06);
  p.arms.R.hand.add(mag);
  mesh(G.cyl(0.02, 0.02, 0.2), M.color(0x2b2b2e), 0, -0.1, 0, mag);
  const ring = mesh(G.torus(0.11, 0.018, 48), M.metal(0xb08d57), 0, 0.08, 0, mag);
  mesh(G.cyl(0.1, 0.1, 0.01, 32), new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1 }), 0, 0.08, 0, mag).rotation.x = Math.PI / 2;
  const flask = new THREE.Group();
  p.arms.L.hand.add(flask);
  flask.position.set(0, -0.08, 0.04);
  mesh(G.sphere(0.085), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1 }), 0, 0, 0, flask);
  const liquid = mesh(G.sphere(0.07), M.glow(0x30d158), 0, -0.01, 0, flask);
  liquid.material.opacity = 0.8;
  mesh(G.cyl(0.025, 0.03, 0.09), M.glass(), 0, 0.1, 0, flask);
  // utility pouches on the belt
  for (const x of [-0.25, 0.25]) mesh(G.box(0.1, 0.12, 0.07), M.color(0x3a3db0, 0.45), x, 0.6, 0.24, p.body);
  return rig(p, {
    work(dt, t, w) {
      const a = p.arms.R;
      // sweep the magnifier across an invisible page, head following
      const sweep = Math.sin(t * 1.4);
      a.pivot.rotation.x = damp(a.pivot.rotation.x, -1.15 * w.work, 5, dt);
      a.pivot.rotation.z = damp(a.pivot.rotation.z, -0.12 + (0.25 + sweep * 0.3) * w.work, 5, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, -sweep * 0.25 * w.work, 4, dt);
      p.arms.L.pivot.rotation.x = damp(p.arms.L.pivot.rotation.x, -0.5 * w.work, 4, dt);
      ring.rotation.y = 0;
      liquid.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3)) * (0.3 + 0.7 * w.work);
      tip.material.opacity = (Math.sin(t * 4) > 0 ? 1 : 0.25) * (0.4 + 0.6 * w.work);
    },
  });
}

function scout(accent) {
  // A round, all-seeing drone: eyes all the way around, radar sweep on the floor.
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.15;
  root.add(body);
  mesh(G.sphere(0.38, 64, 48), M.ceramic(), 0, 0, 0, body);
  const band = mesh(G.cyl(0.392, 0.392, 0.15, 64), M.glass(), 0, 0.02, 0, body);
  band.castShadow = false;
  const eyeMat = M.glow(0x9fe7ff);
  const eyes = new THREE.Group();
  body.add(eyes);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    mesh(G.cap(0.02, 0.04), eyeMat, Math.sin(a) * 0.395, 0.02, Math.cos(a) * 0.395, eyes);
  }
  const ringA = new THREE.Group();
  body.add(ringA);
  mesh(G.torus(0.6, 0.035, 96), M.color(accent, 0.25), 0, 0, 0, ringA).rotation.x = Math.PI / 2;
  const ringB = new THREE.Group();
  body.add(ringB);
  const rb = mesh(G.torus(0.52, 0.018, 96), M.metal(), 0, 0, 0, ringB);
  rb.rotation.y = Math.PI / 2;
  mesh(G.cyl(0.012, 0.012, 0.3, 8), M.metal(), 0, 0.5, 0, body);
  const beacon = mesh(G.sphere(0.04, 16, 16), M.glow(accent), 0, 0.67, 0, body);
  // radar sweep on the pedestal
  const sweepMat = M.glow(accent);
  sweepMat.opacity = 0;
  sweepMat.side = THREE.DoubleSide;
  sweepMat.depthWrite = false;
  const sweep = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48, 0, Math.PI / 3), sweepMat);
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.y = 0.17;
  root.add(sweep);
  const w = { work: 0, wait: 0 };
  let state = "free", gest = null, gt = 0;
  return {
    root,
    setState: (s) => (state = s),
    gesture: (g) => ((gest = g), (gt = 0)),
    update(dt, t) {
      w.work = damp(w.work, state === "working" ? 1 : 0, 2.4, dt);
      w.wait = damp(w.wait, state === "waiting" ? 1 : 0, 2, dt);
      body.position.y = 1.15 - w.wait * 0.3 + Math.sin(t * 1.3) * 0.06 * (1 - w.wait * 0.7);
      ringA.rotation.z = Math.sin(t * 0.5) * 0.25;
      ringA.rotation.y += dt * (0.3 + w.work * 2.2);
      ringB.rotation.x += dt * (0.2 + w.work * 1.4);
      eyes.rotation.y += dt * (0.15 + w.work * 1.2);
      eyeMat.opacity = 0.35 + 0.65 * (1 - w.wait * 0.7);
      sweep.rotation.z -= dt * 2.4;
      sweepMat.opacity = 0.22 * w.work;
      beacon.material.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3));
      if (gest) {
        gt += dt;
        const k = Math.sin(Math.min(1, gt / 1.6) * Math.PI);
        body.rotation.z = Math.sin(gt * 8) * 0.25 * k; // a happy wobble
        body.position.y += k * 0.15;
        if (gt > 1.6) gest = null;
      } else body.rotation.z = damp(body.rotation.z, 0, 4, dt);
    },
  };
}

function guardian(accent) {
  const p = humanoid(accent);
  const navy = M.color(0x1f3a7a, 0.55);
  const silver = M.metal(0xd5d8de);
  // helmet with a crest
  const helm = mesh(new THREE.SphereGeometry(0.315, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.42), silver, 0, 0.02, 0, p.head);
  const crest = mesh(G.box(0.04, 0.16, 0.42), M.color(0xd7263d, 0.5), 0, 0.3, -0.03, p.head);
  // pauldrons
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), silver, s * 0.4, 1.27, 0, p.body);
  // cape (open half-cylinder behind the body)
  const capeGeo = new THREE.CylinderGeometry(0.36, 0.52, 1.05, 32, 8, true, Math.PI * 0.62, Math.PI * 0.76);
  const cape = mesh(capeGeo, new THREE.MeshPhysicalMaterial({ color: 0x1f3a7a, roughness: 0.6, sheen: 1, sheenColor: 0x6b8cff, side: THREE.DoubleSide }), 0, 0.8, -0.02, p.body);
  const capeRest = capeGeo.attributes.position.array.slice();
  // tabard
  mesh(G.box(0.3, 0.42, 0.04), navy, 0, 0.78, 0.3, p.body);
  mesh(G.box(0.05, 0.22, 0.045), M.color(0xf0c419, 0.3), 0, 0.82, 0.31, p.body);
  mesh(G.box(0.16, 0.05, 0.045), M.color(0xf0c419, 0.3), 0, 0.86, 0.31, p.body);
  // shield on the left arm
  const shield = new THREE.Group();
  shield.position.set(0.06, 0.08, 0.12);
  shield.rotation.y = 0.35;
  p.arms.L.hand.add(shield);
  const face = mesh(G.cyl(0.26, 0.26, 0.04, 48), navy, 0, 0, 0, shield);
  face.rotation.x = Math.PI / 2;
  mesh(G.torus(0.26, 0.022, 48), M.metal(0xf0c419), 0, 0, 0.0, shield);
  const emblemMat = M.glow(0xf0c419);
  emblemMat.opacity = 0.85;
  const check = new THREE.Group();
  check.position.z = 0.03;
  shield.add(check);
  mesh(G.box(0.05, 0.12, 0.01), emblemMat, -0.05, -0.02, 0, check).rotation.z = 0.7;
  mesh(G.box(0.05, 0.22, 0.01), emblemMat, 0.04, 0.03, 0, check).rotation.z = -0.55;
  return rig(p, {
    work(dt, t, w) {
      // raise the shield and scan
      const L = p.arms.L;
      L.pivot.rotation.x = damp(L.pivot.rotation.x, -1.25 * w.work, 4, dt);
      L.pivot.rotation.z = damp(L.pivot.rotation.z, 0.12 - 0.3 * w.work, 4, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, Math.sin(t * 0.8) * 0.45 * w.work, 3, dt);
      emblemMat.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.5)) * (0.4 + 0.6 * w.work);
      // cape sway
      const pos = capeGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = capeRest[i * 3 + 1];
        const fall = (0.525 - y) / 1.05;
        pos.array[i * 3 + 2] = capeRest[i * 3 + 2] - fall * fall * (0.08 + 0.05 * Math.sin(t * 1.7 + capeRest[i * 3] * 3));
      }
      pos.needsUpdate = true;
    },
  });
}

function principal(accent) {
  const p = humanoid(accent);
  // headset
  const hs = mesh(new THREE.TorusGeometry(0.31, 0.018, 12, 48, Math.PI), M.color(0x2b2b2e), 0, 0.02, 0, p.head);
  hs.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) mesh(G.cyl(0.07, 0.07, 0.05, 24), M.color(0x2b2b2e), s * 0.3, 0.02, 0, p.head).rotation.z = Math.PI / 2;
  const boom = mesh(G.cyl(0.01, 0.01, 0.24, 8), M.color(0x2b2b2e), 0.24, -0.1, 0.12, p.head);
  boom.rotation.set(1.2, 0, 0.5);
  mesh(G.sphere(0.025, 12, 12), M.color(accent), 0.17, -0.15, 0.24, p.head);
  // lanyard badge
  mesh(G.box(0.11, 0.15, 0.015), M.color(accent, 0.3), 0, 1.0, 0.32, p.body);
  // clipboard
  const board = new THREE.Group();
  board.position.set(0, 0.05, 0.12);
  board.rotation.x = -0.4;
  p.arms.L.hand.add(board);
  mesh(G.box(0.26, 0.34, 0.015), M.color(0x9c6b3c, 0.5), 0, 0, 0, board);
  mesh(G.box(0.22, 0.28, 0.005), M.ceramic(), 0, -0.02, 0.01, board);
  const ticks = [0, 1, 2].map((i) => mesh(G.box(0.03, 0.03, 0.006), M.glow(0x30d158), -0.07, 0.06 - i * 0.07, 0.016, board));
  return rig(p, {
    work(dt, t, w) {
      p.arms.L.pivot.rotation.x = damp(p.arms.L.pivot.rotation.x, -1.1 * w.work - 0.2, 4, dt);
      p.arms.L.pivot.rotation.z = damp(p.arms.L.pivot.rotation.z, -0.25 * w.work + 0.12, 4, dt);
      p.arms.R.pivot.rotation.x = damp(p.arms.R.pivot.rotation.x, (-0.9 + Math.sin(t * 6) * 0.06) * w.work, 5, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, 0.2 * w.work, 3, dt);
      ticks.forEach((tk, i) => tk.scale.setScalar(w.work > 0.5 && (t * 0.6) % 3 > i ? 1 : 0.001));
    },
  });
}

function architect(accent) {
  const p = humanoid(accent);
  // gold trim (Opus) and rolled blueprints under the arm
  mesh(G.torus(0.3, 0.02), M.metal(0xd4a72c), 0, 0.1, 0, p.head).rotation.x = Math.PI / 2;
  const roll = mesh(G.cyl(0.055, 0.055, 0.55, 24), M.color(0x2f6fd6, 0.5), 0.36, 0.95, 0.12, p.body);
  roll.rotation.set(0.3, 0, 1.25);
  // holographic structure hovering above the right hand
  const holo = new THREE.Group();
  holo.position.set(-0.55, 1.55, 0.35);
  p.root.add(holo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5ac8fa, transparent: true, opacity: 0 });
  const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.34, 0.34, 0.34)), lineMat);
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16)), lineMat);
  holo.add(cube, inner);
  const glowMat = M.glow(0x5ac8fa);
  const core = mesh(G.sphere(0.04, 16, 16), glowMat, 0, 0, 0, holo);
  return rig(p, {
    work(dt, t, w) {
      const R = p.arms.R;
      R.pivot.rotation.x = damp(R.pivot.rotation.x, -1.3 * w.work, 4, dt);
      R.pivot.rotation.z = damp(R.pivot.rotation.z, -0.12 - 0.35 * w.work, 4, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, -0.45 * w.work, 3, dt);
      p.neck.rotation.x += -0.15 * w.work;
      holo.rotation.y += dt * 0.8;
      holo.rotation.x = Math.sin(t * 0.7) * 0.3;
      holo.position.y = 1.55 + Math.sin(t * 1.4) * 0.04;
      lineMat.opacity = 0.85 * w.work;
      glowMat.opacity = w.work;
      holo.scale.setScalar(0.4 + 0.6 * w.work);
      holo.visible = w.work > 0.02;
    },
  });
}

function writer(accent) {
  const p = humanoid(accent);
  // beret
  const beret = mesh(G.sphere(0.27, 32, 16), M.color(0x7a3fa0, 0.6), 0.04, 0.2, -0.02, p.head);
  beret.scale.set(1.15, 0.35, 1.1);
  beret.rotation.z = -0.2;
  mesh(G.cyl(0.015, 0.015, 0.06, 8), M.color(0x7a3fa0), 0.04, 0.3, 0, p.head);
  // scarf
  mesh(G.torus(0.2, 0.06, 48), M.color(accent, 0.6), 0, 1.4, 0, p.body).rotation.x = Math.PI / 2;
  // quill
  const quill = new THREE.Group();
  quill.position.set(0, 0, 0.05);
  quill.rotation.x = 0.6;
  p.arms.R.hand.add(quill);
  mesh(G.cyl(0.006, 0.012, 0.36, 8), M.color(0x2b2b2e), 0, 0.12, 0, quill);
  const feather = mesh(G.cap(0.035, 0.24), M.color(0xfafafa, 0.6), 0, 0.26, 0, quill);
  feather.scale.set(1, 1, 0.25);
  // floating page that fills with lines while working
  const page = new THREE.Group();
  page.position.set(-0.05, 0.95, 0.62);
  page.rotation.x = -1.0;
  p.root.add(page);
  mesh(G.box(0.42, 0.56, 0.008), M.ceramic(), 0, 0, 0, page);
  const lines = Array.from({ length: 7 }, (_, i) => mesh(G.box(0.32, 0.018, 0.004), M.color(0x8e8e93), 0, 0.2 - i * 0.065, 0.006, page));
  return rig(p, {
    work(dt, t, w) {
      const R = p.arms.R;
      R.pivot.rotation.x = damp(R.pivot.rotation.x, (-0.95 + Math.sin(t * 7) * 0.05) * w.work, 6, dt);
      R.pivot.rotation.z = damp(R.pivot.rotation.z, -0.12 + (0.35 + Math.cos(t * 7) * 0.05) * w.work, 6, dt);
      p.neck.rotation.x += 0.18 * w.work;
      page.visible = w.work > 0.02;
      page.scale.setScalar(Math.max(0.001, w.work));
      const fill = (t * 0.5) % (lines.length + 2);
      lines.forEach((l, i) => (l.scale.x = Math.max(0.001, Math.min(1, fill - i))));
    },
  });
}

function critic(accent) {
  const p = humanoid(accent);
  // round glasses over the visor
  for (const s of [-1, 1]) mesh(G.torus(0.075, 0.012, 32), M.color(0x2b2b2e), s * 0.095, 0.01, 0.3, p.head);
  mesh(G.box(0.05, 0.012, 0.012), M.color(0x2b2b2e), 0, 0.02, 0.305, p.head);
  // bow tie
  for (const s of [-1, 1]) mesh(G.cyl(0.0, 0.07, 0.1, 3), M.color(accent, 0.4), s * 0.05, 1.36, 0.27, p.body).rotation.z = (s * Math.PI) / 2;
  // review stamp in the right hand
  const stamp = new THREE.Group();
  stamp.position.set(0, -0.06, 0.04);
  p.arms.R.hand.add(stamp);
  mesh(G.cyl(0.03, 0.03, 0.14, 16), M.color(0x2b2b2e), 0, 0.02, 0, stamp);
  mesh(G.cyl(0.08, 0.08, 0.05, 32), M.color(0xd7263d, 0.4), 0, -0.07, 0, stamp);
  // the sheet being reviewed
  const sheet = new THREE.Group();
  sheet.position.set(-0.18, 0.2, 0.55);
  p.root.add(sheet);
  mesh(G.box(0.4, 0.012, 0.5), M.ceramic(), 0, 0, 0, sheet);
  const markMat = M.glow(0xd7263d);
  const mark = mesh(G.torus(0.08, 0.014, 32), markMat, 0, 0.01, 0, sheet);
  mark.rotation.x = Math.PI / 2;
  return rig(p, {
    work(dt, t, w) {
      const R = p.arms.R;
      const c = (t * 0.9) % 1;
      const press = c < 0.75 ? ease(c / 0.75) : 1 - ease((c - 0.75) / 0.25);
      R.pivot.rotation.x = damp(R.pivot.rotation.x, (-0.4 - press * 0.9) * w.work, 10, dt);
      R.pivot.rotation.z = damp(R.pivot.rotation.z, -0.12 + 0.45 * w.work, 6, dt);
      p.neck.rotation.x += 0.25 * w.work;
      p.neck.rotation.y = damp(p.neck.rotation.y, 0.3 * w.work, 3, dt);
      sheet.visible = w.work > 0.02;
      sheet.scale.setScalar(Math.max(0.001, w.work));
      markMat.opacity = c > 0.95 || c < 0.5 ? 1 : 0.3;
    },
  });
}

function leader(accent) {
  const p = humanoid(accent);
  // blazer lapels, tie and a small gold pin
  const navy = M.color(0x1c2a4a, 0.5);
  for (const sgn of [-1, 1]) {
    const lapel = mesh(G.box(0.12, 0.42, 0.04), navy, sgn * 0.13, 1.08, 0.27, p.body);
    lapel.rotation.z = sgn * 0.32;
    lapel.rotation.x = -0.12;
  }
  mesh(G.cyl(0.0, 0.055, 0.32, 4), M.color(accent, 0.35), 0, 1.06, 0.31, p.body).rotation.x = Math.PI;
  mesh(G.sphere(0.03, 16, 16), M.metal(0xf0c419), 0.17, 1.22, 0.27, p.body);
  return rig(p, {
    work(dt, t, w) {
      // presenting: open palm sweeping across an invisible room
      const R = p.arms.R;
      R.pivot.rotation.x = damp(R.pivot.rotation.x, -1.0 * w.work, 3, dt);
      R.pivot.rotation.z = damp(R.pivot.rotation.z, -0.12 - (0.5 + Math.sin(t * 0.9) * 0.35) * w.work, 3, dt);
      p.neck.rotation.y = damp(p.neck.rotation.y, -Math.sin(t * 0.9) * 0.3 * w.work, 3, dt);
    },
  });
}

function designer(accent) {
  const p = humanoid(accent);
  // headphones around the neck, palette + brush, a canvas that fills with colour
  mesh(G.torus(0.2, 0.035, 48), M.color(0x2b2b2e), 0, 1.42, 0.02, p.body).rotation.x = Math.PI / 2.3;
  const palette = new THREE.Group();
  palette.position.set(0, 0, 0.1);
  palette.rotation.x = -1.2;
  p.arms.L.hand.add(palette);
  mesh(G.cyl(0.16, 0.16, 0.02, 32), M.color(0xe9d8b8, 0.6), 0, 0, 0, palette);
  const paints = [0xff3b30, 0xffcc00, 0x34c759, 0x0a84ff, 0xaf52de];
  paints.forEach((c, i) => mesh(G.sphere(0.028, 12, 12), M.color(c, 0.3), Math.cos(i * 1.1) * 0.09, 0.02, Math.sin(i * 1.1) * 0.09, palette));
  const brush = new THREE.Group();
  brush.position.set(0, 0, 0.05);
  brush.rotation.x = 0.7;
  p.arms.R.hand.add(brush);
  mesh(G.cyl(0.012, 0.016, 0.34, 8), M.color(0x9c6b3c, 0.5), 0, 0.12, 0, brush);
  const tip = mesh(G.cap(0.02, 0.04), M.color(accent), 0, 0.31, 0, brush);
  const canvasG = new THREE.Group();
  canvasG.position.set(-0.05, 1.15, 0.66);
  canvasG.rotation.x = -0.25;
  p.root.add(canvasG);
  mesh(G.box(0.56, 0.42, 0.02), M.ceramic(), 0, 0, 0, canvasG);
  const blobs = paints.map((c, i) => mesh(G.cyl(0.07, 0.07, 0.006, 24), M.color(c, 0.5), -0.18 + i * 0.09, -0.06 + (i % 2) * 0.1, 0.012, canvasG));
  blobs.forEach((b) => (b.rotation.x = Math.PI / 2));
  return rig(p, {
    work(dt, t, w) {
      const R = p.arms.R;
      R.pivot.rotation.x = damp(R.pivot.rotation.x, (-1.2 + Math.sin(t * 3) * 0.12) * w.work, 5, dt);
      R.pivot.rotation.z = damp(R.pivot.rotation.z, -0.12 + (0.3 + Math.cos(t * 3) * 0.15) * w.work, 5, dt);
      p.arms.L.pivot.rotation.x = damp(p.arms.L.pivot.rotation.x, -0.7 * w.work, 4, dt);
      canvasG.visible = w.work > 0.02;
      canvasG.scale.setScalar(Math.max(0.001, w.work));
      const fill = (t * 0.6) % (blobs.length + 2);
      blobs.forEach((b, i) => b.scale.setScalar(Math.max(0.001, Math.min(1, fill - i))));
      tip.material.color.setHex(paints[Math.floor(t * 0.6) % paints.length]);
    },
  });
}

function finance(accent) {
  const p = humanoid(accent);
  // green eyeshade and a tablet; a bar chart rises while working
  const shade = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 48, 1, true, -Math.PI * 0.35, Math.PI * 0.7), new THREE.MeshPhysicalMaterial({ color: 0x1f9d55, transparent: true, opacity: 0.75, side: THREE.DoubleSide }), 0, 0.12, 0.02, p.head);
  shade.rotation.x = -0.25;
  mesh(G.torus(0.3, 0.012, 48), M.color(0x1f9d55), 0, 0.12, 0, p.head).rotation.x = Math.PI / 2;
  const tablet = new THREE.Group();
  tablet.position.set(0, 0.04, 0.12);
  tablet.rotation.x = -0.5;
  p.arms.L.hand.add(tablet);
  mesh(G.box(0.3, 0.22, 0.015), M.glass(), 0, 0, 0, tablet);
  const chart = new THREE.Group();
  chart.position.set(-0.5, 1.45, 0.4);
  p.root.add(chart);
  const barMat = M.glow(accent);
  const bars = [0.35, 0.55, 0.45, 0.8, 1].map((h, i) => {
    const b = mesh(G.box(0.07, 1, 0.07), barMat, -0.16 + i * 0.08, 0, 0, chart);
    b.userData.h = h * 0.4;
    return b;
  });
  return rig(p, {
    work(dt, t, w) {
      p.arms.L.pivot.rotation.x = damp(p.arms.L.pivot.rotation.x, -1.0 * w.work - 0.15, 4, dt);
      p.arms.R.pivot.rotation.x = damp(p.arms.R.pivot.rotation.x, (-0.85 + Math.sin(t * 5) * 0.05) * w.work, 5, dt);
      p.neck.rotation.x += 0.15 * w.work;
      chart.visible = w.work > 0.02;
      chart.rotation.y = Math.sin(t * 0.5) * 0.4;
      bars.forEach((b, i) => {
        const g = Math.max(0.02, b.userData.h * w.work * (0.75 + 0.25 * Math.sin(t * 1.5 + i)));
        b.scale.y = g;
        b.position.y = g / 2;
      });
      barMat.opacity = 0.85;
    },
  });
}

const KITS = { builder, researcher, scout, guardian, principal, architect, writer, critic, leader, designer, finance };
export const KIT_COLOR = {
  builder: "#ff9f0a", researcher: "#5e5ce6", scout: "#32ade6", guardian: "#3a5bd9", principal: "#0a84ff", architect: "#d4a72c",
  writer: "#bf5af2", critic: "#ff375f", leader: "#0a84ff", designer: "#ff6b3d", finance: "#0fb5a0",
};

// Pick a kit from what the agent is called and what it does. Name wins, then title, then role.
const RULES = [
  ["guardian", /guardian|red ?team|security|legal|complian|shield|safety|risk|governance/],
  ["scout", /scout|discover|intake|explor|recon|growth|prospect/],
  ["architect", /architect|\bcto\b|systems/],
  ["finance", /financ|\bcfo\b|account|revenue|pricing|budget|pitch/],
  ["designer", /design|visual|\bart\b|creative|canvas|brand|\bux\b/],
  ["critic", /critic|\bqa\b|quality|review|partner|audit|preview|judge|evaluat/],
  ["writer", /writ|script|content|copy|producer|editor|\bcmo\b|marketing|social|story/],
  ["researcher", /research|fact|analyst|scien|investigat/],
  ["builder", /build|engineer|develop|voice|render|cinemat|prototype|devops|coder|maker/],
  ["leader", /\bceo\b|chief|founder|director|principal|\bpm\b|lead|manager|head|president|coordinator/],
];
const ROLE_FALLBACK = { engineer: "builder", qa: "critic", researcher: "researcher", designer: "designer", ceo: "leader", cto: "architect", cmo: "writer", cfo: "finance", pm: "leader" };
export function kitFor(agent) {
  for (const field of [agent.name, agent.title, agent.role]) {
    const s = String(field || "").toLowerCase();
    for (const [kit, re] of RULES) if (re.test(s)) return kit;
  }
  return ROLE_FALLBACK[agent.role] || "principal";
}
export function makeCharacter(agent, accent) {
  const kit = KITS[kitFor(agent)] || principal;
  const c = kit(accent);
  c.root.traverse((o) => o.isMesh && (o.receiveShadow = false));
  return c;
}
