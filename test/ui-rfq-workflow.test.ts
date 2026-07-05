/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let savedProjectBlob: Blob | null = null;
let createdObjectUrlBlobs: Blob[] = [];
let clickedDownloadNames: string[] = [];
let originalCreateObjectUrlDescriptor: PropertyDescriptor | undefined;
let originalRevokeObjectUrlDescriptor: PropertyDescriptor | undefined;
let originalPrintDescriptor: PropertyDescriptor | undefined;

describe("Heat-Treat RFQ UI workflow", () => {
  beforeEach(() => {
    vi.resetModules();
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
    vi.restoreAllMocks();
    restoreProperty(URL, "createObjectURL", originalCreateObjectUrlDescriptor);
    restoreProperty(URL, "revokeObjectURL", originalRevokeObjectUrlDescriptor);
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
