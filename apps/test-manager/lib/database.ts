import seed from "../data/workbook.json";
import { getPrisma } from "./prisma";
import type { PrismaClient, Prisma } from "./generated/prisma/client";
import { blankInstruction, presentDefectPeople } from "./fields";
import { coverage, editableSections, validateRecord, type Workspace, type Values, type Section } from "./model";
import { computedRequirementFields, formatLinks, linkTargets, normalizeId, parseLinks, rewriteRecordValues } from "./links";
import { applyRetestFields } from "./retests";
export const sectionDefinitions = seed.sections.map(section => {
  const headers = [...section.headers];
  if (section.name === "Tests") for (const header of ["Evidence reference", "Run / build / environment", "Assignee"]) if (!headers.includes(header)) headers.push(header);
  if (section.name === "Risks & Decisions") for (const header of ["Reviewer", "Review date"]) if (!headers.includes(header)) headers.push(header);
  if (section.name === "Defects") for (const header of ["Retest ID", "Retest date", "Found by"]) if (!headers.includes(header)) headers.push(header);
  return { name: section.name, headers };
});

const idFormat = "prefix-pad2";
const copyRevision = "human-2026-10-15";
const voiceFields: Record<string, string[]> = {
  Tests: ["Test / scenario", "Preconditions", "Inputs / data", "Procedure", "Expected result", "Pass criterion", "Evidence to retain"],
  "Risks & Decisions": ["Issue / risk", "Source gap or constraint", "Proposed control / decision"],
  Defects: ["Summary", "Steps and inputs", "Expected result", "Actual result"],
  Traceability: ["Baseline requirement (faithful summary)"],
  "Test Plan": ["Plan and process"],
  Data: ["Purpose", "Seed definition", "Independent oracle / rule", "Setup and reset"],
};

export async function importBaseline(db: PrismaClient = getPrisma()) {
  await db.$transaction(async tx => {
    if (await tx.importMetadata.findUnique({ where: { key: "seed" } })) return;
    for (const section of seed.sections) await tx.workbookRecord.createMany({ data: section.rows.map(row => ({ section: section.name, id: normalizeId(row.id), position: row.sourceRow, values: rewriteRecordValues(row.values as Values) as Prisma.InputJsonValue })) });
    await tx.importMetadata.createMany({ data: [{ key: "seed", value: seed.source }, { key: "id-format", value: idFormat }, { key: "copy-revision", value: copyRevision }] });
  }, { timeout: 30000 });
}

export async function normalizeStoredIds(db: PrismaClient = getPrisma()) {
  await db.$transaction(async tx => {
    if ((await tx.importMetadata.findUnique({ where: { key: "id-format" } }))?.value === idFormat) return;
    const seeded = await tx.importMetadata.findUnique({ where: { key: "seed" } });
    const records = await tx.workbookRecord.findMany();
    if (!seeded && records.length === 0) return;
    for (const row of records) {
      const nextId = normalizeId(row.id);
      const values = rewriteRecordValues(row.values as Values);
      if (nextId === row.id && JSON.stringify(values) === JSON.stringify(row.values)) continue;
      await tx.workbookRecord.update({ where: { section_id: { section: row.section, id: row.id } }, data: { id: nextId, values } });
    }
    for (const row of await tx.recordHistory.findMany()) {
      const recordId = normalizeId(row.recordId);
      const values = rewriteRecordValues(row.values as Values);
      if (recordId === row.recordId && JSON.stringify(values) === JSON.stringify(row.values)) continue;
      await tx.recordHistory.update({ where: { sequence: row.sequence }, data: { recordId, values } });
    }
    await tx.importMetadata.upsert({ where: { key: "id-format" }, create: { key: "id-format", value: idFormat }, update: { value: idFormat } });
  }, { timeout: 60000 });
}

