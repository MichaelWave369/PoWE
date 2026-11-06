// PoWE Rung 6: MK1 hardware DESIGN requirements only.
// This module cannot inspect, authorize, energize or certify physical devices.
export const SCHEMA = "powe-bench-mk1-design-v1";
export const DESIGN_DEFAULT = Object.freeze({
  schema: SCHEMA,
  revision: "MK1-R6",
  state: "UNBUILT_DESIGN",
  powerBoundary: "measured_usb_dc_input_to_led",
  source: {
    topology: "commercial_diffuse_led_dc",
    supplyVoltageV: 5,
    supplyCurrentLimitA: 0.4,
    hardwiredManualDisconnectRequired: true,
    independentOvercurrentProtectionRequired: true,
    supplyOvercurrentTripA: 0.5,
    laserProhibited: true,
    exposedMainsProhibited: true
  },
  receiver: {
    topology: "commercial_photovoltaic",
    manufacturerRatingCondition: "sunlight_not_indoor_led",
    candidateVocV: 6.1,
    candidateRatedPowerW: 0.6,
    independentOutputLoadRequired: true,
    receiverMeasurementIsolatedRequired: true
  },
  metrology: {
    sourceReference: "LED_USB_DC_INPUT",
    receiverReference: "PV_DC_LOAD",
    sourceInstrument: "UNSELECTED",
    receiverInstrument: "UNSELECTED",
    instrumentsIndependentlyCalibrated: false,
    targetReceiverCurrentUa: 10,
    requiredReceiverCurrentResolutionUa: 1,
    samplePeriodMs: 500,
    maxClockSkewMs: 50
  },
  geometry: {
    minimumDistanceM: 0.1,
    maximumDistanceM: 1,
    enclosureRequired: true,
    ambientDarkRunRequired: true,
    rigidAlignmentRequired: true
  },
  gateway: {
    requiredProtocol: "powe.benchlink.v1",
    dataOnlyIsolatedGatewayRequired: true,
    serialOpenCannotControlPowerRequired: true,
    verifiedOnHardware: false
  }
});
function clone(o) { return JSON.parse(JSON.stringify(o)); }
export function createPrototype(overrides = {}) {
  const copy = clone(DESIGN_DEFAULT);
  for (const group of ["source","receiver","metrology","geometry","gateway"]) {
    if (overrides[group] && typeof overrides[group] === "object" &&
        !Array.isArray(overrides[group])) {
      Object.assign(copy[group],overrides[group]);
    }
  }
  for (const key of ["schema","revision","state","powerBoundary"]) {
    if (Object.prototype.hasOwnProperty.call(overrides,key)) copy[key] = overrides[key];
  }
  return copy;
}
const numeric = (x,min,max) => typeof x === "number" &&
  Number.isFinite(x) && x>=min && x<=max;
