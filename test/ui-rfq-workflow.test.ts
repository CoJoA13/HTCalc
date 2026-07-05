/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_RATE_PRESETS_STORAGE_KEY,
  type QuoteRatePresetLibrary,
} from "../src/ui/quote-rate-presets.js";

let savedProjectBlob: Blob | null = null;
let createdObjectUrlBlobs: Blob[] = [];
let clickedDownloadNames: string[] = [];
let originalCreateObjectUrlDescriptor: PropertyDescriptor | undefined;
let originalRevokeObjectUrlDescriptor: PropertyDescriptor | undefined;
let originalLocalStorageDescriptor: PropertyDescriptor | undefined;
let originalPrintDescriptor: PropertyDescriptor | undefined;

describe("Heat-Treat RFQ UI workflow", () => {
  beforeEach(() => {
    vi.resetModules();
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    installLocalStorageShim();
    window.localStorage.clear();
    savedProjectBlob = null;
    createdObjectUrlBlobs = [];
    clickedDownloadNames = [];
    originalCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    originalRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    originalPrintDescriptor = Object.getOwnPropertyDescriptor(window, "print");
    document.body.innerHTML = `<div id="app"></div>`;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        createdObjectUrlBlobs.push(blob);
        if (blob.type === "application/json") {
          savedProjectBlob = blob;
        }
        return `blob:htcalc-${createdObjectUrlBlobs.length}`;
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "print", {
      configurable: true,
      value: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloadNames.push(this.download);
      return undefined;
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    restoreProperty(URL, "createObjectURL", originalCreateObjectUrlDescriptor);
    restoreProperty(URL, "revokeObjectURL", originalRevokeObjectUrlDescriptor);
    restoreProperty(window, "localStorage", originalLocalStorageDescriptor);
    restoreProperty(window, "print", originalPrintDescriptor);
    document.body.innerHTML = "";
  });

  it("imports ADI assumptions, switches RFQ units, saves, reloads, and renders the printable report", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    selectQuoteSource("adi");
    setQuoteNumber("lot.quantity", "40");
    setQuoteNumber("lot.totalWeightKg", "220");
    setQuoteNumber("lot.loadCapacityKg", "110");
    setQuoteNumber("lot.laborHoursPerLoad", "0.5");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.setupAdminCharge", "100");
    setQuoteNumber("shopRates.laborRatePerHour", "80");
    setQuoteNumber("shopRates.furnaceRatePerHour", "120");
    setQuoteNumber("shopRates.bathQuenchRatePerHour", "90");
    setQuoteNumber("shopRates.temperFurnaceRatePerHour", "75");
    setQuoteNumber("shopRates.inspectionBaseCharge", "50");
    setQuoteNumber("shopRates.consumablesPerKg", "0.5");
    setQuoteNumber("shopRates.handlingPackagingCharge", "25");

    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(recommendationText()).toContain("Imported Assumptions");
    expect(recommendationText()).toContain("Validation Checks");
    expect(document.querySelector('[data-quote-report-action="open"]')).not.toBeNull();
    expect(document.querySelector('[data-quote-report-action="print"]')).not.toBeNull();
    expect(document.querySelector('[data-quote-report-action="markdown"]')).not.toBeNull();

    switchUnits("metric");
    expect(metricStripText()).toContain("Price/kg");
    expect(metricStripText()).toContain("/kg");

    switchUnits("imperial");
    expect(metricStripText()).toContain("Price/lb");
    expect(metricStripText()).toContain("/lb");
    expect(metricStripText()).not.toContain("Price/kg");
    expect(metricStripText()).not.toContain("/kg");
    expect(recommendationText()).toContain("Price per lb");
    expect(recommendationText()).not.toContain("Price per kg");

    document.querySelector<HTMLButtonElement>('[data-quote-report-action="open"]')?.click();
    expect(reportText()).toContain("Quote Summary");
    expect(reportText()).toContain("Price/lb");
    expect(reportText()).not.toContain("Price/kg");
    expect(reportText()).toContain("Price per lb");
    expect(reportText()).not.toContain("Price per kg");
    document.querySelector<HTMLButtonElement>("#report-close")?.click();

    document.querySelector<HTMLButtonElement>('[data-quote-report-action="print"]')?.click();
    await nextAnimationFrame();
    expect(window.print).toHaveBeenCalledOnce();
    document.querySelector<HTMLButtonElement>("#report-close")?.click();

    document.querySelector<HTMLButtonElement>('[data-quote-report-action="markdown"]')?.click();
    const markdownBlob = latestCreatedBlob();
    const markdownText = await markdownBlob.text();
    expect(clickedDownloadNames.at(-1)).toMatch(/\.md$/);
    expect(markdownText).toContain("# HTCalc Heat-Treat RFQ Report");
    expect(markdownText).toContain("## Quote Summary");
    expect(markdownText).toContain("Price per lb");
    expect(markdownText).not.toContain("Price per kg");

    document.querySelector<HTMLButtonElement>("#save-project")?.click();
    expect(savedProjectBlob).not.toBeNull();
    const savedProjectJson = await savedProjectBlob!.text();
    expect(JSON.parse(savedProjectJson)).toMatchObject({
      activeModeId: "heat-treat-rfq",
      unitSystem: "imperial",
    });

    await loadProject(savedProjectJson);

    expect(document.querySelector<HTMLButtonElement>('[data-process-mode="heat-treat-rfq"]')?.className).toContain("is-active");
    expect(metricStripText()).toContain("Price/lb");
    expect(metricStripText()).not.toContain("Price/kg");
    expect(document.querySelector('[data-quote-report-action="open"]')).not.toBeNull();
  });

  it("saves, applies, and preserves RFQ shop-rate presets through project files", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Standard RFQ");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("lot.quantity", "25");
    setQuoteNumber("lot.totalWeightKg", "100");
    setQuoteNumber("lot.loadCapacityKg", "100");
    setQuoteNumber("lot.laborHoursPerLoad", "1");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.setupAdminCharge", "100");
    setQuoteNumber("shopRates.laborRatePerHour", "90");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    setQuoteNumber("shopRates.bathQuenchRatePerHour", "95");
    setQuoteNumber("shopRates.temperFurnaceRatePerHour", "80");
    setQuoteNumber("shopRates.inspectionBaseCharge", "60");
    setQuoteNumber("shopRates.consumablesPerKg", "0.55");
    setQuoteNumber("shopRates.handlingPackagingCharge", "30");
    setQuoteNumber("shopRates.overheadPercent", "18");
    setQuoteNumber("shopRates.targetMarginPercent", "22");

    clickRatePresetAction("save");

    expect(promptSpy).toHaveBeenCalledOnce();
    expect(ratePresetSelectText()).toContain("Standard RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "50");
    setQuoteNumber("shopRates.furnaceRatePerHour", "1");
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("50");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("1");

    clickRatePresetAction("apply");

    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("500");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(recommendationText()).toContain("Heat-Treat RFQ");

    document.querySelector<HTMLButtonElement>("#save-project")?.click();
    expect(savedProjectBlob).not.toBeNull();
    const savedProjectJson = await savedProjectBlob!.text();
    expect(JSON.parse(savedProjectJson).heatTreatQuote.input.shopRates).toMatchObject({
      minimumLotCharge: 500,
      furnaceRatePerHour: 125,
      targetMarginPercent: 22,
    });

    setQuoteNumber("shopRates.furnaceRatePerHour", "3");
    await loadProject(savedProjectJson);

    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
  });

  it("deletes RFQ shop-rate presets without changing current quote rates", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Delete Me RFQ");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");

    clickRatePresetAction("save");
    expect(ratePresetSelectText()).toContain("Delete Me RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "50");
    setQuoteNumber("shopRates.furnaceRatePerHour", "1");

    clickRatePresetAction("delete");

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("50");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("1");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(ratePresetSelect().disabled).toBe(true);
    expect(ratePresetActionButton("apply").disabled).toBe(true);
    expect(ratePresetActionButton("delete").disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}").presets).toEqual([]);
  });

  it("requires a name before saving RFQ shop-rate presets", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("   ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    clickRatePresetAction("save");

    expect(projectStatusText()).toBe("Preset name is required. No rates were saved.");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();
  });

  it("exports RFQ shop-rate presets as a preset library JSON file", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Exported RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    clickRatePresetAction("save");
    clickRatePresetAction("export");

    expect(clickedDownloadNames.at(-1)).toMatch(/^htcalc-rfq-rate-presets-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await latestCreatedBlob().text()) as QuoteRatePresetLibrary;
    expect(exported).toMatchObject({
      version: 1,
      presets: [
        {
          name: "Exported RFQ",
          shopRates: {
            minimumLotCharge: 500,
            furnaceRatePerHour: 125,
          },
        },
      ],
    });
  });

  it("imports RFQ shop-rate presets into an empty local library", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    await importRatePresetFile(presetLibraryJson("Imported RFQ"));

    expect(ratePresetSelectText()).toContain("Imported RFQ");
    expect(projectStatusText()).toBe("Imported rate presets: 1 added, 0 updated.");
    expect(ratePresetActionButton("apply").disabled).toBe(false);
    expect(ratePresetActionButton("export").disabled).toBe(false);
  });

  it("merges imported RFQ shop-rate presets by name", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Merge RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "300");
    setQuoteNumber("shopRates.furnaceRatePerHour", "90");
    clickRatePresetAction("save");

    await importRatePresetFile(presetLibraryJson(" merge rfq ", {
      minimumLotCharge: 850,
      furnaceRatePerHour: 175,
    }));
    expect(projectStatusText()).toBe("Imported rate presets: 0 added, 1 updated.");
    clickRatePresetAction("apply");

    expect(projectStatusText()).toBe("Applied rate preset \"merge rfq\".");
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("850");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("175");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
  });

  it("rejects invalid RFQ preset import files without changing existing presets", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Existing RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    clickRatePresetAction("save");
    await importRatePresetFile("{");

    expect(projectStatusText()).toBe("Could not import presets. Choose a valid HTCalc RFQ preset file.");
    expect(ratePresetSelectText()).toContain("Existing RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets.map((preset) => preset.name)).toEqual(["Existing RFQ"]);
  });
});

