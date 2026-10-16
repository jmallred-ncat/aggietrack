export const testTypes = ["Functional", "Security", "Performance", "Reliability", "Compatibility", "Usability", "Scalability", "Accessibility"];
export const environments = ["Local", "Preview", "Production"];
export const riskStatuses = ["Open", "Approved", "Deferred"];
export const sourcePriorities = ["High", "Medium", "Low", "Not stated"];
export const seedStatuses = ["Seedable", "Skipped by seed"];
export const creditChoices = ["1", "2", "3", "4"];
export const decisionOwners = ["James Allred", "LaDarius Taylor", "Ivy Mitchell", "Mellonie Evans"];
export const offeredTerms = [
  { value: "F", label: "Fall" },
  { value: "S", label: "Spring" },
  { value: "SS", label: "Summer" },
];
export const offeredExclusive = "Not specified";
export const gecCategories = ["AA", "GL", "HFA", "MLAR", "SBS", "SR", "SS", "WC"];
export const gecExclusive = "Not tagged";
export const blankInstruction = "Leave blank for Jay";

export function environmentValue(value: string) {
  return environments.find(item => item.toLowerCase() === value.trim().toLowerCase()) ?? value.trim();
}

export function parseSteps(value: string) {
  return value.split(/\n+/).map(line => line.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
}

export function joinSteps(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function parseItems(value: string) {
  return value.split(";").map(item => item.trim()).filter(Boolean);
}

export function joinItems(items: string[]) {
  return items.join("; ");
}

export function normalizePerson(value: string) {
  const name = value.trim();
  return name === "Melonie Evans" ? "Mellonie Evans" : name;
}

export function presentDefectPeople(values: Record<string, string>) {
  if (values["Found by"]?.trim() || !values.Owner?.trim()) return values;
  return { ...values, "Found by": values.Owner.trim(), Owner: "" };
}

export function parseOwners(value: string) {
  return value.split("/").map(normalizePerson).filter(Boolean);
}

export function joinOwners(names: string[]) {
  return names.join(" / ");
}

export function splitPair(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === blankInstruction) return { left: "", right: "" };
  const match = trimmed.match(/^(.*)\s\/\s(\d{4}-\d{2}-\d{2})$/);
  if (match) return { left: match[1].trim(), right: match[2] };
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { left: "", right: trimmed };
  return { left: trimmed, right: "" };
}

export function joinPair(left: string, right: string) {
  return [left.trim(), right.trim()].filter(Boolean).join(" / ");
}

export function splitSeparated(value: string, separator: string) {
  return value.split(separator).map(item => item.trim()).filter(Boolean);
}

export function joinSeparated(items: string[], separator: string, order: string[] = []) {
  const rank = new Map(order.map((item, index) => [item, index]));
  return [...items].sort((a, b) => (rank.get(a) ?? order.length) - (rank.get(b) ?? order.length) || a.localeCompare(b)).join(separator);
}
