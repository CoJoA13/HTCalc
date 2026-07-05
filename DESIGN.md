---
name: HTCalc
description: Traceable heat-treatment process and RFQ workbench for engineering and estimating review.
colors:
  calibration-teal: "#0f766e"
  instrument-ink: "#172033"
  body-ink: "#18212f"
  slate-text: "#526074"
  muted-text: "#607086"
  panel-white: "#ffffff"
  workbench-mist: "#f7f9fb"
  panel-mist: "#fbfcfd"
  control-mist: "#f8fafc"
  divider-steel: "#dbe3ec"
  control-steel: "#c9d3df"
  line-steel: "#d7e0ea"
  success-green: "#15803d"
  success-mist: "#e8f7ef"
  warning-amber: "#d97706"
  warning-text: "#9a5b00"
  warning-mist: "#fff4dc"
  danger-red: "#b42318"
  danger-mist: "#fee7e4"
  report-blue: "#0f4fb8"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 780
    lineHeight: 1.2
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 760
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 780
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "7px"
  lg: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.calibration-teal}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  field-control:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "38px"
  status-chip:
    backgroundColor: "{colors.success-mist}"
    textColor: "{colors.success-green}"
    rounded: "{rounded.pill}"
    padding: "2px 7px"
---

# Design System: HTCalc

## 1. Overview

**Creative North Star: "The Calibrated Workbench"**

HTCalc is a dense product interface for technical review, not a marketing surface. It should feel like a calibrated engineering bench: quiet enough for repeated use, structured enough to trace assumptions, and explicit enough to make limits and validation burden visible.

The visual system is restrained by design. White and near-white panels carry most of the surface, steel-gray dividers define structure, and Calibration Teal appears only for primary actions, active navigation, focus, and trusted status emphasis. The interface should never make calculations feel magical or opaque.

**Key Characteristics:**

- Compact, predictable product UI with familiar controls.
- Flat-by-default surfaces separated by borders and tonal layers.
- Teal as a functional accent, not decoration.
- Small, high-weight labels for scan speed.
- Explicit warnings, validation checks, and report affordances.

## 2. Colors

The palette is a restrained technical workbench: cool neutral surfaces, steel dividers, and one calibrated teal accent.

### Primary

- **Calibration Teal**: Primary action color, active process tab, focus border, selected segmented controls, and trusted status emphasis. Use sparingly so active state remains obvious.

### Secondary

- **Report Blue**: Used for prominent process-window numeric recommendations. Keep it isolated to output emphasis, not navigation or controls.

### Tertiary

- **Success Green** and **Warning Amber**: Semantic status colors for robust checks, warnings, and validation bullets.
- **Danger Red**: Error and invalid-state color. Pair it with text or labels; never rely on color alone.

### Neutral

- **Instrument Ink**: Primary panel text and data values.
- **Body Ink**: Root body text and compact metric values.
- **Slate Text** and **Muted Text**: Secondary labels, explanatory text, and metadata.
- **Panel White**: Header, result pane, dialogs, metric tiles, and controls.
- **Workbench Mist** and **Panel Mist**: Page and input-pane background layers.
- **Divider Steel**, **Control Steel**, and **Line Steel**: Structural dividers, control borders, and table/grid rules.

### Named Rules

**The One Accent Rule.** Calibration Teal is reserved for current selection, primary action, focus, and positive confidence signals. Do not introduce decorative accent colors.

**The Semantic Pair Rule.** Success, warning, and danger states must pair color with copy, icons, or labels so status never depends on color alone.

## 3. Typography

**Display Font:** Inter with system sans fallbacks.
**Body Font:** Inter with system sans fallbacks.
**Label/Mono Font:** No separate mono or display family is used.

**Character:** The type system is compact, numeric-friendly, and task-focused. Weight carries hierarchy more often than large size.

### Hierarchy

- **Display** (780, 28px, 1.2): Planned-page and report-level headings only.
- **Headline** (760, 20-22px, 1.25): Brand title, settings titles, and report toolbar headings.
- **Title** (800, 14px, 1.35): Section headings, result titles, window titles, and field-group labels.
- **Body** (400-560, 13px, 1.4-1.5): Explanatory copy, warnings, table content, and validation notes.
- **Label** (720-820, 11-12px, 1.2): Eyebrows, metadata labels, project status, badges, and report definition terms.