export async function applyHumanCopy(db: PrismaClient = getPrisma()) {
  await db.$transaction(async tx => {
    if ((await tx.importMetadata.findUnique({ where: { key: "copy-revision" } }))?.value === copyRevision) return;
    if (!await tx.importMetadata.findUnique({ where: { key: "seed" } })) {
      await tx.importMetadata.create({ data: { key: "copy-revision", value: copyRevision } });
      return;
    }
    for (const section of seed.sections) {
      const fields = voiceFields[section.name];
      if (!fields) continue;
      for (const row of section.rows) {
        const id = normalizeId(String(row.id));
        let current = await tx.workbookRecord.findUnique({ where: { section_id: { section: section.name, id } } });
        if (!current && id === "Source baseline") current = await tx.workbookRecord.findFirst({ where: { section: "Traceability", id: { startsWith: "Source baseline:" } } });
        if (!current) continue;
        const values = { ...(current.values as Values) };
        const next = rewriteRecordValues(row.values as Values);
        for (const field of fields) if (field in next) values[field] = next[field] ?? "";
        if (section.name === "Defects") for (const field of ["Fix build", "Retest ID / date", "Retest result / evidence", "Regression / closure approval"]) if (values[field] === blankInstruction) values[field] = "";
        if (id === "Source baseline") values["Requirement ID"] = id;
        if (current.id !== id) await tx.workbookRecord.update({ where: { section_id: { section: current.section, id: current.id } }, data: { id, values } });
        else if (JSON.stringify(values) !== JSON.stringify(current.values)) await tx.workbookRecord.update({ where: { section_id: { section: current.section, id } }, data: { values } });
      }
    }
    await tx.importMetadata.upsert({ where: { key: "copy-revision" }, create: { key: "copy-revision", value: copyRevision }, update: { value: copyRevision } });
  }, { timeout: 60000 });
}

