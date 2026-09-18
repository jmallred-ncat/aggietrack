"use server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowsLeftRightIcon, BookOpenIcon, CalendarCheckIcon, CalendarIcon, CalendarPlusIcon, ChartBarIcon, ChecksIcon, LockSimpleIcon, NotePencilIcon, PlayCircleIcon, SealCheckIcon, UserListIcon, UsersThreeIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const ICON_SIZE = 32;

const studentFeatures = [
  {
    title: "Your catalog year. Not this year’s.",
    description: "Progress follows the exact IT guide you started on. Major core, gen-ed, and electives each keep their own place.",
    icon: <ChartBarIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Done. In progress. Still ahead.",
    description: "Credits toward 120. GPA. And the C-or-better rule on major courses, so a passing D never looks like a finish.",
    icon: <ChecksIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "NCAT. Transfer. AP.",
    description: "Add a course with its term and grade. Map any transfer credit to the A&T equivalent. Retakes count as they should.",
    icon: <ArrowsLeftRightIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "The CST catalog. Searchable.",
    description: "Search CST, MATH, MGMT, and gen-ed. See credits, prereqs, and whether that course already counts toward your plan.",
    icon: <BookOpenIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Eight semesters. Then yours.",
    description: "Start from the official guide. Move what’s left into Fall, Spring, and Summer terms. A plan is not a grade yet.",
    icon: <CalendarIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "A term to aim at.",
    description: "Follow the plan, and see the semester it lands. A real graduation date to work toward, not a guess in the dark.",
    icon: <CalendarCheckIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "One view in the room.",
    description: "Your advisor. Your appointments. The notes they meant you to read. The same progress on both sides of the table.",
    icon: <UserListIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Are you done?",
    description: "Every requirement group. What’s still open on the page. An AggieTrack audit — not the Registrar’s. We say so.",
    icon: <SealCheckIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
]

const advisorFeatures = [
  {
    title: "Your advisees. That’s the list.",
    description: "Only the students assigned to you. When someone needs a new advisor, admins still have access to the full roster.",
    icon: <UsersThreeIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "The audit they already have.",
    description: "Catalog year. Remaining buckets. GPA, in view. You walk in looking at the same record they already have in hand.",
    icon: <ChartBarIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Their plan, before they sit down.",
    description: "See the semesters they built from the eight-semester guide. Overloaded terms and missing prereqs, right in view.",
    icon: <CalendarIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Notes that stay.",
    description: "Write the notes after the hour is over. The next meeting starts with full context, not a blank page between you.",
    icon: <NotePencilIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "The next hour. On the calendar.",
    description: "Book advising time against the same record you both already use for progress, planning, and the hour still ahead.",
    icon: <CalendarPlusIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Some notes are just for you.",
    description: "Mark a note private, and it never reaches the student. Internal context stays on your side of the table, always.",
    icon: <LockSimpleIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "What’s in the way.",
    description: "The first unmet group. The C-or-better major-core rule. Credits still short of 120. Then recommend a schedule.",
    icon: <WarningCircleIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
  {
    title: "Done, or not.",
    description: "Every requirement, against their catalog year. An AggieTrack audit — not the Registrar’s. And we say so up front.",
    icon: <SealCheckIcon size={ICON_SIZE} className="text-primary" weight="fill" />
  },
]


export default async function Home() {
  return (
    <div className="space-y-32 xl:space-y-64 flex flex-col">
      <section className="container mx-auto mt-24 flex xl:flex-row flex-col gap-16 xl:items-center items-start">
        <header className="min-w-0 max-w-prose w-full text-center xl:text-left xl:mx-0 mx-auto">
          <h1 className="text-balance">
            Know exactly where you stand.
          </h1>
          <p>AggieTrack maps the B.S. in Information Technology at North Carolina A&T — your catalog year, what’s left, and the terms that finish it.</p>
          <Button className={"mt-4 not-typeset"} nativeButton={false} render={<Link href="/login">Get started</Link>} />
        </header>


        <div className="bg-muted rounded-lg p-4 aspect-video flex items-center justify-center not-typeset lg:max-w-3xl mx-auto lg:ml-auto w-full relative">
          <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10"><PlayCircleIcon size={120} className="text-primary" weight="fill" /></span>
        </div>
      </section>

      <section className="container mx-auto">
        <header className="text-center max-w-prose mx-auto">
          <Badge>Students</Badge>

          <h2 className="text-3xl font-bold not-typeset mt-2">Made for the way you earn it.</h2>
          <p>The CST curriculum is specific. So is this. Progress, courses, and a plan that follows the guide you started with.</p>
        </header>

        <div className="flex flex-row gap-4 overflow-x-auto rounded-lg mt-12">
          {studentFeatures.map((feature) => (
            <div key={feature.title} className="rounded-lg p-4 aspect-5/7 border-border border-2 bg-muted max-w-[24rem] w-full min-w-0 shrink-0 relative flex flex-col">
              <div className="absolute top-0 left-0 w-full h-full bg-muted rounded-lg p-4">
                <div className="grid shrink-0 place-items-center size-8 mx-auto md:mx-0">
                  {feature.icon}
                </div>
              </div>

              <h3 className="font-black w-full whitespace-normal leading-tight content-center text-balance mt-auto isolate text-2xl uppercase">{feature.title}</h3>
              <p className="mt-4 font-medium w-full text-pretty text-left isolate leading-tight">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto">
        <header className="text-center max-w-prose mx-auto">
          <Badge>Advisors</Badge>

          <h2 className="text-3xl font-bold not-typeset mt-2">Advise from the same page.</h2>
          <p>Open an advisee and you’re looking at their audit, their plan, and your notes. The meeting starts informed.</p>
        </header>

        <div className="flex flex-row gap-4 overflow-x-auto rounded-lg mt-12">
          {advisorFeatures.map((feature) => (
            <div key={feature.title} className="rounded-lg p-4 aspect-5/7 border-border border-2 bg-muted max-w-[24rem] w-full min-w-0 shrink-0 relative flex flex-col">
              <div className="absolute top-0 left-0 w-full h-full bg-muted rounded-lg p-4">
                <div className="grid shrink-0 place-items-center size-8 mx-auto md:mx-0">
                  {feature.icon}
                </div>
              </div>

              <h3 className="font-black w-full whitespace-normal leading-tight content-center text-balance mt-auto isolate text-2xl uppercase">{feature.title}</h3>
              <p className="mt-4 font-medium w-full text-pretty text-left isolate leading-tight">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
