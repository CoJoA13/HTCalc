import type {
  MartemperingInput,
  SteelAustemperingInput,
  SteelBaseInput,
  SteelComposition,
} from "../steel/index.js";

type SteelCompositionKey = keyof SteelComposition;
type SteelGeometryKey = keyof SteelBaseInput["geometry"];
type SteelEquipmentKey = keyof SteelBaseInput["equipment"];
type SteelTargetKey = keyof SteelBaseInput["target"];

const steelAustemperingDefault: SteelAustemperingInput = {
  composition: {
    C: 0.42,
    Mn: 0.85,
    Si: 1.5,
    Ni: 0.2,
    Cr: 0.8,
    Mo: 0.25,
    V: 0.02,
    Cu: 0.15,
    B: 0.0007,
  },
  geometry: {
    maxSectionMm: 45,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 22,
  },
  startingCondition: "normalized",
  target: {
    priority: "toughness",
    targetHardnessHrc: 42,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 7,
    bathUniformityC: 5,
  },
  austemper: {
    bainiteTarget: "lower",
    bathMedium: "salt",
  },
};

const martemperingDefault: MartemperingInput = {
  composition: {
    C: 0.45,
    Mn: 0.8,
    Si: 0.25,
    Ni: 0.2,
    Cr: 0.9,
    Mo: 0.2,
    V: 0.02,
    Cu: 0.15,
    B: 0.0005,
  },
  geometry: {
    maxSectionMm: 38,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 18,
  },
  startingCondition: "normalized",
  target: {
    priority: "distortion",
    targetHardnessHrc: 44,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
  martemper: {
    bathMedium: "salt",
    equalizationStrategy: "section-equalized",
    temperHoldMin: 120,
    temperCount: 1,
  },
};

export function defaultSteelAustemperingInput(): SteelAustemperingInput {
  return structuredClone(steelAustemperingDefault);
}

export function defaultMartemperingInput(): MartemperingInput {
  return structuredClone(martemperingDefault);
}

export function setSteelAustemperingInputValue(
  input: SteelAustemperingInput,
  path: string,
  value: string | number | boolean | undefined,
): void {
  if (setSteelBaseValue(input, path, value)) {
    return;
  }

  switch (path) {
    case "austemper.bainiteTarget":
      input.austemper.bainiteTarget = value as SteelAustemperingInput["austemper"]["bainiteTarget"];
      break;
    case "austemper.bathMedium":
      input.austemper.bathMedium = value as SteelAustemperingInput["austemper"]["bathMedium"];
      break;
    case "austemper.bathTemperatureC":
      assignOptionalNumber(input.austemper, "bathTemperatureC", value);
      break;
    case "austemper.maxHoldMin":
      assignOptionalNumber(input.austemper, "maxHoldMin", value);
      break;
  }
}

export function setMartemperingInputValue(
  input: MartemperingInput,
  path: string,
  value: string | number | boolean | undefined,
): void {
  if (setSteelBaseValue(input, path, value)) {
    return;
  }

  switch (path) {
    case "martemper.bathMedium":
      input.martemper.bathMedium = value as MartemperingInput["martemper"]["bathMedium"];
      break;
    case "martemper.bathTemperatureC":
      assignOptionalNumber(input.martemper, "bathTemperatureC", value);
      break;
    case "martemper.equalizationStrategy":
      input.martemper.equalizationStrategy = value as MartemperingInput["martemper"]["equalizationStrategy"];
      break;
    case "martemper.maxEqualizationMin":
      assignOptionalNumber(input.martemper, "maxEqualizationMin", value);
      break;
    case "martemper.temperHoldMin":
      input.martemper.temperHoldMin = numericValue(value);
      break;
    case "martemper.temperCount":
      input.martemper.temperCount = numericValue(value);
      break;
  }
}

function setSteelBaseValue(
  input: SteelBaseInput,
  path: string,
  value: string | number | boolean | undefined,
): boolean {
  const [group, key] = path.split(".") as [string, string];

  if (group === "composition") {
    input.composition[key as SteelCompositionKey] = numericValue(value);
    return true;
  }

  if (group === "geometry") {
    Object.assign(input.geometry, { [key as SteelGeometryKey]: numericValue(value) });
    return true;
  }

  if (group === "equipment") {
    if (key === "carbonProtection") {
      input.equipment.carbonProtection = Boolean(value);
    } else if (key === "transferTimeSec" || key === "bathUniformityC") {
      Object.assign(input.equipment, { [key as SteelEquipmentKey]: numericValue(value) });
    } else {
      Object.assign(input.equipment, { [key as SteelEquipmentKey]: value });
    }
    return true;
  }

  if (group === "target") {
    if (key === "targetHardnessHrc") {
      input.target.targetHardnessHrc = numericValue(value);
    } else {
      Object.assign(input.target, { [key as SteelTargetKey]: value });
    }
    return true;
  }

  if (path === "startingCondition") {
    input.startingCondition = value as SteelBaseInput["startingCondition"];
    return true;
  }

  return false;
}

function assignOptionalNumber<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string | number | boolean | undefined,
): void {
  if (value === undefined) {
    delete target[key];
    return;
  }

  Object.assign(target, { [key]: numericValue(value) });
}

function numericValue(value: string | number | boolean | undefined): number {
  if (value === undefined) {
    return Number.NaN;
  }

  return typeof value === "number" ? value : Number(value);
}
