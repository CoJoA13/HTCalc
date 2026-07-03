export type SteelStartingCondition =
  | "normalized"
  | "annealed"
  | "spheroidized"
  | "quenched-tempered"
  | "hot-rolled"
  | "unknown";

export type SteelProcessPriority =
  | "hardness"
  | "toughness"
  | "distortion"
  | "wear"
  | "fatigue";

export type SteelFurnaceType =
  | "controlled-atmosphere"
  | "air"
  | "vacuum"
  | "inert"
  | "salt";

export type SteelAtmosphereType =
  | "endothermic-neutral"
  | "nitrogen-methanol"
  | "vacuum"
  | "inert"
  | "air"
  | "salt"
  | "unknown";

export type SteelQuenchMedium =
  | "water"
  | "oil"
  | "polymer"
  | "salt"
  | "hot-oil"
  | "air"
  | "furnace"
  | "other";

export type SteelBathAgitation = "poor" | "fair" | "good";
export type ConfidenceLevel = "green" | "yellow" | "red";
export type ProcessingWindowStatus = "robust" | "narrow" | "invalid";
export type BainiteTarget = "upper" | "lower" | "balanced";
export type AustemperBathMedium = "salt" | "hot-oil" | "fluidized-bed" | "furnace" | "other";
export type MartemperBathMedium = "salt" | "hot-oil" | "polymer" | "other";
export type EqualizationStrategy = "section-equalized" | "surface-equalized" | "time-limited";

export interface SteelComposition {
  C: number;
  Mn: number;
  Si: number;
  Ni: number;
  Cr: number;
  Mo: number;
  V: number;
  Cu: number;
  B: number;
}

export interface SteelGeometry {
  maxSectionMm: number;
  minSectionMm: number;
  criticalSectionMm: number;
  estimatedMassKg?: number;
}

export interface SteelTarget {
  priority: SteelProcessPriority;
  targetHardnessHrc?: number;
}

export interface SteelEquipment {
  furnaceType: SteelFurnaceType;
  atmosphereType: SteelAtmosphereType;
  carbonProtection: boolean;
  quenchMedium: SteelQuenchMedium;
  agitation: SteelBathAgitation;
  transferTimeSec: number;
  bathUniformityC: number;
}

export interface SteelBaseInput {
  composition: SteelComposition;
  geometry: SteelGeometry;
  startingCondition: SteelStartingCondition;
  target: SteelTarget;
  equipment: SteelEquipment;
}

export interface SteelAustemperingInput extends SteelBaseInput {
  austemper: {
    bainiteTarget: BainiteTarget;
    bathMedium: AustemperBathMedium;
    bathTemperatureC?: number;
    maxHoldMin?: number;
  };
}

export interface MartemperingInput extends SteelBaseInput {
  martemper: {
    bathMedium: MartemperBathMedium;
    bathTemperatureC?: number;
    equalizationStrategy: EqualizationStrategy;
    maxEqualizationMin?: number;
    temperHoldMin: number;
    temperCount: number;
  };
}

export interface TemperatureWindow {
  minC: number;
  nominalC: number;
  maxC: number;
  minF: number;
  nominalF: number;
  maxF: number;
}

export interface TimeWindow {
  minMin: number;
  nominalMin: number;
  maxMin: number;
}

export interface HardnessRange {
  minHrc: number;
  nominalHrc: number;
  maxHrc: number;
  warnings: readonly string[];
}

export interface SteelTransformationEstimate {
  ac1C: number;
  ac3C: number;
  msC: number;
  bainiteStartC: number;
  hardenabilityScore: number;
  sectionSeverity: number;
  retainedAusteniteRisk: number;
  warnings: readonly string[];
}

export interface TemperingRecommendation {
  temperature: TemperatureWindow;
  hold: TimeWindow;
  targetHardnessHrc: number;
  temperCount: number;
  warnings: readonly string[];
}

export interface SteelRecommendationBase {
  transformation: SteelTransformationEstimate;
  austenitize: {
    temperature: TemperatureWindow;
    soakAfterCoreAtTemp: TimeWindow;
    atmosphereGuidance: string;
  };
  confidence: ConfidenceLevel;
  processingWindowStatus: ProcessingWindowStatus;
  warnings: readonly string[];
  validationChecks: readonly string[];
}

export interface SteelAustemperingRecommendation extends SteelRecommendationBase {
  mode: "steel-austempering";
  austemper: {
    temperature: TemperatureWindow;
    holdAfterCoreAtTemp: TimeWindow;
  };
  expectedStructure: string;
  expectedHardness: HardnessRange;
  finalCoolGuidance: string;
}

export interface MartemperingRecommendation extends SteelRecommendationBase {
  mode: "martempering";
  martemper: {
    temperature: TemperatureWindow;
  };
  equalize: TimeWindow;
  finalCoolGuidance: string;
  asQuenchedHardness: HardnessRange;
  temper: TemperingRecommendation;
}

export type SteelProcessRecommendation =
  | SteelAustemperingRecommendation
  | MartemperingRecommendation;
