// Anatomy Figure: a cutaway miniature greenhouse, not a measured digital twin.
// Parts: 4 feet, base, 4 tray edges, soil, 12 plant stems + 24 leaves,
// 6 upright/frame beams, 6 roof rails, controller case/lid/chip/USB/pins,
// 2 tanks/lids/pump bodies/motor caps/nozzles, climate sensor, fire sensor,
// probe shaft/head, 8 mounting fasteners. Status colouring is UI selection only.
import { writeFileSync } from "node:fs";
import * as k from "./vendor/anatomy/iso-kit.mjs";
const P = k.fitProjection(
  k.boxCorners({ x: -125, y: -75, w: 265, d: 168 }, -10, 122),
  700,
  410,
  { pad: 24, azimuth: 42, elevation: 25 },
);
const solids = [];
function add(center, body, system = "structure") {
  solids.push({
    depth: k.depthOf(center, P),
    body: `<g data-system="${system}">${body}</g>`,
  });
}
function box(x, y, z, w, d, h, tone = "mid", system) {
  add(
    [x + w / 2, y + d / 2, z + h / 2],
    k.solidSvg(k.slabOf({ x, y, w, d, r: 1 }, z, h, P, 4, 0.5), { tone }),
    system,
  );
}
function cyl(x, y, z, r, h, tone = "hi", system) {
  add(
    [x, y, z + h / 2],
    k.solidSvg(k.cylinder(x, y, r, z, h, P, 24, 0.4), { tone }),
    system,
  );
}
function roof(a, b, y) {
  const [x, z] = a,
    [u, v] = b,
    dx = u - x,
    dz = v - z,
    len = Math.hypot(dx, dz),
    ox = (-dz / len) * 1.4,
    oz = (dx / len) * 1.4;
  const points = [
    [x + ox, y - 1.4, z + oz],
    [u + ox, y - 1.4, v + oz],
    [u - ox, y - 1.4, v - oz],
    [x - ox, y - 1.4, z - oz],
  ];
  const front = points.map((p) => k.iso(p, P)),
    back = points.map((p) => k.iso([p[0], p[1] + 2.8, p[2]], P));
  add(
    [(x + u) / 2, y, (z + v) / 2],
    `<path d="${k.pathOf(front, true)}" fill="#a6b2a1" stroke="#526457" stroke-width=".6"/><path d="${k.pathOf([front[0], front[1], back[1], back[0]], true)}" fill="#e1e6d9" stroke="#526457" stroke-width=".6"/>`,
  );
}
for (const x of [-105, 90])
  for (const y of [-58, 55]) box(x, y, -9, 13, 13, 6, "lo");
box(-118, -70, -3, 240, 150, 4, "lo");
box(-98, -50, 1, 176, 96, 8, "mid", "soil");
box(-94, -46, 9, 168, 88, 2, "lo", "soil");
for (const y of [-50, 44]) box(-98, y, 10, 176, 2, 4, "hi", "soil");
for (const x of [-98, 76]) box(x, -50, 10, 2, 96, 4, "hi", "soil");
for (const x of [-76, -36, 4, 44])
  for (const y of [-27, 0, 27]) {
    cyl(x, y, 11, 1.1, 13, "mid", "soil");
    for (const side of [-1, 1]) {
      const ring = k.roundedPlan(
        { x: x + side * 5 - 6, y: y - 2, w: 12, d: 5, r: 2.5 },
        5,
      );
      add(
        [x + side * 5, y, 22],
        k.solidSvg(k.extrude(ring, 20, 1.5, P), {
          tone: "hi",
          className: "plant",
        }),
        "soil",
      );
    }
  }
for (const x of [-108, 82])
  for (const y of [-59, 54]) {
    box(x, y, 1, 3, 3, 79, "mid");
    cyl(x + 1.5, y + 1.5, 80, 2, 0.8, "hi");
  }
for (const x of [-108, 82]) box(x, -59, 77, 3, 116, 3, "hi");
for (const y of [-59, 54]) {
  roof([-107, 80], [-12, 118], y);
  roof([-12, 118], [84, 80], y);
}
box(-13, -59, 116, 3, 116, 3, "hi");
for (const y of [-59, 54]) box(-108, y, 77, 193, 3, 3, "hi");
// Controller cabinet and precise electronic details.
box(-115, 67, 1, 64, 20, 15, "mid", "controller");
box(-113, 68, 16, 60, 17, 1, "hi", "controller");
box(-96, 70, 17, 26, 12, 2, "lo", "controller");
box(-90, 72, 19, 12, 8, 1, "mid", "controller");
box(-113, 73, 18, 8, 7, 3, "lo", "controller");
for (let i = 0; i < 7; i++)
  for (const y of [69, 82])
    box(-96 + i * 4, y, 19, 1.2, 1.8, 1, "hi", "controller");
for (const x of [-109, -57])
  for (const y of [71, 81]) cyl(x, y, 17, 0.8, 0.6, "lo", "controller");
for (const [x, y, system] of [
  [112, -32, "fire"],
  [112, 27, "irrigation"],
]) {
  cyl(x, y, 1, 14, 25, "mid", system);
  cyl(x, y, 26, 14.5, 2, "hi", system);
  cyl(x, y, 28, 4, 2, "lo", system);
  box(x - 10, y + 16, 1, 20, 11, 8, "lo", system);
  cyl(x, y + 21, 9, 4, 3, "mid", system);
  box(x - 2, y + 9, 10, 4, 11, 3, "hi", system);
}
box(-90, -58, 42, 12, 9, 15, "hi", "climate");
for (let i = 0; i < 4; i++)
  box(-88, -58.5, 45 + i * 3, 8, 1, 1, "lo", "climate");
box(70, -55, 36, 9, 7, 10, "lo", "fire");
cyl(75, -51, 46, 2, 1, "hi", "fire");
box(58, 27, 12, 2, 3, 21, "lo", "soil");
box(56, 26, 33, 6, 5, 4, "hi", "soil");
const css = `${k.ISO_CSS}\n.iso-svg{width:100%;height:100%;}.iso[data-theme="light"]{--anatomy-top:#eef2e5;--anatomy-shade-0:#9aa993;--anatomy-shade-1:#b3c0a8;--anatomy-shade-2:#c7d1bb;--anatomy-shade-3:#dce4d2;--anatomy-hi:#43583a;--anatomy-mid:#5c7151;--anatomy-lo:#859379}.plant .iso-top{fill:#8ca56f}.plant .iso-shade{fill:#6c8458} [data-system]{transition:opacity .2s} .selected [data-system]:not(.selected-part){opacity:.62}.selected-part .iso-edge{stroke:#3c704b;stroke-width:1.2}`;
const body = solids
  .sort((a, b) => a.depth - b.depth)
  .map((p) => p.body)
  .join("");
let svg = k.figureSvg({
  width: 700,
  height: 410,
  label:
    "Cutaway schematic of the AVATAR greenhouse: planted bed, controller, climate sensor, irrigation and fire systems",
  body,
  standalone: "light",
});
svg = svg.replace(
  "<style>" + k.ISO_CSS + "</style>",
  "<style>" + css + "</style>",
);
writeFileSync(
  new URL("../public/assets/field/greenhouse.svg", import.meta.url),
  svg,
);
console.log(`Greenhouse figure: ${solids.length} shaded parts`);
