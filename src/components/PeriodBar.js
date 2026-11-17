// Shared period selector. The same period filters the purchases view and the
// statistics view, so both always talk about the same dates.

import { describeRange, escapeHtml, getPeriodRange, PERIOD_OPTIONS } from "../utils/helpers.js";
import { mountDateRangePicker } from "./DateRangePicker.js";

const cleanups = new WeakMap();

export function renderPeriodBar(container, { period, customFrom, customTo, onChange }) {
  cleanups.get(container)?.();

  const range = getPeriodRange(period, { from: customFrom, to: customTo });
  const presets = PERIOD_OPTIONS.filter((option) => option.value !== "custom");

  container.innerHTML = `
    <div class="period-bar">
      <span class="period-bar__label" id="period-label">Período</span>
      <div class="segmented" role="group" aria-labelledby="period-label">
        ${presets.map((option) => `
          <button type="button" class="segmented__button" data-period="${option.value}"
            aria-pressed="${period === option.value}">${option.label}</button>`).join("")}
      </div>
      <div class="period-bar__range${period === "custom" ? " period-bar__range--active" : ""}"></div>
      <span class="period-bar__summary">${escapeHtml(describeRange(range))}</span>
    </div>`;

  container.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => onChange({ period: button.dataset.period, customFrom: "", customTo: "" }));
  });

  const cleanup = mountDateRangePicker(container.querySelector(".period-bar__range"), {
    from: period === "custom" ? customFrom : "",
    to: period === "custom" ? customTo : "",
    placeholder: "Elegir fechas",
    clearLabel: "Quitar rango",
    triggerClass: `segmented__button segmented__button--solo`,
    onApply: (from, to) => onChange(from && to
      ? { period: "custom", customFrom: from, customTo: to }
      : { period: "all", customFrom: "", customTo: "" }),
  });
  cleanups.set(container, cleanup);
}
