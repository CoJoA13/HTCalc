import "@phosphor-icons/web/regular";
import "../ui/styles.css";
import {
  ASTM_A897_GRADES,
  recommendAdiProcess,
  type AdiProcessInput,
  type AstmA897Grade,
  type AtmosphereType,
  type AustemperBathType,
  type BathAgitation,
  type FurnaceType,
  type ProcessPriority,
  type StartingMatrix,
} from "../adi/index.js";

type CompositionKey = keyof AdiProcessInput["composition"];

const compositionKeys: CompositionKey[] = [
  "C",
  "Si",
  "Mn",
  "Cu",
  "Ni",
  "Mo",
  "Cr",
  "Mg",
  "P",
  "S",
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("HTCalc app root was not found.");
}

const state: AdiProcessInput = {
  composition: {
    C: 3.6,
    Si: 2.5,
    Mn: 0.3,
    Cu: 0.8,
    Ni: 0.8,
    Mo: 0.2,
    Cr: 0.2,
    Mg: 0.045,
    P: 0.03,
    S: 0.01,
  },
  geometry: {
    maxSectionMm: 25,
    minSectionMm: 8,
    criticalSectionMm: 25,
    estimatedMassKg: 24,
  },
  microstructure: {
    startingMatrix: "ferritic-pearlitic",
    carbidesPresent: false,
    noduleCountPerMm2: 120,
    nodularityPercent: 90,
  },
  target: {
    grade: "150-110-07",
    priority: "strength",
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonPotentialControl: true,
    quenchTransferTimeSec: 8,
    austemperBathType: "salt",
    bathAgitation: "good",
    bathUniformityC: 5,
  },
};

app.innerHTML = `
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark">HT</div>
      <div>
        <div class="brand-title">HTCalc</div>
        <div class="brand-subtitle">Process recommendation workbench</div>
      </div>
    </div>
    <nav class="process-tabs" aria-label="Process mode">
      <button class="process-tab is-active" type="button"><i class="ph ph-target"></i> ADI</button>
      <button class="process-tab" type="button" disabled><i class="ph ph-thermometer-hot"></i> Steel Austempering</button>
      <button class="process-tab" type="button" disabled><i class="ph ph-lock-simple"></i> Martempering</button>
    </nav>
    <div class="header-actions">
      <button class="icon-button" type="button" title="Load project"><i class="ph ph-folder-open"></i></button>
      <button class="icon-button" type="button" title="Save project"><i class="ph ph-floppy-disk"></i></button>
      <button class="primary-action" id="run-calculation" type="button"><i class="ph ph-play"></i> Run Calculation</button>
    </div>
  </header>

  <main class="workspace">
    <section class="input-pane" aria-label="ADI inputs">
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-crosshair"></i><span>1. ASTM Target</span></div>
        <div class="field-grid target-grid">
          ${selectField("grade", "ASTM Grade", ASTM_A897_GRADES.map((g) => [g.grade, `${g.grade} (${g.processDirection})`]), state.target.grade)}
          ${selectField("priority", "Priority", [
            ["strength", "Strength"],
            ["ductility", "Ductility"],
            ["impact", "Impact"],
            ["wear", "Wear"],
            ["fatigue", "Fatigue"],
            ["machinability", "Machinability"],
          ], state.target.priority)}
          <label class="field toggle-field">
            <span>Dimensional Growth Sensitive</span>
            <input id="dimensionalGrowthSensitive" type="checkbox" />
          </label>
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-flask"></i><span>2. Chemical Composition (wt%)</span></div>
        <div class="composition-grid">
          ${compositionKeys
            .map((key) => numberField(`composition.${key}`, key, state.composition[key], "0.001"))
            .join("")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-cube"></i><span>3. Geometry</span></div>
        <div class="field-grid geometry-grid">
          ${numberField("geometry.maxSectionMm", "Max Section", state.geometry.maxSectionMm, "0.1", "mm")}
          ${numberField("geometry.criticalSectionMm", "Critical Section", state.geometry.criticalSectionMm, "0.1", "mm")}
          ${numberField("geometry.minSectionMm", "Min Section", state.geometry.minSectionMm, "0.1", "mm")}
          ${numberField("geometry.estimatedMassKg", "Estimated Mass", state.geometry.estimatedMassKg ?? 0, "0.1", "kg")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-grains"></i><span>4. Microstructure & Quality</span></div>
        <div class="field-grid micro-grid">
          ${selectField("startingMatrix", "Starting Matrix", [
            ["ferritic", "Ferritic"],
            ["pearlitic", "Pearlitic"],
            ["ferritic-pearlitic", "Ferritic-Pearlitic"],
          ], state.microstructure.startingMatrix)}
          <label class="field toggle-field">
            <span>Carbides Present</span>
            <input id="carbidesPresent" type="checkbox" />
          </label>
          ${numberField("microstructure.noduleCountPerMm2", "Nodule Count", state.microstructure.noduleCountPerMm2 ?? 0, "1", "/mm²")}
          ${numberField("microstructure.nodularityPercent", "Nodularity", state.microstructure.nodularityPercent ?? 0, "1", "%")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-factory"></i><span>5. Equipment & Process Constraints</span></div>
        <div class="field-grid equipment-grid">
          ${selectField("furnaceType", "Austenitizing Furnace", [
            ["controlled-atmosphere", "Controlled Atmosphere"],
            ["air", "Air"],
            ["vacuum", "Vacuum"],
            ["inert", "Inert"],
            ["salt", "Salt"],
          ], state.equipment.furnaceType)}
          ${selectField("atmosphereType", "Atmosphere", [
            ["endothermic-neutral", "Endothermic Neutral"],
            ["nitrogen-methanol", "Nitrogen-Methanol"],
            ["nitrogen-hydrocarbon", "Nitrogen-Hydrocarbon"],
            ["vacuum", "Vacuum"],
            ["inert", "Inert"],
            ["air", "Air"],
            ["salt", "Salt"],
            ["unknown", "Unknown"],
          ], state.equipment.atmosphereType)}
          ${selectField("bathAgitation", "Bath Agitation", [
            ["poor", "Poor"],
            ["fair", "Fair"],
            ["good", "Good"],
          ], state.equipment.bathAgitation)}
          ${selectField("austemperBathType", "Austemper Medium", [
            ["salt", "Salt Bath"],
            ["fluidized-bed", "Fluidized Bed"],
            ["other", "Other"],
          ], state.equipment.austemperBathType)}
          ${numberField("equipment.quenchTransferTimeSec", "Transfer Time", state.equipment.quenchTransferTimeSec, "0.1", "s")}
          ${numberField("equipment.bathUniformityC", "Bath Uniformity", state.equipment.bathUniformityC, "0.1", "°C")}
          <label class="field toggle-field">
            <span>Carbon Potential Control</span>
            <input id="carbonPotentialControl" type="checkbox" checked />
          </label>
        </div>
      </div>
    </section>

    <aside class="result-pane" aria-label="ADI recommendation">
      <div id="recommendation"></div>
    </aside>
  </main>
`;

