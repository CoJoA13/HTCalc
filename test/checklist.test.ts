import { describe, expect, it } from "vitest";
import {
  reconcileValidationChecklist,
  validationChecklistId,
} from "../src/ui/checklist.js";
import type { ValidationChecklistState } from "../src/ui/project-state.js";

describe("validation checklist helpers", () => {
  it("generates stable normalized IDs from validation labels", () => {
    expect(validationChecklistId("  Metallography: Nodularity & Carbides!  ")).toBe(
      "metallography-nodularity-carbides",
    );
    expect(validationChecklistId("Tensile test to ASTM A897.")).toBe("tensile-test-to-astm-a897");
  });

  it("preserves checked and notes state for unchanged validation labels", () => {
    const label = "Tensile test to ASTM A897.";
    const previous: ValidationChecklistState = {
      items: [
        {
          id: validationChecklistId(label),
          label,
          checked: true,
          notes: "Coupon A passed.",
        },
      ],
    };

    const reconciled = reconcileValidationChecklist(previous, [
      label,
      "Brinell hardness test.",
    ]);

    expect(reconciled.items[0]).toEqual({
      id: "tensile-test-to-astm-a897",
      label,
      checked: true,
      notes: "Coupon A passed.",
    });
  });

  it("adds new validation checks unchecked with empty notes", () => {
    const reconciled = reconcileValidationChecklist({ items: [] }, [
      "Brinell hardness test.",
    ]);

    expect(reconciled.items).toEqual([
      {
        id: "brinell-hardness-test",
        label: "Brinell hardness test.",
        checked: false,
        notes: "",
      },
    ]);
  });

  it("removes obsolete checks from the active checklist", () => {
    const previous: ValidationChecklistState = {
      items: [
        {
          id: "obsolete-check",
          label: "Obsolete check.",
          checked: true,
          notes: "No longer applies.",
        },
      ],
    };

    const reconciled = reconcileValidationChecklist(previous, [
      "Metallography for nodularity and ausferrite.",
    ]);

    expect(reconciled.items.map((item) => item.id)).toEqual([
      "metallography-for-nodularity-and-ausferrite",
    ]);
  });
});
