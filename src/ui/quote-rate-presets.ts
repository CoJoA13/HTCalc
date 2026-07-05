import type { HeatTreatShopRates } from "../quote/index.js";

export const QUOTE_RATE_PRESETS_STORAGE_KEY = "htcalc.quoteRatePresets.v1";

export interface QuoteRatePreset {
  readonly id: string;
  readonly name: string;
  readonly shopRates: HeatTreatShopRates;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuoteRatePresetLibrary {
  readonly version: 1;
  readonly presets: readonly QuoteRatePreset[];
}

export interface SaveQuoteRatePresetOptions {
  readonly idFactory?: () => string;
  readonly now?: Date;
}

export interface SaveQuoteRatePresetResult {
  readonly library: QuoteRatePresetLibrary;
  readonly preset: QuoteRatePreset;
}

export interface MergeQuoteRatePresetLibrariesOptions {
  readonly idFactory?: () => string;
}

export interface MergeQuoteRatePresetLibrariesResult {
  readonly library: QuoteRatePresetLibrary;
  readonly selectedPresetId: string;
  readonly addedCount: number;
  readonly updatedCount: number;
}

export type QuoteRatePresetStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function emptyQuoteRatePresetLibrary(): QuoteRatePresetLibrary {
  return {
    version: 1,
    presets: [],
  };
}

export function loadQuoteRatePresetLibrary(
  storage: QuoteRatePresetStorage | null | undefined = safeLocalStorage(),
): QuoteRatePresetLibrary {
  if (!storage) {
    return emptyQuoteRatePresetLibrary();
  }

  try {
    const raw = storage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY);
    if (!raw) {
      return emptyQuoteRatePresetLibrary();
    }

    return parseQuoteRatePresetLibrary(JSON.parse(raw));
  } catch {
    return emptyQuoteRatePresetLibrary();
  }
}

export function persistQuoteRatePresetLibrary(
  library: QuoteRatePresetLibrary,
  storage: QuoteRatePresetStorage | null | undefined = safeLocalStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  const serialized = JSON.stringify(parseQuoteRatePresetLibrary(library));
  try {
    storage.setItem(QUOTE_RATE_PRESETS_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function serializeQuoteRatePresetLibrary(library: QuoteRatePresetLibrary): string {
  return `${JSON.stringify(parseQuoteRatePresetLibrary(library), null, 2)}\n`;
}

export function parseQuoteRatePresetLibraryJson(json: string): QuoteRatePresetLibrary {
  return parseQuoteRatePresetLibrary(JSON.parse(json));
}

export function quoteRatePresetExportFilename(exportedAt = new Date()): string {
  return `htcalc-rfq-rate-presets-${exportedAt.toISOString().slice(0, 10)}.json`;
}

export function mergeQuoteRatePresetLibraries(
  localLibrary: QuoteRatePresetLibrary,
  importedLibrary: QuoteRatePresetLibrary,
  options: MergeQuoteRatePresetLibrariesOptions = {},
): MergeQuoteRatePresetLibrariesResult {
  const local = parseQuoteRatePresetLibrary(localLibrary);
  const imported = parseQuoteRatePresetLibrary(importedLibrary);
  const presets = [...local.presets];
  const usedIds = new Set(presets.map((preset) => preset.id));
  const touchedPresetIds: string[] = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const importedPreset of imported.presets) {
    const existingIndex = presets.findIndex(
      (preset) => normalizePresetName(preset.name) === normalizePresetName(importedPreset.name),
    );

    if (existingIndex >= 0) {
      const existingPreset = presets[existingIndex]!;
      const preset: QuoteRatePreset = {
        ...importedPreset,
        id: existingPreset.id,
        createdAt: existingPreset.createdAt,
        shopRates: cloneValidShopRates(importedPreset.shopRates),
      };
      presets[existingIndex] = preset;
      touchedPresetIds.push(preset.id);
      updatedCount += 1;
      continue;
    }

    const preset: QuoteRatePreset = {
      ...importedPreset,
      id: uniquePresetId(importedPreset.id, usedIds, options.idFactory),
      shopRates: cloneValidShopRates(importedPreset.shopRates),
    };
    presets.push(preset);
    touchedPresetIds.push(preset.id);
    addedCount += 1;
  }

  return {
    library: {
      version: 1,
      presets: sortedPresets(presets),
    },
    selectedPresetId: touchedPresetIds[0] ?? "",
    addedCount,
    updatedCount,
  };
}

export function saveQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  name: string,
  shopRates: HeatTreatShopRates,
  options: SaveQuoteRatePresetOptions = {},
): SaveQuoteRatePresetResult {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Rate preset name is required.");
  }

  const normalizedName = normalizePresetName(trimmedName);
  const existingPreset = library.presets.find((preset) => normalizePresetName(preset.name) === normalizedName);
  const timestamp = (options.now ?? new Date()).toISOString();
  const preset: QuoteRatePreset = existingPreset
    ? {
        ...existingPreset,
        name: trimmedName,
        shopRates: cloneValidShopRates(shopRates),
        updatedAt: timestamp,
      }
    : {
        id: options.idFactory?.() ?? createPresetId(),
        name: trimmedName,
        shopRates: cloneValidShopRates(shopRates),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
  const presets = existingPreset
    ? library.presets.map((item) => (item.id === existingPreset.id ? preset : item))
    : [...library.presets, preset];
  const nextLibrary: QuoteRatePresetLibrary = {
    version: 1,
    presets: sortedPresets(presets),
  };

  return {
    library: nextLibrary,
    preset,
  };
}

export function deleteQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  id: string,
): QuoteRatePresetLibrary {
  return {
    version: 1,
    presets: library.presets.filter((preset) => preset.id !== id),
  };
}

