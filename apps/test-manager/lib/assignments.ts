import { normalizePerson, parseOwners } from "./fields";
import { normalizeId } from "./links";
import type { RecordRow, Workspace } from "./model";
import { recordPath } from "./sections";

const emailInLabel = /\(([^)]+)\)\s*$/;
const statusOrder = ["Fail", "Blocked", "Not run", "New", "Open", "In progress", "Fixed", "Pass", "Approved", "Deferred", "Closed"];
const weightOrder = ["Critical", "High", "Medium", "Low"];

export type Assignment = {
  href: string;
  id: string;
  title: string;
  status: string;
  weight: string;
  reviewerOnly: boolean;
};

export function assignedTo(user: { name: string; email: string }, stored: string | undefined) {
  if (!stored?.trim()) return false;
  const name = normalizePerson(user.name).trim().toLowerCase();
  const email = user.email.trim().toLowerCase();
  const labeled = name && email ? `${name} (${email})` : "";
  for (const part of parseOwners(stored)) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    if (labeled && token === labeled) return true;
    if (name && token === name) return true;
    const mail = token.match(emailInLabel)?.[1];
    if (email && mail === email) return true;
    const bare = normalizePerson(token.replace(emailInLabel, "")).trim().toLowerCase();
    if (name && bare === name) return true;
  }
  return false;
}

export function myWork(workspace: Workspace, user: { name: string; email: string }) {
  const rows = (name: string) => workspace.sections.find(section => section.name === name)?.rows ?? [];
  return {
    tests: assignments("Tests", rows("Tests"), user, row => row.values.Assignee, row => row.values["Test / scenario"], row => row.values.Priority),
    defects: assignments("Defects", rows("Defects"), user, row => row.values.Owner, row => row.values.Summary, row => row.values.Severity),
    decisions: assignments("Risks & Decisions", rows("Risks & Decisions"), user, row => ownedBy(user, row), row => row.values["Issue / risk"], () => ""),
  };
}

function ownedBy(user: { name: string; email: string }, row: RecordRow) {
  if (assignedTo(user, row.values["Decision owner role"])) return row.values["Decision owner role"];
  if (assignedTo(user, row.values.Reviewer)) return row.values.Reviewer;
  return "";
}

function assignments(section: string, rows: RecordRow[], user: { name: string; email: string }, owner: (row: RecordRow) => string | undefined, title: (row: RecordRow) => string | undefined, weight: (row: RecordRow) => string | undefined) {
  return rows.flatMap(row => {
    if (row.archived) return [];
    const stored = owner(row);
    if (!stored || !assignedTo(user, stored)) return [];
    const id = normalizeId(row.id);
    return [{
      href: recordPath(section, row.id),
      id,
      title: title(row)?.trim() || id,
      status: row.values.Status || (section === "Tests" ? "Not run" : ""),
      weight: weight(row) ?? "",
      reviewerOnly: section === "Risks & Decisions" && !assignedTo(user, row.values["Decision owner role"]) && assignedTo(user, row.values.Reviewer),
    }];
  }).sort((left, right) => rank(left.status, statusOrder) - rank(right.status, statusOrder) || rank(left.weight, weightOrder) - rank(right.weight, weightOrder) || left.id.localeCompare(right.id));
}

function rank(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}
