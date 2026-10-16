import Link from "next/link";
import { Button } from "@aggietrack/ui/button";
import { displayDate } from "@/components/date-field";
import { parseItems, parseSteps } from "@/lib/fields";
import { normalizeId, parseLinks } from "@/lib/links";
import type { Values } from "@/lib/model";

type Related = { href: string; id: string; detail: string; status?: string };

export function TestLab({ draft, related, onUpdate, onExecute }: { draft: Values; related: Related[]; onUpdate: () => void; onExecute: () => void }) {
  const tried = (draft.Status || "Not run") !== "Not run";
  const requirements = linked(draft["Requirement IDs"], related);
  const decisions = linked(draft["Decision dependency"], related);
  const defects = linked(draft["Defect ID"], related);
  const where = [draft.Tester, displayDate(draft["Run date"] ?? ""), draft["Run / build / environment"]].filter(Boolean).join(" · ");
  const openDecisions = decisions.filter(item => normalizeId(item.id).startsWith("Q-") && item.status === "Open");
  const missingProcedure = parseSteps(draft.Procedure ?? "").length === 0;

  return <article className="max-w-3xl space-y-8 rounded-xl border bg-background px-6 py-8 sm:px-8">
    <div className="flex flex-wrap items-center justify-end gap-3">
      {draft.Assignee && <p className="mr-auto text-sm leading-6">Assigned to {draft.Assignee}.</p>}
      <Button type="button" variant="outline" onClick={onUpdate}>Update case</Button>
    </div>
    <ItemSection title="Requirements" items={[]} links={requirements}/>
    <ItemSection title="Preconditions" items={parseItems(draft.Preconditions ?? "")}/>
    <ItemSection title="Inputs / data" items={parseItems(draft["Inputs / data"] ?? "")}/>
    <ItemSection title="Procedure" items={parseSteps(draft.Procedure ?? "")} ordered/>
    <ItemSection title="Expected result" items={parseItems(draft["Expected result"] ?? "")}/>
    <ItemSection title="Pass criterion" items={parseItems(draft["Pass criterion"] ?? "")}/>
    <ItemSection title="Evidence to retain" items={parseItems(draft["Evidence to retain"] ?? "")}/>
    <ItemSection title="Decision dependency" items={[]} links={decisions}/>
    <section className="rounded-lg bg-muted/60 p-5">
      <h2 className="text-sm font-semibold">Execution</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">An execution is the latest try of the case: the result, who tried the case, when, and where.</p>
      {tried && <div className="mt-3 space-y-3 text-sm leading-6">
        <p>{[draft.Status, where].filter(Boolean).join(" · ")}</p>
        {draft["Actual result"] && <p className="whitespace-pre-wrap">{draft["Actual result"]}</p>}
        {draft["Evidence reference"] && <p>Evidence reference: {draft["Evidence reference"]}</p>}
        {defects.length > 0 && <ul className="space-y-1">{defects.map(item => <li key={item.href}><RecordLink item={item}/></li>)}</ul>}
      </div>}
      {!tried && <p className="mt-3 text-sm leading-6">No execution recorded.</p>}
      {missingProcedure && <p className="mt-3 text-sm leading-6">Add a procedure with Update case before recording an execution.</p>}
      {openDecisions.length > 0 && <p className="mt-3 text-sm leading-6">Settle {openDecisions.map(item => normalizeId(item.id)).join(", ")} before recording an execution.</p>}
      {!missingProcedure && openDecisions.length === 0 && <Button type="button" className="mt-4" onClick={onExecute}>{tried ? "Update execution" : "Record execution"}</Button>}
    </section>
  </article>;
}

function ItemSection({ title, items, ordered = false, links = [] }: { title: string; items: string[]; ordered?: boolean; links?: Related[] }) {
  if (items.length === 0 && links.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return <section>
    <h2 className="text-sm font-semibold">{title}</h2>
    {links.length > 0 && <ul className="mt-2 space-y-2 text-sm leading-6">{links.map(item => <li key={item.href}><RecordLink item={item}/></li>)}</ul>}
    {items.length > 0 && <List className={ordered ? "mt-2 list-decimal space-y-2 pl-5 text-sm leading-6" : "mt-2 list-disc space-y-2 pl-5 text-sm leading-6"}>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</List>}
  </section>;
}

function RecordLink({ item }: { item: Related }) {
  return <Link href={item.href} className="text-primary underline-offset-4 hover:underline"><span className="font-semibold">{normalizeId(item.id)}</span>{item.detail ? ` ${item.detail}` : ""}</Link>;
}

function linked(value: string | undefined, related: Related[]) {
  const ids = new Set(parseLinks(value ?? ""));
  return related.filter(item => ids.has(normalizeId(item.id)));
}