const recommendationEl = document.querySelector<HTMLDivElement>("#recommendation");

if (!recommendationEl) {
  throw new Error("Recommendation panel was not found.");
}

const recommendationPanel = recommendationEl;

bindInputs();
renderRecommendation();

function bindInputs(): void {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-path]").forEach((control) => {
    control.addEventListener("input", () => {
      setValue(control.dataset.path ?? "", control);
      renderRecommendation();
    });
  });

  bindCheckbox("dimensionalGrowthSensitive", (checked) => {
    state.target.dimensionalGrowthSensitive = checked;
  });
  bindCheckbox("carbidesPresent", (checked) => {
    state.microstructure.carbidesPresent = checked;
  });
  bindCheckbox("carbonPotentialControl", (checked) => {
    state.equipment.carbonPotentialControl = checked;
  });

  document.querySelector("#run-calculation")?.addEventListener("click", renderRecommendation);
}

function bindCheckbox(id: string, update: (checked: boolean) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  input?.addEventListener("change", () => {
    update(input.checked);
    renderRecommendation();
  });
}

function setValue(path: string, control: HTMLInputElement | HTMLSelectElement): void {
  const value = control instanceof HTMLInputElement && control.type === "number"
    ? Number(control.value)
    : control.value;

  switch (path) {
    case "grade":
      state.target.grade = value as AstmA897Grade;
      break;
    case "priority":
      state.target.priority = value as ProcessPriority;
      break;
    case "startingMatrix":
      state.microstructure.startingMatrix = value as StartingMatrix;
      break;
    case "furnaceType":
      state.equipment.furnaceType = value as FurnaceType;
      break;
    case "atmosphereType":
      state.equipment.atmosphereType = value as AtmosphereType;
      break;
    case "bathAgitation":
      state.equipment.bathAgitation = value as BathAgitation;
      break;
    case "austemperBathType":
      state.equipment.austemperBathType = value as AustemperBathType;
      break;
    default:
      assignNumeric(path, Number(value));
  }
}