function clickMode(modeId: string): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-process-mode="${modeId}"]`);
  expect(button).not.toBeNull();
  button!.click();
}

function selectQuoteSource(sourceMode: string): void {
  const select = quoteControl<HTMLSelectElement>("sourceMode");
  select.value = sourceMode;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setQuoteNumber(path: string, value: string): void {
  const input = quoteControl<HTMLInputElement>(path);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

type RatePresetAction = "apply" | "save" | "import" | "export" | "delete";

function clickRatePresetAction(action: RatePresetAction): void {
  ratePresetActionButton(action).click();
}

function ratePresetSelectText(): string {
  return compactText(ratePresetSelect().textContent ?? "");
}

function ratePresetSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("#quote-rate-preset-select");
  expect(select).not.toBeNull();
  return select!;
}

function projectStatusText(): string {
  return compactText(document.querySelector("#project-status")?.textContent ?? "");
}

async function importRatePresetFile(contents: string, filename = "presets.json"): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#quote-rate-preset-import-input");
  expect(input).not.toBeNull();
  const file = new File([contents], filename, { type: "application/json" });
  Object.defineProperty(input!, "files", {
    configurable: true,
    value: [file],
  });
  input!.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function presetLibraryJson(name: string, overrides: Partial<QuoteRatePresetLibrary["presets"][number]["shopRates"]> = {}): string {
  return JSON.stringify({
    version: 1,
    presets: [
      {
        id: `imported-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        shopRates: {
          minimumLotCharge: 700,
          setupAdminCharge: 110,
          laborRatePerHour: 95,
          furnaceRatePerHour: 150,
          bathQuenchRatePerHour: 105,
          temperFurnaceRatePerHour: 85,
          inspectionBaseCharge: 65,
          consumablesPerKg: 0.65,
          handlingPackagingCharge: 35,
          overheadPercent: 19,
          targetMarginPercent: 24,
          ...overrides,
        },
        createdAt: "2026-07-05T14:00:00.000Z",
        updatedAt: "2026-07-05T14:00:00.000Z",
      },
    ],
  });
}

