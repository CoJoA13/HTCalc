/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let savedProjectBlob: Blob | null = null;

describe("Heat-Treat RFQ UI workflow", () => {
  beforeEach(() => {
    vi.resetModules();
    savedProjectBlob = null;
    document.body.innerHTML = `<div id="app"></div>`;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        savedProjectBlob = blob;
        return "blob:htcalc-project";
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

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    document.querySelector<HTMLButtonElement>('[data-quote-report-action="open"]')?.click();
    expect(reportText()).toContain("Quote Summary");
    expect(reportText()).toContain("Price/lb");
    expect(reportText()).not.toContain("Price/kg");
    document.querySelector<HTMLButtonElement>("#report-close")?.click();

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
