import { guideGroups, guideSlug } from "@/lib/guide";

export default function Page() {
  return <div className="not-typeset space-y-10">
    <div>
      <h1 className="text-2xl font-semibold">What things mean</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Plain explanations for the words on these dashboards. The same note appears when you choose ? beside a field.</p>
      <nav aria-label="Guide sections" className="mt-4 flex flex-wrap gap-2">
        {guideGroups.map(group => <a key={group.id} href={`#${group.id}`} className="rounded-full border bg-background px-3 py-1 text-sm hover:bg-muted">{group.title}</a>)}
      </nav>
    </div>
    {guideGroups.map(group => <section key={group.id} id={group.id} className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{group.title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{group.intro}</p>
      </div>
      <dl className="grid gap-3">
        {group.entries.map(entry => <div key={entry.term} id={guideSlug(entry.term)} className="scroll-mt-6 rounded-xl border bg-background p-4">
          <dt className="font-semibold">{entry.term}</dt>
          <dd className="mt-1 text-sm leading-6 text-muted-foreground">{entry.plain}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}