export async function readWorkspace(db: PrismaClient = getPrisma()): Promise<Workspace> {
  await normalizeStoredIds(db);
  await applyHumanCopy(db);
  const [records, history] = await db.$transaction([db.workbookRecord.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }), db.recordHistory.findMany({ orderBy: { sequence: "desc" } })]);
  const result: Workspace = {
    source: seed.source,
    sections: sectionDefinitions.map(section => ({ ...section, rows: records.filter(row => row.section === section.name).map(row => ({ id: row.id, sourceRow: row.position, revision: row.revision, archived: row.archived, values: row.values as Values })) })),
    history: history.map(row => ({ ...row, values: row.values as Values })),
  };
  for (const row of result.sections.find(section => section.name === "Defects")?.rows ?? []) row.values = presentDefectPeople(row.values);
  const tests = result.sections.find(section => section.name === "Tests")!.rows;
  for (const row of result.sections.find(section => section.name === "Traceability")!.rows) {
    if (!/^(?:FR|NFR)-\d+$/.test(normalizeId(row.id))) continue;
    const computed = coverage(row, tests);
    Object.assign(row.values, { "Mapped test IDs": computed.mapped.map(test => normalizeId(test.id)).join(", "), "Mapped count": String(computed.mapped.length), "Passed count": String(computed.passed), "Coverage state": computed.state });
  }
  return result;
}
export async function saveRecord(sectionName: string, id: string, values: unknown, revision: number | null, db: PrismaClient = getPrisma(), actor?: { id: string; email: string }, assignees?: string[]) {
  await normalizeStoredIds(db);
  id = normalizeId(id);
  const section = sectionDefinitions.find(section => section.name === sectionName);
  if (!section || !editableSections.includes(sectionName)) throw new Error("This section is read-only.");
  const clean = validateRecord(section as Section, values);
  if (clean[section.headers[0]] !== id) throw new Error("Record IDs cannot be changed.");
  await db.$transaction(async tx => {
    const current = await tx.workbookRecord.findUnique({ where: { section_id: { section: sectionName, id } } });
    if (revision === null && current) throw new Error("That ID already exists.");
    if (revision !== null && (!current || current.revision !== revision)) throw new Error("This record changed. Refresh before saving.");
    if (!current && !["Tests", "Defects"].includes(sectionName)) throw new Error("Only tests and defects can be created.");
    if (sectionName === "Tests") {
      const stored = current?.values as Values | undefined;
      if (clean.Status === "Not run") clean.Tester = stored?.Tester ?? "";
      if (assignees && clean.Assignee && !assignees.includes(clean.Assignee) && clean.Assignee !== stored?.Assignee) throw new Error("Assign the test to a team member.");
      const requirements = new Set((await tx.workbookRecord.findMany({ where: { section: "Traceability" }, select: { id: true } })).map(row => normalizeId(row.id)));
      const tokens = parseLinks(clean["Requirement IDs"]);
      if (tokens.length === 0 || tokens.some(token => !/^(?:FR|NFR)-\d+$/.test(token) || !requirements.has(token))) throw new Error("Map the test to valid FR or NFR requirement IDs.");
      clean["Requirement IDs"] = formatLinks(tokens);
      const defects = new Set((await tx.workbookRecord.findMany({ where: { section: "Defects" }, select: { id: true } })).map(row => normalizeId(row.id)));
      const defectIds = parseLinks(clean["Defect ID"]);
      for (const defect of defectIds) if (!defects.has(defect)) throw new Error(`Defect ${defect} does not exist.`);
      clean["Defect ID"] = formatLinks(defectIds);
    }
    if (sectionName === "Defects") {
      const stored = current?.values as Values | undefined;
      if (!clean["Found by"]) throw new Error("Choose who found this defect.");
      if (assignees && !assignees.includes(clean["Found by"]) && clean["Found by"] !== stored?.["Found by"]) throw new Error("Choose a team member who found this defect.");
      if (clean.Owner && assignees && !assignees.includes(clean.Owner) && clean.Owner !== stored?.Owner) throw new Error("Assign the fix to a team member.");
      const tests = await tx.workbookRecord.findMany({ where: { section: "Tests" } });
      const passed = applyRetestFields(clean, id, tests.map(row => ({ id: row.id, archived: row.archived, values: row.values as Values })));
      if (clean.Status === "Closed" && !passed) throw new Error("A linked test has to pass before this defect can close.");
    }
    if (sectionName === "Traceability" && current) {
      const stored = current.values as Values;
      for (const field of computedRequirementFields) clean[field] = stored[field] ?? "";
    }
    await assertLinks(tx, sectionName, clean);
    if (current) {
      if (current.revision === 0) await tx.recordHistory.create({ data: { section: sectionName, recordId: id, savedAt: "Imported baseline", values: current.values as Prisma.InputJsonValue } });
      const updated = await tx.workbookRecord.updateMany({ where: { section: sectionName, id, revision: revision! }, data: { values: clean, revision: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("This record changed. Refresh before saving.");
    } else {
      const last = await tx.workbookRecord.aggregate({ where: { section: sectionName }, _max: { position: true } });
      await tx.workbookRecord.create({ data: { section: sectionName, id, position: (last._max.position ?? 4) + 1, values: clean, revision: 1 } });
    }
    await tx.recordHistory.create({ data: { section: sectionName, recordId: id, savedAt: new Date().toISOString(), values: clean, actorId: actor?.id, actorEmail: actor?.email } });
  });
}

export async function setArchived(sectionName: string, id: string, archived: boolean, revision: number, db: PrismaClient = getPrisma(), actor?: { id: string; email: string }) {
  await normalizeStoredIds(db);
  id = normalizeId(id);
  if (!editableSections.includes(sectionName)) throw new Error("This section is read-only.");
  await db.$transaction(async tx => {
    const current = await tx.workbookRecord.findUnique({ where: { section_id: { section: sectionName, id } } });
    if (!current || current.revision !== revision) throw new Error("This record changed. Refresh before saving.");
    const updated = await tx.workbookRecord.updateMany({ where: { section: sectionName, id, revision }, data: { archived, revision: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("This record changed. Refresh before saving.");
    await tx.recordHistory.create({ data: { section: sectionName, recordId: id, savedAt: new Date().toISOString(), values: { ...(current.values as Values), Archived: archived ? "Yes" : "No" }, actorId: actor?.id, actorEmail: actor?.email } });
  });
}

async function assertLinks(tx: Pick<PrismaClient, "workbookRecord">, sectionName: string, clean: Values) {
  const fields = ["Requirement IDs", "Defect ID", "Decision dependency", "Test / requirement IDs", "Affected requirements", "Affected tests", "Decision dependencies"];
  for (const header of fields) {
    const targets = linkTargets(sectionName, header);
    if (!targets || header === "Requirement IDs" || header === "Defect ID") continue;
    const ids = parseLinks(clean[header] ?? "");
    if (ids.length === 0) { if (header in clean) clean[header] = ""; continue; }
    const known = new Set((await tx.workbookRecord.findMany({ where: { section: { in: targets } }, select: { id: true } })).map(row => normalizeId(row.id)));
    for (const id of ids) if (!known.has(id)) throw new Error(`${header} ${id} does not exist.`);
    clean[header] = formatLinks(ids);
  }
}
