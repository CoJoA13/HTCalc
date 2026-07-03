import type {
  ValidationChecklistItem,
  ValidationChecklistState,
} from "./project-state.js";

export function validationChecklistId(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "validation-check";
}

export function reconcileValidationChecklist(
  previous: ValidationChecklistState,
  validationLabels: readonly string[],
): ValidationChecklistState {
  const previousById = new Map(previous.items.map((item) => [item.id, item]));

  return {
    items: validationLabels.map((label) => {
      const id = validationChecklistId(label);
      const previousItem = previousById.get(id);

      return previousItem
        ? { ...previousItem, label }
        : createChecklistItem(id, label);
    }),
  };
}

function createChecklistItem(id: string, label: string): ValidationChecklistItem {
  return {
    id,
    label,
    checked: false,
    notes: "",
  };
}
