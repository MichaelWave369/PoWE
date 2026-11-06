// PoWE Rung 1: dimensional, receiver-side illustrative power budgets.
// THESE ARE MODELS, NOT HARDWARE MEASUREMENTS OR REGULATORY GUIDANCE.
export const DEFAULT_CONTROLS = Object.freeze({
  rfEirpW: 0.1,
  rfDistanceM: 3,
  opticalInputW: 1,
  opticalDistanceM: 1.5,
  nearFieldInputW: 0.5,
  nearFieldDistanceCm: 2
});

function between(name, n, low, high) {
  if (!Number.isFinite(n) || n < low || n > high) {
    throw new RangeError(name + " must be between " + low + " and " + high);
  }
  return n;
}

// Friis free-space link budget, RF far field; no walls, reflections or multipath.
// RF EIRP is not the electrical power drawn by a transmitting access point.
// Output is estimated rectified receiver DC, NOT air-interface PoE.
export function rfHarvestW({ eirpW, distanceM, frequencyHz = 2.4e9, receiveGain = 1, rectifierEfficiency = 0.35 }) {
  between("EIRP (W)", eirpW, 0, 10);
  between("distance (m)", distanceM, 0.5, 1000);
  between("frequency (Hz)", frequencyHz, 1e6, 1e12);
  between("receiver gain", receiveGain, 0, 1000);
  between("rectifier efficiency", rectifierEfficiency, 0, 1);
  const wavelength = 299792458 / frequencyHz;
  const freeSpaceRatio = wavelength / (4 * Math.PI * distanceM);
  return eirpW * freeSpaceRatio * freeSpaceRatio * receiveGain * rectifierEfficiency;
}

// Simple uniform-cone illumination model, not an optical safety analysis.
// Source wattage is electrical input; receiver is a photovoltaic cell, not a QR camera.
export function opticalHarvestW({
  sourceElectricalW, distanceM, beamHalfAngleDeg = 30,
  wallPlugEfficiency = 0.20, receiverAreaM2 = 0.01, pvEfficiency = 0.25
}) {
  between("source power (W)", sourceElectricalW, 0, 100);
  between("distance (m)", distanceM, 0.05, 100);
  between("beam half angle (degrees)", beamHalfAngleDeg, 1, 89);
  between("wall-plug efficiency", wallPlugEfficiency, 0, 1);
  between("receiver area (m2)", receiverAreaM2, 0, 10);
  between("PV efficiency", pvEfficiency, 0, 1);
  const spotArea = Math.PI * Math.pow(distanceM * Math.tan(beamHalfAngleDeg * Math.PI / 180), 2);
  const interceptedFraction = Math.min(1, receiverAreaM2 / spotArea);
  return sourceElectricalW * wallPlugEfficiency * interceptedFraction * pvEfficiency;
}

// Toy coupling proxy for low-power inductive transfer. NOT a verified resonant-coil equation.
// Hardware, coil geometry, alignment, temperature, and foreign-object detection are unmodeled.
export function nearFieldHarvestW({
  sourceElectricalW, distanceCm, referenceEfficiency = 0.55, scaleCm = 4
}) {
  between("source power (W)", sourceElectricalW, 0, 10);
  between("distance (cm)", distanceCm, 0, 100);
  between("reference efficiency", referenceEfficiency, 0, 1);
  between("coupling scale (cm)", scaleCm, 0.1, 100);
  return sourceElectricalW * referenceEfficiency / (1 + Math.pow(distanceCm / scaleCm, 6));
}

export function powerForChannel(channel, controls = DEFAULT_CONTROLS) {
  if (channel === "rf") return rfHarvestW({ eirpW: controls.rfEirpW, distanceM: controls.rfDistanceM });
  if (channel === "optical") return opticalHarvestW({ sourceElectricalW: controls.opticalInputW, distanceM: controls.opticalDistanceM });
  if (channel === "near-field") return nearFieldHarvestW({ sourceElectricalW: controls.nearFieldInputW, distanceCm: controls.nearFieldDistanceCm });
  throw new RangeError("Unknown channel: " + String(channel));
}

