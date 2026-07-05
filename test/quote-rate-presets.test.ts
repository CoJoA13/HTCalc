import { describe, expect, it } from "vitest";
import type { HeatTreatShopRates } from "../src/quote/index.js";
import {
  QUOTE_RATE_PRESETS_STORAGE_KEY,
  deleteQuoteRatePreset,
  findQuoteRatePreset,
  loadQuoteRatePresetLibrary,
  mergeQuoteRatePresetLibraries,
  parseQuoteRatePresetLibraryJson,
  persistQuoteRatePresetLibrary,
  quoteRatePresetExportFilename,
  saveQuoteRatePreset,
  serializeQuoteRatePresetLibrary,
  sortedQuoteRatePresets,
  type QuoteRatePreset,
  type QuoteRatePresetLibrary,
} from "../src/ui/quote-rate-presets.js";

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ThrowingSetStorage extends FakeStorage {
  override setItem(): void {
    throw new Error("Storage write failed.");
  }
}

const sampleRates: HeatTreatShopRates = {
  minimumLotCharge: 500,
  setupAdminCharge: 100,
  laborRatePerHour: 80,
  furnaceRatePerHour: 120,
  bathQuenchRatePerHour: 90,
  temperFurnaceRatePerHour: 75,
  inspectionBaseCharge: 50,
  consumablesPerKg: 0.5,
  handlingPackagingCharge: 25,
  overheadPercent: 18,
  targetMarginPercent: 22,
};

function makePreset(id: string, name: string): QuoteRatePreset {
  return {
    id,
    name,
    shopRates: sampleRates,
    createdAt: "2026-07-05T12:00:00.000Z",
    updatedAt: "2026-07-05T12:00:00.000Z",
  };
}

