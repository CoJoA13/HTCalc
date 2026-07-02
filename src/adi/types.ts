export type AstmA897Grade =
  | "110-70-11"
  | "130-90-09"
  | "150-110-07"
  | "175-125-04"
  | "200-155-02"
  | "230-185-01";

export type ProcessPriority =
  | "strength"
  | "ductility"
  | "impact"
  | "wear"
  | "fatigue"
  | "machinability";

export type StartingMatrix = "ferritic" | "pearlitic" | "ferritic-pearlitic";

export type FurnaceType =
  | "controlled-atmosphere"
  | "air"
  | "vacuum"
  | "inert"
  | "salt";

export type AtmosphereType =
  | "endothermic-neutral"
  | "nitrogen-methanol"
  | "nitrogen-hydrocarbon"
  | "vacuum"
  | "inert"
  | "air"
  | "salt"
  | "unknown";

export type BathAgitation = "poor" | "fair" | "good";
export type AustemperBathType = "salt" | "fluidized-bed" | "other";
export type ConfidenceLevel = "green" | "yellow" | "red";
export type ProcessingWindowStatus = "robust" | "narrow" | "invalid";

export interface Composition {
  C: number;
  Si: number;
  Mn: number;
  Cu: number;
  Ni: number;
  Mo: number;
  Cr: number;
  Mg: number;
  P: number;
  S: number;
}

export interface CastingGeometry {
  maxSectionMm: number;
  minSectionMm: number;
  criticalSectionMm: number;
  estimatedMassKg?: number;
  surfaceAreaToVolumeRatio?: number;
}

export interface StartingMicrostructure {
  startingMatrix: StartingMatrix;
  carbidesPresent: boolean;
  noduleCountPerMm2?: number;
  nodularityPercent?: number;
  segregationRiskKnown?: boolean;
  chillTendencyKnown?: boolean;
}

export interface ProcessTarget {
  grade: AstmA897Grade;
  priority: ProcessPriority;
  dimensionalGrowthSensitive?: boolean;
}

export interface EquipmentProfile {
  furnaceType: FurnaceType;
  atmosphereType: AtmosphereType;
  carbonPotentialControl: boolean;
  quenchTransferTimeSec: number;
  austemperBathType: AustemperBathType;
  bathAgitation: BathAgitation;
  bathUniformityC: number;
}

export interface AdiProcessInput {
  composition: Composition;
  geometry: CastingGeometry;
  microstructure: StartingMicrostructure;
  target: ProcessTarget;
  equipment: EquipmentProfile;
}

export interface AstmGradeData {
  grade: AstmA897Grade;
  gradeIndex: 1 | 2 | 3 | 4 | 5 | 6;
  tensileStrengthKsi: number;
  yieldStrengthKsi: number;
  elongationPercent: number;
  typicalHardnessHbw: string;
  processDirection: string;
  austenitizeRangeC: [number, number];
  austemperRangeC: [number, number];
  soakRangeMin: [number, number];
  holdRangeMin: [number, number];
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

export interface CarbonPotentialRecommendation {
  category: "low" | "medium" | "high" | "equipment-calibrated";
  rangeCarbonEquivalentPercent?: [number, number];
  guidance: string;
}

export interface AdiScores {
  sectionFactor: number;
  austemperabilityIndex: number;
  requiredAustemperabilityIndex: number;
  carbideSegregationRisk: number;
  atmosphereRisk: 0 | 1 | 2 | 3;
}

export interface AdiProcessRecommendation {
  expectedGrade: AstmA897Grade;
  austenitize: {
    temperature: TemperatureWindow;
    soakAfterCoreAtTemp: TimeWindow;
    totalFurnaceTimeNote: string;
    carbonPotential: CarbonPotentialRecommendation;
  };
  transfer: {
    maxRecommendedTransferTimeSec: number;
    actualTransferTimeSec: number;
  };
  austemper: {
    temperature: TemperatureWindow;
    holdAfterCoreAtTemp: TimeWindow;
    processingWindowStatus: ProcessingWindowStatus;
  };
  scores: AdiScores;
  confidence: ConfidenceLevel;
  warnings: string[];
  validationChecks: string[];
}