const isId = x => typeof x === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(x);
const requireFlag = (errors,ok,code,message) => {
  if(!ok) errors.push({code,message});
};
export function evaluatePrototype(raw) {
  const errors=[],pending=[],warnings=[];
  if(!raw || typeof raw !== "object" || Array.isArray(raw)){
    return {schema:SCHEMA,structuralStatus:"INVALID_DESIGN",errors:[{code:"INVALID_INPUT",message:"Expected manifest object"}],pending:[],warnings:[],hardwareValidated:false,energizingAuthorized:false};
  }
  const x=raw,s=x.source||{},r=x.receiver||{},m=x.metrology||{},g=x.geometry||{},link=x.gateway||{};
  requireFlag(errors,x.schema===SCHEMA,"SCHEMA","Unexpected manifest schema");
  requireFlag(errors,x.state==="UNBUILT_DESIGN","STATE","Never mark physical apparatus as built from a design manifest");
  requireFlag(errors,x.powerBoundary==="measured_usb_dc_input_to_led","BOUNDARY",
    "Rung 6 measures USB DC into LED, NOT AC wall-plug input or optical irradiance");
  requireFlag(errors,s.topology==="commercial_diffuse_led_dc","EMITTER","Only documented, diffuse commercial DC LED is in scope");
  requireFlag(errors,numeric(s.supplyVoltageV,0.1,5),"SUPPLY_V","Design USB DC supply voltage must be 0.1-5 V");
  requireFlag(errors,numeric(s.supplyCurrentLimitA,0.01,0.5),"SUPPLY_A","Design limit must be 0.01-0.5 A");
  const theoreticalInputW= numeric(s.supplyVoltageV,0.1,5)&&
    numeric(s.supplyCurrentLimitA,0.01,0.5) ?
    s.supplyVoltageV*s.supplyCurrentLimitA:null;
  requireFlag(errors,theoreticalInputW!==null && theoreticalInputW<=2.5,"POWER_BUDGET",
    "Nominal source design ceiling must not exceed 2.5 W");
  requireFlag(errors,s.hardwiredManualDisconnectRequired===true,"CUT_OFF","A physical disconnect is required");
  requireFlag(errors,s.independentOvercurrentProtectionRequired===true,"FUSE","Independent electrical current protection is required");
  requireFlag(errors,numeric(s.supplyOvercurrentTripA,0.01,0.5) &&
    numeric(s.supplyCurrentLimitA,0.01,0.5) &&
    s.supplyOvercurrentTripA>=s.supplyCurrentLimitA,"TRIP_BUDGET","Document an independent protection threshold within 0.5 A, at least as high as planned operating current");
  requireFlag(errors,s.laserProhibited===true && s.exposedMainsProhibited===true,"OPTICAL_MAINS","No laser/focused beam or exposed mains");
  requireFlag(errors,r.topology==="commercial_photovoltaic","RECEIVER","Only commercial photovoltaic receiver in scope");
  requireFlag(errors,r.manufacturerRatingCondition==="sunlight_not_indoor_led","PV_RATING","Manufacturer outdoor solar rating cannot be treated as indoor LED output");
  requireFlag(errors,numeric(r.candidateVocV,0.01,12),"PV_VOC","Candidate panel open-circuit voltage must fit the proposed DC measurement range");
  requireFlag(errors,numeric(r.candidateRatedPowerW,0.001,5),"PV_RATED","PV manufacturer rating must be a finite value, not measured output");
  requireFlag(errors,r.independentOutputLoadRequired===true &&
    r.receiverMeasurementIsolatedRequired===true,"ISOLATION","Receiver load and independent measurement isolation are required");
  requireFlag(errors,m.sourceReference==="LED_USB_DC_INPUT" &&
    m.receiverReference==="PV_DC_LOAD","METROLOGY_BOUNDARY","Source and receiver electrical measurement locations must be explicit");
  requireFlag(errors,numeric(m.targetReceiverCurrentUa,0.01,100000),"TARGET_SIGNAL","Set plausible expected current floor for instrument selection; not a measurement");
  requireFlag(errors,numeric(m.requiredReceiverCurrentResolutionUa,0.001,10000) &&
    numeric(m.targetReceiverCurrentUa,0.01,100000) &&
    m.requiredReceiverCurrentResolutionUa<=m.targetReceiverCurrentUa/10,"METER_RESOLUTION",
    "Planned resolution must be no worse than 1/10 of hypothetical receiver signal floor");
  requireFlag(errors,Number.isSafeInteger(m.samplePeriodMs) &&
    m.samplePeriodMs>=50&&m.samplePeriodMs<=1000,"SAMPLE_PERIOD",
    "Sample period should be 50-1000 ms to support BenchLink's <=2s interval");
  requireFlag(errors,numeric(m.maxClockSkewMs,0,100) &&
    Number.isSafeInteger(m.samplePeriodMs) &&
    m.maxClockSkewMs<=m.samplePeriodMs/4,"TIMEBASE",
    "Target sample timestamp skew must be <=100ms and <=25% of sample period");
  requireFlag(errors,numeric(g.minimumDistanceM,0.05,5) &&
    numeric(g.maximumDistanceM,0.05,5) &&
    g.minimumDistanceM<=g.maximumDistanceM,"GEOMETRY","Bench distances must be within 0.05-5 m, ordered");
  requireFlag(errors,g.enclosureRequired===true && g.ambientDarkRunRequired===true &&
    g.rigidAlignmentRequired===true,"AMBIENT","Enclosure, dark baseline and reproducible alignment required");
  requireFlag(errors,link.requiredProtocol==="powe.benchlink.v1","PROTOCOL","Use the documented read-only BenchLink schema");
  requireFlag(errors,link.dataOnlyIsolatedGatewayRequired===true &&
    link.serialOpenCannotControlPowerRequired===true,"GATEWAY","Gateway must be isolated and incapable of controlling power");
  if(!isId(m.sourceInstrument) || m.sourceInstrument==="UNSELECTED")
    pending.push("Select an independent source measurement instrument and document calibration");
  if(!isId(m.receiverInstrument) || m.receiverInstrument==="UNSELECTED")
    pending.push("Select an independent receiver measurement instrument and validate low-current floor");
  if(isId(m.sourceInstrument) && isId(m.receiverInstrument) &&
    m.sourceInstrument!=="UNSELECTED" && m.receiverInstrument!=="UNSELECTED" &&
    m.sourceInstrument===m.receiverInstrument){
    errors.push({code:"INDEPENDENT_METERS",message:"Two independent metrology channels cannot claim the same instrument ID"});
  }
  if(m.instrumentsIndependentlyCalibrated!==true)
    pending.push("Independent calibration and uncertainty budget are not verified");
  if(link.verifiedOnHardware!==true)
    pending.push("Read-only gateway and serial control-line isolation are not hardware verified");
  pending.push("Independent electrical/optical review and physical disconnect test not completed by this software");
  pending.push("Real measured source/receiver dark and illuminated reference runs not attached");
  warnings.push("Ceiling is for PLANNING only, not actual measured input power, optical output, or regulatory approval");
  warnings.push("PV panel sunlight rating cannot predict indoor LED harvesting; bench output may be far smaller");
  return {
    schema:SCHEMA,revision:x.revision,structuralStatus:errors.length?"INVALID_DESIGN":"DESIGN_CONSTRAINTS_PASSED",
    theoreticalInputCeilingW:theoreticalInputW,
    errors,pending,warnings,
    hardwareValidated:false,energizingAuthorized:false,experimentalOutcomeVerified:false,
    note:"Structural design checks and self-entered fields never authorize energizing or certify hardware"
  };
}
export const COMMISSIONING_STEPS = Object.freeze([
  ["B01","Device identifiers and supply ratings recorded","DOCUMENT_ONLY"],
  ["B02","LED source is enclosed, diffuse, DC and independently protected","INDEPENDENT_INSPECTION"],
  ["B03","Physical disconnection tested by a competent person","INDEPENDENT_INSPECTION"],
  ["B04","Read-only gateway electrically isolated, DTR/RTS safe","INDEPENDENT_TEST"],
  ["B05","Source-side instrument range/calibration evaluated","METROLOGY"],
  ["B06","Receiver-side instrument resolution/calibration evaluated","METROLOGY"],
  ["B07","Meter timing/skew measured with independent reference","METROLOGY"],
  ["B08","Dark baseline and ambient variation recorded","CONTROL_RUN"],
  ["B09","Fixed geometry and source loading documented","CONTROL_RUN"],
  ["B10","No-light and lamp-on control logs obtained independently","CONTROL_RUN"],
  ["B11","Raw NDJSON and independent meter logs reconciled","DATA_AUDIT"],
  ["B12","Only after review: preregistered fixed/adaptive trials","FUTURE_EXPERIMENT"]
]);
export function commissioningTemplate(plan){
  const design=evaluatePrototype(plan);
  return {
    schema:"powe-mk1-physical-acceptance-template-v1",
    basedOnRevision:plan?.revision||null,
    status:"NOT_PERFORMED",
    softwareDesignStatus:design.structuralStatus,
    hardwareValidated:false,energizingAuthorized:false,
    tasks:COMMISSIONING_STEPS.map(([id,description,category])=>({
      id,description,category,status:"NOT_RUN",evidenceReference:null,
      reviewer:null,observedAtUtc:null
    }))
  };
}
export function billOfMaterialsTemplate(plan){
  const check=evaluatePrototype(plan);
  return {
    schema:"powe-mk1-bom-template-v1",
    status:"CANDIDATES_ONLY_NOT_ORDERED",
    theoreticalElectricalCeilingW:check.theoreticalInputCeilingW,
    requiredItems:[
      {category:"source",label:"Commercial 5V DC diffuse LED enclosure",quantity:1,
        requirement:"Source supply and current limiting independent of browser"},
      {category:"receiver",label:"Commercial small photovoltaic panel and passive test load",quantity:1,
        requirement:"Record rating conditions; do not assume sunlight rating under LED"},
      {category:"source_meter",label:"Independently calibrated DC V/I measurement channel",quantity:1,
        requirement:"Measure LED-side electrical supply input"},
      {category:"receiver_meter",label:"Independently calibrated low-current DC V/I measurement channel",quantity:1,
        requirement:"Resolve expected microamp-scale dark and illuminated signals"},
      {category:"gateway",label:"Physically read-only USB telemetry gateway",quantity:1,
        requirement:"No energized outputs from DTR/RTS, port open or software"},
      {category:"safety",label:"Physical disconnect, overcurrent protection, enclosure",quantity:1,
        requirement:"Independent hardware safety and inspection"},
      {category:"fixture",label:"Adjustable rigid optical distance and alignment fixture",quantity:1,
        requirement:"Dark baseline and reproducible ambient conditions"}
    ]
  };
}
