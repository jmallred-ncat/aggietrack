import { notFound, redirect } from "next/navigation";
import { RecordDashboard } from "@/components/record-dashboard";
import { RecordList } from "@/components/record-list";
import { normalizeId } from "@/lib/links";
import { memberLabel } from "@/lib/members";
import { loadWorkspace } from "@/lib/load-workspace";
import type { Section } from "@/lib/model";
import { recordPath } from "@/lib/sections";

async function workspaceData() {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  return data;
}

function findSection(sections: Section[], name: string) {
  const section = sections.find(item => item.name === name);
  if (!section) notFound();
  return section;
}

export async function SectionList({ name }: { name: string }) {
  const data = await workspaceData();
  return <RecordList section={findSection(data.workspace.sections, name)}/>;
}

export async function RecordScreen({ name, id, creating = false }: { name: string; id?: string; creating?: boolean }) {
  const data = await workspaceData();
  const section = findSection(data.workspace.sections, name);
  const row = creating || !id ? null : section.rows.find(item => item.id === id) ?? section.rows.find(item => normalizeId(item.id) === normalizeId(id)) ?? null;
  if (!creating && !row) notFound();
  if (!creating && row && id && row.id !== id) redirect(recordPath(name, row.id));
  return <RecordDashboard key={creating ? "new" : row!.id} workspace={data.workspace} section={section} row={row} creating={creating} members={data.members} finder={memberLabel(data.user)}/>;
}
