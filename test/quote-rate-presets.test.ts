import { describe, expect, it } from "vitest";
import type { HeatTreatShopRates } from "../src/quote/index.js";
import {
  QUOTE_RATE_PRESETS_STORAGE_KEY,
  deleteQuoteRatePreset,
  loadQuoteRatePresetLibrary,
  saveQuoteRatePreset,
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
