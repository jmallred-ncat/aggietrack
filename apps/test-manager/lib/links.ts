const idPattern = /^(NFR|FR|[TDQGR])-?(\d+)$/i;
const rangePattern = /^(NFR|FR|[TDQGR])-?(\d+)-\1-?(\d+)$/i;

export function normalizeId(value: string) {
  const match = value.match(idPattern);
  if (!match) return value;
  const prefix = match[1].toUpperCase();
  const number = String(Number(match[2]));
  return `${prefix}-${number.padStart(2, "0")}`;
}

export function idForms(value: string) {
  const canonical = normalizeId(value);
  const match = canonical.match(/^(NFR|FR|[TDQGR])-(\d+)$/);
  if (!match) return canonical;
  const [, prefix, padded] = match;
  const plain = String(Number(padded));
  return [...new Set([canonical, `${prefix}-${plain}`, `${prefix}${plain}`, `${prefix}${padded}`])].join(" ");
}

const storedIdFields = ["Test ID", "Requirement ID", "Defect ID", "Fixture ID", "ID", "Course code", "Section"];
const storedLinkFields = ["Requirement IDs", "Defect ID", "Decision dependency", "Test / requirement IDs", "Affected requirements", "Affected tests", "Decision dependencies", "Mapped test IDs"];

export function rewriteRecordValues(values: Record<string, string>) {
  const next = { ...values };
  for (const field of storedLinkFields) if (next[field]) next[field] = formatLinks(parseLinks(next[field]));
  for (const field of storedIdFields) if (field in next) next[field] = normalizeId(next[field]);
  return next;
}

export function parseLinks(value: string) {
  const ids: string[] = [];
  for (const token of value.replaceAll("|", " ").split(/[\s,;]+/).filter(Boolean)) {
    const range = token.match(rangePattern);
    if (!range) { ids.push(normalizeId(token)); continue; }
    const prefix = range[1].toUpperCase();
    const start = Number(range[2]);
    const end = Number(range[3]);
    const [from, to] = start <= end ? [start, end] : [end, start];
    if (to - from > 200) { ids.push(token); continue; }
    for (let number = from; number <= to; number += 1) ids.push(normalizeId(`${prefix}${number}`));
  }
  return [...new Set(ids)];
}

export function formatLinks(ids: string[]) {
  return ids.join(", ");
}

export const computedRequirementFields = ["Mapped test IDs", "Mapped count", "Passed count", "Coverage state"];

export function linkTargets(section: string, header: string) {
  const fields: Record<string, Record<string, string[]>> = {
    Tests: { "Requirement IDs": ["Traceability"], "Defect ID": ["Defects"], "Decision dependency": ["Risks & Decisions", "Data"] },
    Defects: { "Test / requirement IDs": ["Tests", "Traceability"] },
    "Risks & Decisions": { "Affected requirements": ["Traceability"], "Affected tests": ["Tests"] },
    Traceability: { "Decision dependencies": ["Risks & Decisions", "Data"] },
  };
  return fields[section]?.[header];
}