### Named Rules

**The Dense Sans Rule.** Use the single sans family throughout. Do not add display fonts, serif accents, or decorative label treatments.

**The Weight Before Size Rule.** Increase weight before increasing type size in compact panels. Oversized headings make the workbench feel less operational.

## 4. Elevation

HTCalc is flat by default and uses tonal layering, borders, and sticky panels for depth. Shadows appear only for overlays, dialogs, and tooltips where the element must float above work content.

### Shadow Vocabulary

- **Tooltip Lift** (`box-shadow: 0 12px 24px rgb(15 23 42 / 18%)`): Help tooltip hover and focus panels.
- **Drawer Lift** (`box-shadow: -18px 0 36px rgb(15 23 42 / 16%)`): Settings side panel.
- **Report Modal Lift** (`box-shadow: 0 20px 50px rgb(15 23 42 / 22%)`): Printable report panel.

### Named Rules

**The Flat Workbench Rule.** Resting surfaces are flat. Use borders and neutral surface changes first; use shadows only when an element is physically above the workspace.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangles with a 7px radius.
- **Primary:** Calibration Teal background, white text, 40px height, 16px horizontal padding, and 750 weight.
- **Secondary:** White background, steel border, Body Ink text, same height and radius as primary.
- **Icon:** 40px square with the same border and radius vocabulary.
- **Hover / Focus:** Focus uses a 3px translucent teal outline and teal border shift. Keep hover subtle and state-based.

### Chips

- **Style:** Rounded pill or compact badge, high-weight 11-12px label, semantic mist background.
- **State:** Active and semantic chips must include readable text. Planned process chips use neutral mist and Slate Text.

### Cards / Containers

- **Corner Style:** 7-8px radius for framed work items and repeated result surfaces.
- **Background:** Panel White for output surfaces, Panel Mist for input pane sections and validation items.
- **Shadow Strategy:** No card shadows at rest. Use dividers and borders.
- **Border:** Steel borders define process windows, metrics, validation items, comparison tables, and settings fields.
- **Internal Padding:** 10-18px for dense product surfaces; 28px only for report/document reading areas.

### Inputs / Fields

- **Style:** White controls, 6px radius, Control Steel border, 38px height for inputs and selects.
- **Focus:** 3px translucent teal outline, 1px offset, and teal border.
- **Error / Disabled:** Disabled actions use pale neutral background and muted text. Errors use danger text and explicit status copy.

### Navigation

- **Style:** Top process tabs in a centered row with 40px height, compact gaps, and the shared button shape.
- **Active State:** Calibration Teal fill with white text and 700+ weight.
- **Planned State:** Neutral mist background, Slate Text, and a small planned badge.
- **Mobile Treatment:** Tabs become horizontally scrollable; the workspace collapses to one column.

### Reports and Dialogs

- **Report Panel:** White, centered, wide reading surface with a sticky toolbar and a high overlay shadow.
- **Settings Panel:** Right-side drawer with sticky footer actions and structured settings fields.
- **Document Content:** Keep report typography plain, compact, and table-friendly.

## 6. Do's and Don'ts

### Do:

- **Do** preserve traceability by keeping assumptions, warnings, validation checks, and report actions visibly connected.
- **Do** keep product surfaces compact, bordered, and operational.
- **Do** use Calibration Teal for active selection, primary action, and focus only.
- **Do** pair semantic color with text, icons, labels, or status copy.
- **Do** keep keyboard focus visible on every interactive control.

### Don't:

- **Don't** use marketing-site polish, flashy dashboards, decorative motion, or gamified visuals.
- **Don't** make calculations feel like a black-box AI recommender.
- **Don't** introduce purple gradients, glassmorphism, bokeh/orb decoration, or oversized hero treatment.
- **Don't** use shadows on ordinary cards or repeated panels.
- **Don't** make the app feel like an accounting system, CRM, production traveler, or certification tool.
