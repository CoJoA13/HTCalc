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

  it("marks all current process families as implemented", () => {
    expect(getProcessMode("adi").status).toBe("implemented");
    expect(getProcessMode("steel-austempering").status).toBe("implemented");
    expect(getProcessMode("martempering").status).toBe("implemented");
  });

  it("exposes all implemented process modes", () => {
    expect(implementedProcessModes().map((mode) => mode.id)).toEqual([
      "adi",
      "steel-austempering",
      "martempering",
    ]);
    expect(plannedProcessModes()).toEqual([]);
  });
});