function ratePresetActionButton(action: RatePresetAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-rate-preset-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function switchUnits(unitSystem: "imperial" | "metric"): void {
  document.querySelector<HTMLButtonElement>("#settings-open")?.click();
  const input = document.querySelector<HTMLInputElement>(`input[name="unit-system"][value="${unitSystem}"]`);
  expect(input).not.toBeNull();
  input!.checked = true;
  input!.dispatchEvent(new Event("change", { bubbles: true }));
}

function quoteControl<T extends HTMLInputElement | HTMLSelectElement>(path: string): T {
  const control = document.querySelector<T>(`[data-quote-path="${path}"]`);
  expect(control).not.toBeNull();
  return control!;
}

function recommendationText(): string {
  return compactText(document.querySelector("#recommendation")?.textContent ?? "");
}

function metricStripText(): string {
  return compactText(document.querySelector(".metric-strip")?.textContent ?? "");
}

function reportText(): string {
  return compactText(document.querySelector("#report-document")?.textContent ?? "");
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function latestCreatedBlob(): Blob {
  const blob = createdObjectUrlBlobs.at(-1);
  expect(blob).not.toBeUndefined();
  return blob!;
}

async function nextAnimationFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }

  Reflect.deleteProperty(target, property);
}

function installLocalStorageShim(): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorageShim(),
  });
}

function createStorageShim(): Storage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear: vi.fn(() => {
      items.clear();
    }),
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(items.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      items.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, String(value));
    }),
  };
}

async function loadProject(projectJson: string): Promise<void> {
  const fileInput = document.querySelector<HTMLInputElement>("#project-file-input");
  expect(fileInput).not.toBeNull();
  const file = new File([projectJson], "rfq.htcalc.json", { type: "application/json" });
  Object.defineProperty(fileInput!, "files", {
    configurable: true,
    value: [file],
  });
  fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