function assignNumeric(path: string, value: number): void {
  const [group, key] = path.split(".") as [string, string];
  if (group === "composition") {
    state.composition[key as CompositionKey] = value;
  }
  if (group === "geometry") {
    Object.assign(state.geometry, { [key]: value });
  }
  if (group === "microstructure") {
    Object.assign(state.microstructure, { [key]: value });
  }
  if (group === "equipment") {
    Object.assign(state.equipment, { [key]: value });
  }
}

function renderRecommendation(): void {
  try {
    const result = recommendAdiProcess(state);
    const confidenceClass = `confidence-${result.confidence}`;
    const warnings = result.warnings.length > 0
      ? result.warnings
      : ["No active risk warnings for the current input set."];
    const cpRange = result.austenitize.carbonPotential.rangeCarbonEquivalentPercent
      ? `${result.austenitize.carbonPotential.rangeCarbonEquivalentPercent[0].toFixed(2)}-${result.austenitize.carbonPotential.rangeCarbonEquivalentPercent[1].toFixed(2)}% C eq.`
      : "Equipment calibrated";

    recommendationPanel.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="eyebrow">Recommended ADI Process</div>
          <h2>${result.expectedGrade}</h2>
        </div>
        <span class="confidence ${confidenceClass}">${result.confidence}</span>
      </div>

      <div class="window-group">
        ${processWindow("ph-thermometer-hot", "Austenitize", `${result.austenitize.temperature.minC}-${result.austenitize.temperature.maxC} °C`, `${result.austenitize.temperature.nominalC} °C`, `${result.austenitize.soakAfterCoreAtTemp.minMin}-${result.austenitize.soakAfterCoreAtTemp.maxMin} min`)}
        ${processWindow("ph-drop", "Austemper", `${result.austemper.temperature.minC}-${result.austemper.temperature.maxC} °C`, `${result.austemper.temperature.nominalC} °C`, `${result.austemper.holdAfterCoreAtTemp.minMin}-${result.austemper.holdAfterCoreAtTemp.maxMin} min`)}
      </div>

      <div class="metric-strip">
        ${metric("AI", result.scores.austemperabilityIndex.toFixed(2), `required ${result.scores.requiredAustemperabilityIndex.toFixed(2)}`)}
        ${metric("CSR", result.scores.carbideSegregationRisk.toFixed(2), "carbide risk")}
        ${metric("Transfer", `${result.transfer.actualTransferTimeSec}s`, `max ${result.transfer.maxRecommendedTransferTimeSec}s`)}
        ${metric("Window", result.austemper.processingWindowStatus, "reaction")}
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-gauge"></i> Carbon Potential</div>
        <div class="cp-line"><strong>${cpRange}</strong><span>${result.austenitize.carbonPotential.category}</span></div>
        <p>${result.austenitize.carbonPotential.guidance}</p>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-warning"></i> Warnings</div>
        <ul class="warning-list">${warnings.map((warning) => `<li>${warning}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-check-square"></i> Validation Checks</div>
        <ul class="check-list">${result.validationChecks.map((check) => `<li>${check}</li>`).join("")}</ul>
      </div>
    `;
  } catch (error) {
    recommendationPanel.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-octagon"></i>
        <h2>Input needs correction</h2>
        <p>${error instanceof Error ? error.message : "Unable to calculate recommendation."}</p>
      </div>
    `;
  }
}

function selectField(
  id: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
): string {
  return `
    <label class="field">
      <span>${label}</span>
      <select data-path="${id}">
        ${options
          .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function numberField(id: string, label: string, value: number, step: string, unit = ""): string {
  return `
    <label class="field">
      <span>${label}</span>
      <div class="unit-input">
        <input data-path="${id}" type="number" value="${value}" step="${step}" />
        ${unit ? `<span>${unit}</span>` : ""}
      </div>
    </label>
  `;
}

function processWindow(icon: string, title: string, range: string, nominal: string, hold: string): string {
  return `
    <div class="process-window">
      <div class="window-title"><i class="ph ${icon}"></i>${title}<span>OK</span></div>
      <div class="window-main">${range}</div>
      <div class="window-details">
        <span>Recommended <strong>${nominal}</strong></span>
        <span>Hold <strong>${hold}</strong></span>
      </div>
    </div>
  `;
}

function metric(label: string, value: string, hint: string): string {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <em>${hint}</em>
    </div>
  `;
}
