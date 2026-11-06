import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONTROLS, createNetwork, advanceNetwork, rfHarvestW, opticalHarvestW, nearFieldHarvestW, powerForChannel } from "../src/model.js";

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, a + " != " + b);

test("RF link budget exposes microwatt-scale harvesting, not PoE", () => {
  const dc = rfHarvestW({ eirpW: 0.1, distanceM: 3 });
  assert.ok(dc > 0.3e-6 && dc < 0.5e-6);
  assert.ok(dc > rfHarvestW({ eirpW: 0.1, distanceM: 6 }));
});

test("light and near-field proxy power decrease with separation", () => {
  assert.ok(opticalHarvestW({ sourceElectricalW: 1, distanceM: 1 }) >
            opticalHarvestW({ sourceElectricalW: 1, distanceM: 2 }));
  assert.ok(nearFieldHarvestW({ sourceElectricalW: 0.5, distanceCm: 2 }) >
            nearFieldHarvestW({ sourceElectricalW: 0.5, distanceCm: 10 }));
});

test("all three channels have finite, positive nominal outputs", () => {
  for (const c of ["rf", "optical", "near-field"]) {
    assert.ok(Number.isFinite(powerForChannel(c, DEFAULT_CONTROLS)));
    assert.ok(powerForChannel(c, DEFAULT_CONTROLS) > 0);
  }
});

test("invalid inputs are rejected instead of silently inventing results", () => {
  assert.throws(() => rfHarvestW({ eirpW: 1, distanceM: 0.01 }), RangeError);
  assert.throws(() => opticalHarvestW({ sourceElectricalW: -1, distanceM: 2 }), RangeError);
  assert.throws(() => powerForChannel("magic"), RangeError);
});

test("receiver-side energy ledger conserves energy over 60 seconds", () => {
  let sim = createNetwork();
  const initial = sim.nodes.map(n => n.energyJ);
  for (let i = 0; i < 60; i++) sim = advanceNetwork(sim);
  assert.equal(sim.tSeconds, 60);
  sim.nodes.forEach((n, i) => {
    close(initial[i] + n.harvestedJ, n.energyJ + n.consumedJ + n.spilledJ, 1e-9);
    assert.ok(n.energyJ >= 0 && n.energyJ <= n.capacityJ);
    assert.ok(n.pulses + n.deferred > 0);
  });
});

test("empty RF node defers telemetry if source disappears", () => {
  let sim = createNetwork();
  sim.nodes[0].energyJ = 0;
  const off = { ...DEFAULT_CONTROLS, rfEirpW: 0 };
  for (let i = 0; i < 40; i++) sim = advanceNetwork(sim, off);
  assert.equal(sim.nodes[0].pulses, 0);
  assert.ok(sim.nodes[0].deferred >= 1);
  assert.ok(sim.nodes[0].brownoutSeconds > 0);
});
