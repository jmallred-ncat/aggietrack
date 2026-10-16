import Link from "next/link";
import { Badge } from "@aggietrack/ui/badge";
import { displayDate } from "@/components/date-field";
import { TermHelp } from "@/components/term-help";
import { normalizeId } from "@/lib/links";
import { recordPath } from "@/lib/sections";
import type { RecordRow } from "@/lib/model";

export function DefectRetests({ tests }: { tests: RecordRow[] }) {
  return <div>
    <div className="flex items-center gap-1.5"><h3 className="text-sm font-medium">Retests</h3><TermHelp section="Defects" label="Retests"/></div>
    {tests.length === 0 ? <p className="mt-2 text-sm leading-6 text-muted-foreground">Link a test case. The next time that case is run, the result is recorded here.</p> : <ul className="mt-2 divide-y rounded-lg border">
      {tests.map(test => {
        const id = normalizeId(test.id);
        const tried = Boolean(test.values.Status && test.values.Status !== "Not run");
        const detail = [tried ? displayDate(test.values["Run date"] ?? "") : "", test.values.Tester, test.values["Evidence reference"]].filter(Boolean).join(" · ");
        return <li key={test.id} className="px-3 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <Link href={recordPath("Tests", test.id)} className="font-semibold text-primary underline-offset-4 hover:underline">{id}</Link>
            <Badge variant="secondary" className="shrink-0">{test.values.Status || "Not run"}</Badge>
          </div>
          <p className="mt-1 leading-6 text-muted-foreground">{test.values["Test / scenario"] || id}</p>
          {tried ? <>
            {detail && <p className="mt-1 leading-6">{detail}</p>}
            {test.values["Actual result"] && <p className="mt-1 line-clamp-2 leading-6">{test.values["Actual result"]}</p>}
          </> : <p className="mt-1 leading-6">No retest recorded yet. <Link href={recordPath("Tests", test.id)} className="text-primary underline-offset-4 hover:underline">Open the case</Link> to record one.</p>}
        </li>;
      })}
    </ul>}
  </div>;
}
