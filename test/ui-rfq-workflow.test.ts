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

    vi.spyOn(window, "prompt").mockReturnValue("Legacy RFQ");
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
    const confirmSpy = vi.spyOn(window, "confirm");
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

    saveRatePreset("Standard RFQ");

    expect(promptSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(quotePresetDialog().hidden).toBe(true);
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

  it("does not reuse the previous RFQ quote as stale after loading an incomplete project", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    enterQuoteBasisAndRates();

    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(quoteReportActionButton("open").disabled).toBe(false);
    const validLotPrice = recommendationText().match(/\$[0-9,.]+/)?.[0];
    expect(validLotPrice).toBeDefined();

    document.querySelector<HTMLButtonElement>("#save-project")?.click();
    expect(savedProjectBlob).not.toBeNull();
    const savedProject = JSON.parse(await savedProjectBlob!.text());
    delete savedProject.heatTreatQuote.input.lot.totalWeightKg;
    delete savedProject.heatTreatQuote.input.lot.loadCapacityKg;
    delete savedProject.heatTreatQuote.input.manualOverrides.billableFurnaceHours;
    delete savedProject.heatTreatQuote.input.manualOverrides.billableBathQuenchHours;
    delete savedProject.heatTreatQuote.input.manualOverrides.billableTemperHours;
    delete savedProject.heatTreatQuote.input.manualOverrides.billableLaborHours;

    await loadProject(JSON.stringify(savedProject));

    expect(recommendationText()).toContain("Current RFQ inputs need correction before a new quote can be calculated.");
    expect(recommendationText()).toContain("Enter lot weight and load capacity, or provide manual billable hours.");
    expect(recommendationText()).not.toContain("Showing last valid quote");
    expect(recommendationText()).not.toContain(validLotPrice!);
    expect(quoteAccordionStatusText("lot")).toBe("Needs input");
    expect(quoteSectionMessage("lot")).toBe("Enter lot weight and load capacity, or provide manual billable hours.");
  });

  it("shows custom RFQ rates when current shop rates differ from the selected preset", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
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

    saveRatePreset("Dirty RFQ");
    clickRatePresetAction("apply");

    expect(quoteAccordionStatusText("rates")).toContain("Dirty RFQ");
    expect(quoteReviewReadinessText()).toContain("Dirty RFQ");

    setQuoteNumber("shopRates.furnaceRatePerHour", "130");

    expect(quoteAccordionStatusText("rates")).not.toContain("Dirty RFQ");
    expect(quoteAccordionStatusText("rates")).toContain("Custom rates");
    expect(quoteReviewReadinessText()).not.toContain("Dirty RFQ");
    expect(quoteReviewReadinessText()).toContain("Custom rates");
  });

  it("refreshes RFQ review open checks when validation checklist items change", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("lot.quantity", "30");
    setQuoteNumber("lot.totalWeightKg", "150");
    setQuoteNumber("lot.loadCapacityKg", "75");
    setQuoteNumber("lot.laborHoursPerLoad", "0.75");
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

    const openCheckCount = uncheckedValidationChecklistChecks().length;
    expect(openCheckCount).toBeGreaterThan(0);
    expect(quoteReviewReadinessText()).toContain(`Open checks ${openCheckCount}`);

    const firstOpenCheck = uncheckedValidationChecklistChecks()[0]!;
    firstOpenCheck.checked = true;
    firstOpenCheck.dispatchEvent(new Event("change", { bubbles: true }));

    expect(quoteReviewReadinessText()).toContain(`Open checks ${openCheckCount - 1}`);
  });

  it("refreshes RFQ rate status when selecting a non-matching preset without applying it", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
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

    saveRatePreset("Preset A");
    setQuoteNumber("shopRates.furnaceRatePerHour", "130");
    saveRatePreset("Preset B");

    expect(quoteAccordionStatusText("rates")).toContain("Preset B");
    expect(quoteReviewReadinessText()).toContain("Preset B");

    selectRatePresetByName("Preset A");

    expect(quoteAccordionStatusText("rates")).toContain("Custom rates");
    expect(quoteAccordionStatusText("rates")).not.toContain("Preset B");
    expect(quoteReviewReadinessText()).toContain("Custom rates");
    expect(quoteReviewReadinessText()).not.toContain("Preset B");
  });

  it("shows RFQ margin validation at the field and section level", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    enterQuoteBasisAndRates();
    setQuoteNumber("shopRates.targetMarginPercent", "100");

    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("Target margin must be at least 0 and less than 100%.");
    expect(quoteControl<HTMLInputElement>("shopRates.targetMarginPercent").getAttribute("aria-invalid")).toBe("true");
    expect(quoteAccordionStatusText("rates")).toBe("Check rates");
    expect(quoteAccordionStatusText("review")).toBe("Needs correction");
    expect(recommendationText()).toContain("Showing last valid quote. Current inputs need correction.");
    expect(recommendationText()).toContain("Target margin must be at least 0 and less than 100%.");

    setQuoteNumber("shopRates.targetMarginPercent", "22");

    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("");
    expect(quoteControl<HTMLInputElement>("shopRates.targetMarginPercent").hasAttribute("aria-invalid")).toBe(false);
    expect(quoteAccordionStatusText("review")).toBe("Warnings");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
  });

  it("shows missing RFQ quote basis as a Lot & Capacity correction", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    expect(quoteAccordionStatusText("lot")).toBe("Needs input");
    expect(quoteSectionMessage("lot")).toBe("Enter lot weight and load capacity, or provide manual billable hours.");
    expect(quoteAccordionStatusText("review")).toBe("Needs correction");
    expect(recommendationText()).toContain("Current RFQ inputs need correction before a new quote can be calculated.");
    expect(recommendationText()).toContain("Enter lot weight and load capacity, or provide manual billable hours.");
  });

  it("keeps the last valid RFQ result visible as stale after an invalid edit", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    enterQuoteBasisAndRates();

    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(quoteReportActionButton("open").disabled).toBe(false);
    const validRecommendation = recommendationText();
    const validLotPrice = validRecommendation.match(/\$[0-9,.]+/)?.[0];
    expect(validLotPrice).toBeDefined();

    setQuoteNumber("shopRates.targetMarginPercent", "100");

    expect(recommendationText()).toContain("Showing last valid quote. Current inputs need correction.");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(recommendationText()).toContain("Target margin must be at least 0 and less than 100%.");
    expect(recommendationText()).toContain(validLotPrice!);
    expect(quoteReportActionButton("open").disabled).toBe(true);
    expect(quoteReportActionButton("print").disabled).toBe(true);
    expect(quoteReportActionButton("markdown").disabled).toBe(true);

    setQuoteNumber("shopRates.targetMarginPercent", "22");

    expect(recommendationText()).not.toContain("Showing last valid quote");
    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("");
    expect(quoteReportActionButton("open").disabled).toBe(false);
  });

  it("deletes RFQ shop-rate presets through an app-native confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    saveRatePreset("Delete Me RFQ");
    expect(ratePresetSelectText()).toContain("Delete Me RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "50");
    setQuoteNumber("shopRates.furnaceRatePerHour", "1");
    openDeleteRatePresetDialog();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(quotePresetDialogText()).toContain('Delete "Delete Me RFQ" from saved RFQ presets.');
    expect(quotePresetDialogText()).toContain("Current quote rates will not change.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Delete Preset");

    quotePresetDialogAction("confirm").click();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(quotePresetDialog().hidden).toBe(true);
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("50");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("1");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(ratePresetSelect().disabled).toBe(true);
    expect(ratePresetActionButton("apply").disabled).toBe(true);
    expect(ratePresetActionButton("delete").disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}").presets).toEqual([]);
  });

  it("cancels RFQ preset delete dialog without mutating presets", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    saveRatePreset("Keep RFQ");

    openDeleteRatePresetDialog();
    quotePresetDialogAction("cancel").click();

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Keep RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0]?.name).toBe("Keep RFQ");
  });

  it("closes RFQ preset dialogs with Escape and backdrop without mutating presets", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    openSaveRatePresetDialog();
    quotePresetDialogInput().value = "Escape RFQ";
    quotePresetDialogInput().dispatchEvent(new Event("input", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();

    saveRatePreset("Backdrop RFQ");
    openDeleteRatePresetDialog();
    quotePresetDialog().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Backdrop RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
  });

  it("validates RFQ preset names inside the save dialog without calling prompt", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Dialog RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    openSaveRatePresetDialog();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(quotePresetDialogInput().value).toBe("");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Save Preset");

    const input = quotePresetDialogInput();
    input.value = "   ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    quotePresetDialogAction("confirm").click();

    expect(quotePresetDialog().hidden).toBe(false);
    expect(quotePresetDialogMessage()).toBe("Preset name is required.");
    expect(quotePresetDialogInput().getAttribute("aria-invalid")).toBe("true");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();
    expect(promptSpy).not.toHaveBeenCalled();

    input.value = "Dialog RFQ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    quotePresetDialogAction("confirm").click();

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Dialog RFQ");
    expect(projectStatusText()).toBe('Saved rate preset "Dialog RFQ".');
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("updates existing RFQ presets from the save dialog without creating duplicates", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "300");
    setQuoteNumber("shopRates.furnaceRatePerHour", "90");
    saveRatePreset("Existing RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "725");
    setQuoteNumber("shopRates.furnaceRatePerHour", "155");
    openSaveRatePresetDialog();

    expect(quotePresetDialogInput().value).toBe("Existing RFQ");
    expect(quotePresetDialogText()).toContain("This will update the existing preset.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Update Preset");

    const input = quotePresetDialogInput();
    input.value = " existing rfq ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(quotePresetDialogText()).toContain("This will update the existing preset.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Update Preset");

    quotePresetDialogAction("confirm").click();

    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0]?.name).toBe("existing rfq");
    expect(stored.presets[0]?.shopRates.minimumLotCharge).toBe(725);
    expect(stored.presets[0]?.shopRates.furnaceRatePerHour).toBe(155);
    expect(ratePresetSelectText()).toContain("existing rfq");
  });

  it("exports RFQ shop-rate presets as a preset library JSON file", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    saveRatePreset("Exported RFQ");
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

  it("cleans up RFQ preset export downloads when the browser click fails", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloadNames.push(this.download);
      throw new Error("Download blocked");
    });
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    saveRatePreset("Blocked Export RFQ");
    clickRatePresetAction("export");

    expect(projectStatusText()).toBe("Could not export presets. Try again or check browser download permissions.");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:htcalc-1");
    expect(document.querySelector('a[download^="htcalc-rfq-rate-presets-"]')).toBeNull();
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
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "300");
    setQuoteNumber("shopRates.furnaceRatePerHour", "90");
    saveRatePreset("Merge RFQ");

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
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    saveRatePreset("Existing RFQ");
    await importRatePresetFile("{");

    expect(projectStatusText()).toBe("Could not import presets. Choose a valid HTCalc RFQ preset file.");
    expect(ratePresetSelectText()).toContain("Existing RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets.map((preset) => preset.name)).toEqual(["Existing RFQ"]);
  });

  it("renders RFQ inputs as staged accordion sections with accessible defaults", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    expect(quoteAccordionText("source")).toContain("Source & Assumptions");
    expect(quoteAccordionText("source")).toContain("Manual");
    expect(quoteAccordionButton("source").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("source").hidden).toBe(false);

    expect(quoteAccordionText("lot")).toContain("Lot & Capacity");
    expect(quoteAccordionText("lot")).toContain("Needs input");
    expect(quoteSectionMessage("lot")).toBe("Enter lot weight and load capacity, or provide manual billable hours.");
    expect(quoteAccordionButton("lot").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("lot").hidden).toBe(false);

    expect(quoteAccordionText("rates")).toContain("Shop Rates");
    expect(quoteAccordionText("rates")).toContain("No preset");
    expect(quoteAccordionButton("rates").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("rates").hidden).toBe(false);

    expect(quoteAccordionText("adjustments")).toContain("Overrides & Adjustments");
    expect(quoteAccordionText("adjustments")).toContain("Optional");
    expect(quoteAccordionButton("adjustments").getAttribute("aria-expanded")).toBe("false");
    expect(quoteAccordionPanel("adjustments").hidden).toBe(true);

    expect(quoteAccordionText("review")).toContain("Review & Export Readiness");
    expect(quoteAccordionPanel("review").hidden).toBe(false);
    expect(quoteReviewReadinessText()).toContain("Heat-treatment service pricing only");
  });

  it("toggles RFQ override staging without losing entered quote values", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(false);

    setQuoteNumber("manualOverrides.billableFurnaceHours", "2.5");
    setQuoteNumber("adjustments.manualAdderDiscount", "-25");
    expect(quoteAccordionText("adjustments")).toContain("Overrides active");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(true);
    expect(quoteControl<HTMLInputElement>("manualOverrides.billableFurnaceHours").value).toBe("2.5");
    expect(quoteControl<HTMLInputElement>("adjustments.manualAdderDiscount").value).toBe("-25");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(false);
    expect(quoteControl<HTMLInputElement>("manualOverrides.billableFurnaceHours").value).toBe("2.5");
    expect(quoteControl<HTMLInputElement>("adjustments.manualAdderDiscount").value).toBe("-25");
  });

  it("updates RFQ review readiness while preserving rate preset workflows", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("lot.quantity", "30");
    setQuoteNumber("lot.totalWeightKg", "150");
    setQuoteNumber("lot.loadCapacityKg", "75");
    setQuoteNumber("lot.laborHoursPerLoad", "0.75");
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

    expect(quoteReviewReadinessText()).toContain("Manual heat-treatment quote");
    expect(quoteReviewReadinessText()).toContain("Warnings");
    expect(quoteReviewReadinessText()).toContain("Open checks");

    saveRatePreset("Staged RFQ");
    expect(quoteAccordionText("rates")).toContain("Staged RFQ");

    setQuoteNumber("shopRates.furnaceRatePerHour", "5");
    clickRatePresetAction("apply");

    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(quoteReviewReadinessText()).toContain("Staged RFQ");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
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

function enterQuoteBasisAndRates(): void {
  setQuoteNumber("lot.quantity", "30");
  setQuoteNumber("lot.totalWeightKg", "150");
  setQuoteNumber("lot.loadCapacityKg", "75");
  setQuoteNumber("lot.laborHoursPerLoad", "0.75");
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
}

type QuoteAccordionSection = "source" | "lot" | "rates" | "adjustments" | "review";

function quoteAccordionButton(section: QuoteAccordionSection): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-accordion-toggle="${section}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function quoteAccordionPanel(section: QuoteAccordionSection): HTMLDivElement {
  const panel = document.querySelector<HTMLDivElement>(`[data-quote-accordion-panel="${section}"]`);
  expect(panel).not.toBeNull();
  return panel!;
}