describe("quote rate presets", () => {
  it("returns an empty library when storage is empty", () => {
    expect(loadQuoteRatePresetLibrary(new FakeStorage())).toEqual({
      version: 1,
      presets: [],
    });
  });

  it("saves a new preset with generated id and timestamps", () => {
    const result = saveQuoteRatePreset(
      { version: 1, presets: [] },
      " Standard RFQ ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );

    expect(result.preset).toEqual({
      id: "preset-1",
      name: "Standard RFQ",
      shopRates: sampleRates,
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-05T12:00:00.000Z",
    });
    expect(result.library.presets).toEqual([result.preset]);
  });

  it("overwrites an existing preset by case-insensitive trimmed name", () => {
    const first = saveQuoteRatePreset(
      { version: 1, presets: [] },
      "Standard RFQ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );
    const replacementRates = {
      ...sampleRates,
      furnaceRatePerHour: 140,
    };
    const second = saveQuoteRatePreset(
      first.library,
      " standard rfq ",
      replacementRates,
      {
        idFactory: () => "preset-2",
        now: new Date("2026-07-05T12:30:00.000Z"),
      },
    );

    expect(second.library.presets).toHaveLength(1);
    expect(second.preset).toMatchObject({
      id: "preset-1",
      name: "standard rfq",
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-05T12:30:00.000Z",
      shopRates: replacementRates,
    });
  });

  it("deletes a preset without mutating other presets", () => {
    const first = saveQuoteRatePreset(
      { version: 1, presets: [] },
      "Standard RFQ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );
    const second = saveQuoteRatePreset(
      first.library,
      "Premium RFQ",
      { ...sampleRates, minimumLotCharge: 750 },
      {
        idFactory: () => "preset-2",
        now: new Date("2026-07-05T12:05:00.000Z"),
      },
    );

    const library = deleteQuoteRatePreset(second.library, "preset-1");

    expect(library.presets.map((preset) => preset.id)).toEqual(["preset-2"]);
  });

  it("returns an empty library when stored JSON is malformed", () => {
    const storage = new FakeStorage();
    storage.setItem(QUOTE_RATE_PRESETS_STORAGE_KEY, "{");

    expect(loadQuoteRatePresetLibrary(storage)).toEqual({
      version: 1,
      presets: [],
    });
  });

  it("persists a validated library to storage", () => {
    const storage = new FakeStorage();
    const library: QuoteRatePresetLibrary = {
      version: 1,
      presets: [makePreset("preset-2", "Premium RFQ"), makePreset("preset-1", "Standard RFQ")],
    };

    expect(persistQuoteRatePresetLibrary(library, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "")).toEqual(library);
  });

  it("throws validation errors before persisting an invalid library", () => {
    const storage = new FakeStorage();
    const invalidLibrary = {
      version: 1,
      presets: [
        {
          ...makePreset("preset-1", "Invalid RFQ"),
          shopRates: { ...sampleRates, furnaceRatePerHour: -1 },
        },
      ],
    } as QuoteRatePresetLibrary;

    expect(() => persistQuoteRatePresetLibrary(invalidLibrary, storage)).toThrow(
      "Invalid shop rate: furnaceRatePerHour.",
    );
    expect(storage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();
  });

  it("returns false when storage rejects a persisted library", () => {
    expect(
      persistQuoteRatePresetLibrary(
        { version: 1, presets: [makePreset("preset-1", "Standard RFQ")] },
        new ThrowingSetStorage(),
      ),
    ).toBe(false);
  });

  it("finds a preset by id", () => {
    const standard = makePreset("preset-1", "Standard RFQ");
    const premium = makePreset("preset-2", "Premium RFQ");
    const library: QuoteRatePresetLibrary = {
      version: 1,
      presets: [standard, premium],
    };

    expect(findQuoteRatePreset(library, "preset-2")).toBe(premium);
    expect(findQuoteRatePreset(library, "missing")).toBeUndefined();
  });

  it("returns presets sorted by name", () => {
    const library: QuoteRatePresetLibrary = {
      version: 1,
      presets: [makePreset("preset-1", "Standard RFQ"), makePreset("preset-2", "Premium RFQ")],
    };

    expect(sortedQuoteRatePresets(library).map((preset) => preset.id)).toEqual(["preset-2", "preset-1"]);
  });

  it("serializes and parses preset library JSON", () => {
    const library: QuoteRatePresetLibrary = {
      version: 1,
      presets: [makePreset("preset-1", "Standard RFQ")],
    };

    const serialized = serializeQuoteRatePresetLibrary(library);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(parseQuoteRatePresetLibraryJson(serialized)).toEqual(library);
  });

  it("rejects malformed preset import JSON and invalid library shapes", () => {
    expect(() => parseQuoteRatePresetLibraryJson("{")).toThrow();
    expect(() => parseQuoteRatePresetLibraryJson(JSON.stringify({ version: 2, presets: [] }))).toThrow(
      "Invalid rate preset library.",
    );
  });

  it("builds rate preset export filenames from the export date", () => {
    expect(quoteRatePresetExportFilename(new Date("2026-07-05T12:00:00.000Z"))).toBe(
      "htcalc-rfq-rate-presets-2026-07-05.json",
    );
  });

  it("merges imported presets by case-insensitive name and reports counts", () => {
    const localPreset = makePreset("local-1", "Standard RFQ");
    const importedPreset: QuoteRatePreset = {
      ...makePreset("imported-1", " standard rfq "),
      shopRates: { ...sampleRates, furnaceRatePerHour: 150 },
      updatedAt: "2026-07-05T13:00:00.000Z",
    };

    const result = mergeQuoteRatePresetLibraries(
      { version: 1, presets: [localPreset] },
      { version: 1, presets: [importedPreset] },
    );

    expect(result.addedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.selectedPresetId).toBe("local-1");
    expect(result.library.presets).toEqual([
      {
        ...importedPreset,
        id: "local-1",
        createdAt: localPreset.createdAt,
      },
    ]);
  });

  it("adds imported presets and avoids id collisions", () => {
    const localPreset = makePreset("preset-1", "Local RFQ");
    const importedPreset = makePreset("preset-1", "Imported RFQ");

    const result = mergeQuoteRatePresetLibraries(
      { version: 1, presets: [localPreset] },
      { version: 1, presets: [importedPreset] },
      { idFactory: () => "imported-2" },
    );

    expect(result.addedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.selectedPresetId).toBe("imported-2");
    expect(result.library.presets.map((preset) => preset.id).sort()).toEqual(["imported-2", "preset-1"]);
    expect(findQuoteRatePreset(result.library, "imported-2")).toMatchObject({
      name: "Imported RFQ",
      shopRates: sampleRates,
    });
  });

  it("rejects invalid shop-rate values when saving or loading", () => {
    expect(() => {
      saveQuoteRatePreset(
        { version: 1, presets: [] },
        "Invalid RFQ",
        { ...sampleRates, furnaceRatePerHour: -1 },
        {
          idFactory: () => "preset-1",
          now: new Date("2026-07-05T12:00:00.000Z"),
        },
      );
    }).toThrow("Invalid shop rate: furnaceRatePerHour.");

    const storage = new FakeStorage();
    storage.setItem(
      QUOTE_RATE_PRESETS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        presets: [
          {
            id: "preset-1",
            name: "Invalid RFQ",
            shopRates: { ...sampleRates, targetMarginPercent: 100 },
            createdAt: "2026-07-05T12:00:00.000Z",
            updatedAt: "2026-07-05T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(loadQuoteRatePresetLibrary(storage)).toEqual({
      version: 1,
      presets: [],
    });
  });
});