export function sortedQuoteRatePresets(library: QuoteRatePresetLibrary): readonly QuoteRatePreset[] {
  return sortedPresets(library.presets);
}

export function findQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  id: string,
): QuoteRatePreset | undefined {
  return library.presets.find((preset) => preset.id === id);
}

export function safeLocalStorage(): QuoteRatePresetStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseQuoteRatePresetLibrary(value: unknown): QuoteRatePresetLibrary {
  assertRecord(value);
  if (value.version !== 1 || !Array.isArray(value.presets)) {
    throw new Error("Invalid rate preset library.");
  }

  return {
    version: 1,
    presets: sortedPresets(value.presets.map(parseQuoteRatePreset)),
  };
}

function parseQuoteRatePreset(value: unknown): QuoteRatePreset {
  assertRecord(value);
  const id = requiredString(value.id, "id");
  const name = requiredString(value.name, "name");
  if (!name.trim()) {
    throw new Error("Invalid rate preset name.");
  }

  const createdAt = requiredIsoTimestamp(value.createdAt, "createdAt");
  const updatedAt = requiredIsoTimestamp(value.updatedAt, "updatedAt");

  return {
    id,
    name,
    shopRates: cloneValidShopRates(value.shopRates),
    createdAt,
    updatedAt,
  };
}

function cloneValidShopRates(value: unknown): HeatTreatShopRates {
  assertRecord(value);
  const targetMarginPercent = finiteNonNegativeRate(value.targetMarginPercent, "targetMarginPercent");
  if (targetMarginPercent >= 100) {
    throw new Error("Invalid shop rate: targetMarginPercent.");
  }

  return {
    minimumLotCharge: finiteNonNegativeRate(value.minimumLotCharge, "minimumLotCharge"),
    setupAdminCharge: finiteNonNegativeRate(value.setupAdminCharge, "setupAdminCharge"),
    laborRatePerHour: finiteNonNegativeRate(value.laborRatePerHour, "laborRatePerHour"),
    furnaceRatePerHour: finiteNonNegativeRate(value.furnaceRatePerHour, "furnaceRatePerHour"),
    bathQuenchRatePerHour: finiteNonNegativeRate(value.bathQuenchRatePerHour, "bathQuenchRatePerHour"),
    temperFurnaceRatePerHour: finiteNonNegativeRate(
      value.temperFurnaceRatePerHour,
      "temperFurnaceRatePerHour",
    ),
    inspectionBaseCharge: finiteNonNegativeRate(value.inspectionBaseCharge, "inspectionBaseCharge"),
    consumablesPerKg: finiteNonNegativeRate(value.consumablesPerKg, "consumablesPerKg"),
    handlingPackagingCharge: finiteNonNegativeRate(value.handlingPackagingCharge, "handlingPackagingCharge"),
    overheadPercent: finiteNonNegativeRate(value.overheadPercent, "overheadPercent"),
    targetMarginPercent,
  };
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected rate preset object.");
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid rate preset field: ${field}.`);
  }

  return value;
}

function requiredIsoTimestamp(value: unknown, field: string): string {
  const timestamp = requiredString(value, field);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`Invalid rate preset field: ${field}.`);
  }

  return timestamp;
}

function finiteNonNegativeRate(value: unknown, field: keyof HeatTreatShopRates): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid shop rate: ${field}.`);
  }

  return value;
}

function sortedPresets(presets: readonly QuoteRatePreset[]): readonly QuoteRatePreset[] {
  return [...presets].sort((left, right) => left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  }));
}

function normalizePresetName(name: string): string {
  return name.trim().toLowerCase();
}

function uniquePresetId(
  preferredId: string,
  usedIds: Set<string>,
  idFactory: (() => string) | undefined,
): string {
  let id = preferredId;
  while (usedIds.has(id)) {
    id = idFactory?.() ?? createPresetId();
  }
  usedIds.add(id);
  return id;
}

function createPresetId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `rate-${cryptoApi.randomUUID()}`;
  }

  return `rate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