function quoteAccordionText(section: QuoteAccordionSection): string {
  const container = document.querySelector<HTMLElement>(`[data-quote-accordion-section="${section}"]`);
  expect(container).not.toBeNull();
  return compactText(container!.textContent ?? "");
}

function quoteAccordionStatusText(section: QuoteAccordionSection): string {
  const status = document.querySelector<HTMLElement>(`[data-quote-accordion-status="${section}"]`);
  expect(status).not.toBeNull();
  return compactText(status!.textContent ?? "");
}

function quoteFieldMessage(path: string): string {
  const message = document.querySelector<HTMLElement>(`[data-quote-field-message-for="${path}"]`);
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

function quoteSectionMessage(section: QuoteAccordionSection): string {
  const message = document.querySelector<HTMLElement>(`[data-quote-section-message-for="${section}"]`);
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

type QuoteReportAction = "open" | "print" | "markdown";

function quoteReportActionButton(action: QuoteReportAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-report-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function quoteReviewReadinessText(): string {
  const readiness = document.querySelector("[data-quote-review-readiness]");
  return compactText(Array
    .from(readiness?.querySelectorAll("dt, dd, .quote-review-note") ?? [])
    .map((element) => element.textContent ?? "")
    .join(" "));
}

type RatePresetAction = "apply" | "save" | "import" | "export" | "delete";

function clickRatePresetAction(action: RatePresetAction): void {
  ratePresetActionButton(action).click();
}

type QuotePresetDialogAction = "confirm" | "cancel";

function quotePresetDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>("[data-quote-rate-preset-dialog]");
  expect(dialog).not.toBeNull();
  return dialog!;
}

function quotePresetDialogText(): string {
  return compactText(quotePresetDialog().textContent ?? "");
}

function quotePresetDialogInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("[data-quote-rate-preset-dialog-name]");
  expect(input).not.toBeNull();
  return input!;
}

function quotePresetDialogMessage(): string {
  const message = document.querySelector<HTMLElement>("[data-quote-rate-preset-dialog-message]");
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

function quotePresetDialogAction(action: QuotePresetDialogAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-rate-preset-dialog-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function openSaveRatePresetDialog(): void {
  clickRatePresetAction("save");
  expect(quotePresetDialog().hidden).toBe(false);
  expect(quotePresetDialogText()).toContain("Save Rate Preset");
}

function saveRatePreset(name: string): void {
  openSaveRatePresetDialog();
  const input = quotePresetDialogInput();
  input.value = name;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  quotePresetDialogAction("confirm").click();
}

function openDeleteRatePresetDialog(): void {
  clickRatePresetAction("delete");
  expect(quotePresetDialog().hidden).toBe(false);
  expect(quotePresetDialogText()).toContain("Delete Rate Preset");
}

function ratePresetSelectText(): string {
  return compactText(ratePresetSelect().textContent ?? "");
}

function ratePresetSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("#quote-rate-preset-select");
  expect(select).not.toBeNull();
  return select!;
}

function selectRatePresetByName(name: string): void {
  const select = ratePresetSelect();
  const option = Array.from(select.options).find((item) => item.textContent === name);
  expect(option).not.toBeUndefined();
  select.value = option!.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function uncheckedValidationChecklistChecks(): HTMLInputElement[] {
  return Array
    .from(document.querySelectorAll<HTMLInputElement>("[data-checklist-check]"))
    .filter((control) => !control.checked);
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
