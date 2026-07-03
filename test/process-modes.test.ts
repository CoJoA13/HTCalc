import { describe, expect, it } from "vitest";
import {
  getProcessMode,
  implementedProcessModes,
  plannedProcessModes,
  PROCESS_MODES,
} from "../src/ui/process-modes.js";

describe("process mode metadata", () => {
  it("defines the planned process families in shell order", () => {
    expect(PROCESS_MODES.map((mode) => mode.id)).toEqual([
      "adi",
      "steel-austempering",
      "martempering",
    ]);
  });

  it("marks ADI as implemented and future modes as planned", () => {
    expect(getProcessMode("adi").status).toBe("implemented");
    expect(getProcessMode("steel-austempering").status).toBe("planned");
    expect(getProcessMode("martempering").status).toBe("planned");
  });

  it("exposes planned input groups for unimplemented modes", () => {
    for (const mode of plannedProcessModes()) {
      expect(mode.plannedInputs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("splits implemented and planned modes", () => {
    expect(implementedProcessModes().map((mode) => mode.id)).toEqual(["adi"]);
    expect(plannedProcessModes().map((mode) => mode.id)).toEqual([
      "steel-austempering",
      "martempering",
    ]);
  });
});
