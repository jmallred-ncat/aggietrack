import { environments, riskStatuses } from "./fields";
import { normalizeId, parseLinks } from "./links";

export type Values = Record<string, string>;
export type RecordRow = { id: string; sourceRow: number; values: Values; revision: number; archived: boolean };
export type Section = { name: string; headers: string[]; rows: RecordRow[] };
export type History = { sequence: number; section: string; recordId: string; savedAt: string; values: Values; actorId?: string | null; actorEmail?: string | null };
export type Workspace = { source: string; sections: Section[]; history: History[] };
export const testStatuses = ["Not run", "Pass", "Fail", "Blocked"];
export const editableSections = ["Test Plan", "Tests", "Traceability", "Data", "Risks & Decisions", "Defects", "Course Catalog"];

export function coverage(requirement: RecordRow, tests: RecordRow[]) {
  const mapped = tests.filter(test => {
    if (test.archived) return false;
    return parseLinks(test.values["Requirement IDs"] ?? "").includes(normalizeId(requirement.id));
  });
  const passed = mapped.filter(test => test.values.Status === "Pass").length;
  return { mapped, passed, state: mapped.length === 0 ? "No mapped tests" : passed === mapped.length ? "All mapped tests pass" : "Execution incomplete" };
}

export function validateRecord(section: Section, values: unknown): Values {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Invalid record.");
  const input = values as Record<string, unknown>;
  const clean: Values = {};
  for (const header of section.headers) {
    const value = input[header] ?? "";
    if (typeof value !== "string" || value.length > 20000) throw new Error(`Invalid ${header}.`);
    clean[header] = value.trim();
  }
  clean[section.headers[0]] = normalizeId(clean[section.headers[0]]);
  if (!clean[section.headers[0]]) throw new Error("An ID is required.");
  if (section.name === "Tests") {
    if (!/^T-\d{2,}$/.test(clean["Test ID"])) throw new Error("Test IDs use the form T-01.");
    if (!clean["Test / scenario"]) throw new Error("A test scenario is required.");
    if (!testStatuses.includes(clean.Status)) throw new Error("Choose a valid test status.");
    if (clean.Status !== "Not run") {
      for (const field of ["Actual result", "Tester", "Run date", "Evidence reference", "Run / build / environment"]) {
        if (!clean[field]) throw new Error(`${field} is required for an executed test.`);
      }
      const date = new Date(clean["Run date"]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(clean["Run date"]) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== clean["Run date"]) throw new Error("Enter a valid run date.");
    }
    if (clean["Run / build / environment"] && !environments.includes(clean["Run / build / environment"])) throw new Error("Choose Local, Preview, or Production.");
  }
  if (section.name === "Defects") {
    if (!/^D-\d{2,}$/.test(clean["Defect ID"])) throw new Error("Defect IDs use the form D-01.");
    if (!clean.Summary) throw new Error("A defect summary is required.");
    if (!["Critical", "High", "Medium", "Low"].includes(clean.Severity)) throw new Error("Choose a severity.");
    if (clean["Run / build / environment"] && !environments.includes(clean["Run / build / environment"])) throw new Error("Choose Local, Preview, or Production.");
    if (!["New", "Open", "In progress", "Fixed", "Closed"].includes(clean.Status)) throw new Error("Choose a defect status.");
    if (clean.Status === "Closed" && !clean["Regression / closure approval"]) throw new Error("Closing a defect requires closure approval.");
  }
  if (section.name === "Risks & Decisions" && clean.Status && !riskStatuses.includes(clean.Status)) throw new Error("Choose a decision status.");
  return clean;
}