const INITIAL_NODES = [
  { id: "rf-sensor", label: "Far-field sensor", channel: "rf", capacityJ: 0.006, energyJ: 0.003, idleW: 0.0000002, pulseEnergyJ: 0.00005, periodSec: 20, reserveJ: 0.0002 },
  { id: "light-node", label: "Optical edge node", channel: "optical", capacityJ: 0.04, energyJ: 0.005, idleW: 0.00008, pulseEnergyJ: 0.0005, periodSec: 4, reserveJ: 0.002 },
  { id: "tap-puck", label: "Near-field puck", channel: "near-field", capacityJ: 0.25, energyJ: 0.05, idleW: 0.01, pulseEnergyJ: 0.025, periodSec: 3, reserveJ: 0.025 }
];

export function createNetwork() {
  return {
    tSeconds: 0,
    nodes: INITIAL_NODES.map(n => ({
      ...n, nextPulseSec: n.periodSec, harvestedJ: 0, consumedJ: 0,
      spilledJ: 0, pulses: 0, deferred: 0, brownoutSeconds: 0, lastPowerW: 0,
      lastEvent: "Waiting for simulation"
    }))
  };
}

// Energy balance per step:
// previous storage + harvested = new storage + consumed + spilled.
export function advanceNode(node, harvestedPowerW, dtSeconds = 1) {
  between("harvested power (W)", harvestedPowerW, 0, 1000);
  between("time step (s)", dtSeconds, 0.001, 3600);
  const harvestJ = harvestedPowerW * dtSeconds;
  const beforeLoadJ = node.energyJ + harvestJ;
  const spilledJ = Math.max(0, beforeLoadJ - node.capacityJ);
  let energyJ = Math.min(node.capacityJ, beforeLoadJ);
  const idleDemandJ = node.idleW * dtSeconds;
  const idleUsedJ = Math.min(energyJ, idleDemandJ);
  energyJ -= idleUsedJ;
  let consumedJ = idleUsedJ;
  const brownout = idleUsedJ + 1e-15 < idleDemandJ;
  let pulses = node.pulses;
  let deferred = node.deferred;
  let lastEvent = brownout ? "Idle load brownout" : "Harvesting / waiting";
  const newTime = node.elapsedSeconds === undefined ? dtSeconds : node.elapsedSeconds + dtSeconds;
  let nextPulseSec = node.nextPulseSec;
  if (newTime + 1e-9 >= nextPulseSec) {
    if (!brownout && energyJ + 1e-15 >= node.pulseEnergyJ + node.reserveJ) {
      energyJ -= node.pulseEnergyJ;
      consumedJ += node.pulseEnergyJ;
      pulses += 1;
      lastEvent = "Telemetry pulse delivered (simulated)";
    } else {
      deferred += 1;
      lastEvent = "Telemetry deferred: low stored energy";
    }
    nextPulseSec = newTime + node.periodSec;
  }
  return {
    ...node, energyJ: Math.max(0, energyJ), elapsedSeconds: newTime, nextPulseSec,
    harvestedJ: node.harvestedJ + harvestJ, consumedJ: node.consumedJ + consumedJ,
    spilledJ: node.spilledJ + spilledJ, pulses, deferred,
    brownoutSeconds: node.brownoutSeconds + (brownout ? dtSeconds : 0),
    lastPowerW: harvestedPowerW, lastEvent
  };
}

export function advanceNetwork(network, controls = DEFAULT_CONTROLS, dtSeconds = 1) {
  return {
    tSeconds: network.tSeconds + dtSeconds,
    nodes: network.nodes.map(node => advanceNode(node, powerForChannel(node.channel, controls), dtSeconds))
  };
}
