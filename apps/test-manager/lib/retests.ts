import { joinPair } from "./fields";
import { formatLinks, normalizeId, parseLinks } from "./links";
import type { Values } from "./model";

type LinkedTest = { id: string; archived?: boolean; values: Values };

export function retestTests<T extends LinkedTest>(tests: T[], defectId: string, linked: string) {
  const wanted = new Set(parseLinks(linked).filter(id => /^T-\d+$/.test(id)));
  const defect = normalizeId(defectId);
  return tests.filter(test => {
    if (test.archived) return false;
    const id = normalizeId(test.id);
    if (!/^T-\d+$/.test(id)) return false;
    return wanted.has(id) || parseLinks(test.values["Defect ID"] ?? "").includes(defect);
  }).sort((left, right) => normalizeId(left.id).localeCompare(normalizeId(right.id)));
}

export function applyRetestFields(defect: Values, defectId: string, tests: LinkedTest[]) {
  const linked = retestTests(tests, defectId, defect["Test / requirement IDs"] ?? "");
  const executed = linked.filter(test => test.values.Status && test.values.Status !== "Not run");
  const latest = [...executed].sort((left, right) => (right.values["Run date"] ?? "").localeCompare(left.values["Run date"] ?? ""))[0];
  defect["Retest ID"] = formatLinks(linked.map(test => normalizeId(test.id)));
  defect["Retest date"] = latest?.values["Run date"] ?? "";
  defect["Retest ID / date"] = joinPair(defect["Retest ID"], defect["Retest date"]);
  defect["Retest result / evidence"] = executed.map(test => {
    const id = normalizeId(test.id);
    const when = test.values["Run date"] ? ` on ${test.values["Run date"]}` : "";
    const evidence = test.values["Evidence reference"] ? ` Evidence: ${test.values["Evidence reference"]}.` : "";
    return `${id} ${test.values.Status}${when}.${evidence}`.trim();
  }).join("\n");
  return linked.some(test => test.values.Status === "Pass");
}
