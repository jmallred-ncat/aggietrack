export const workspaceNav = [
  { href: "/", label: "Overview", section: null, group: "Workspace" },
  { href: "/work", label: "Your work", section: null, group: "Workspace" },
  { href: "/tests", label: "Test cases", section: "Tests", group: "Testing" },
  { href: "/defects", label: "Defects", section: "Defects", group: "Testing" },
  { href: "/risks", label: "Risks & decisions", section: "Risks & Decisions", group: "Testing" },
  { href: "/students", label: "Test students", section: null, group: "Testing" },
  { href: "/requirements", label: "Requirements", section: "Traceability", group: "Sources" },
  { href: "/fixtures", label: "Fixtures & sources", section: "Data", group: "Sources" },
  { href: "/catalog", label: "Course catalog", section: "Course Catalog", group: "Sources" },
  { href: "/plan", label: "Test plan", section: "Test Plan", group: "Sources" },
  { href: "/team", label: "Team", section: null, group: "Account" },
  { href: "/profile", label: "Profile", section: null, group: "Account" },
  { href: "/guide", label: "Guide", section: null, group: "Help" },
] as const;

export function navGroups() {
  const groups: { label: string; items: (typeof workspaceNav)[number][] }[] = [];
  for (const item of workspaceNav) {
    const current = groups.at(-1);
    if (current?.label === item.group) current.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

export const listColumns: Record<string, string[]> = {
  Tests: ["Test ID", "Test / scenario", "Requirement IDs", "Priority", "Status", "Assignee", "Tester"],
  Traceability: ["Requirement ID", "Baseline requirement (faithful summary)", "Mapped count", "Passed count", "Coverage state"],
  Data: ["Fixture ID", "Purpose"],
  "Risks & Decisions": ["ID", "Issue / risk", "Decision owner role", "Status"],
  Defects: ["Defect ID", "Summary", "Test / requirement IDs", "Severity", "Found by", "Owner", "Status"],
  "Course Catalog": ["Course code", "Actual title", "Credits", "Seed status", "Offered codes"],
};

export const listDescriptions: Record<string, string> = {
  Tests: "Open a case for its procedure, the requirements it covers, and the latest run.",
  Traceability: "Each requirement opens a coverage dashboard for the cases mapped to it.",
  Defects: "Open a defect to see the failed run and update its disposition.",
  "Risks & Decisions": "Open a decision to see what it blocks and record the outcome.",
  Data: "Open a fixture for its seed, oracle, and reset rules.",
  "Course Catalog": "Open a course for its catalog record and seed status.",
  "Test Plan": "Open a section of the test plan.",
};

export function sectionByName(name: string) {
  return workspaceNav.find(item => item.section === name);
}

export function recordPath(section: string, id: string) {
  const item = sectionByName(section);
  if (!item) return "/";
  return `${item.href}/${id.split("/").map(part => encodeURIComponent(part)).join("/")}`;
}

export function idFromParams(parts: string[]) {
  return parts.map(part => {
    try { return decodeURIComponent(part); }
    catch { return part; }
  }).join("/");
}
