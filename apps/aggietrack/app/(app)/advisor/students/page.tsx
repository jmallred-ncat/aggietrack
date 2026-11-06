import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { academicTermLabel } from "@/lib/academic-term";
import {
    advisorTermChoices,
    filterRoster,
    paginateRoster,
    sortRoster,
    type RosterRow,
    type RosterStatus,
} from "@/lib/advisor-roster";
import { catalogYearLabel, planDate, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";
import { RosterControls } from "./RosterControls";

const statusFromQuery: Record<string, RosterStatus | "none" | "all"> = {
    all: "all",
    waiting: "SUBMITTED",
    returned: "RETURNED",
    draft: "DRAFT",
    approved: "APPROVED",
    none: "none",
};

function loadAssignedStudents(advisorId: string, termId: string) {
    return prisma.studentProfile.findMany({
        where: { advisorId },
        include: {
            user: { select: { firstName: true, lastName: true } },
            catalogYear: { select: { year: true } },
            plannedTerms: { where: { termId }, take: 1 },
        },
        orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    });
}

function timing(row: RosterRow, termLabel: string) {
    if (!row.planId) return `No plan for ${termLabel}`;
    if (row.status === "SUBMITTED" && row.submittedAt) return `Submitted ${planDate(new Date(row.submittedAt))}`;
    if (row.status === "RETURNED" && row.reviewedAt) return `Returned ${planDate(new Date(row.reviewedAt))}`;
    if (row.status === "APPROVED" && row.reviewedAt) return `Reviewed ${planDate(new Date(row.reviewedAt))}`;
    return "Not submitted";
}

export default async function AdvisorStudentsPage({
    searchParams,
}: {
    searchParams: Promise<{ term?: string; q?: string; status?: string; sort?: string; page?: string }>;
}) {
    const params = await searchParams;
    const user = await getSessionUser();
    const academicTerms = await prisma.academicTerm.findMany({ orderBy: { startsOn: "asc" } });
    const choices = advisorTermChoices(academicTerms);
    const term = choices.terms.find((item) => item.id === params.term) ?? choices.terms.find((item) => item.id === choices.defaultTermId) ?? null;
    const statusKey = statusFromQuery[params.status ?? "all"] ? (params.status ?? "all") : "all";
    const sort = ["review", "name", "name-desc", "submitted"].includes(params.sort ?? "") ? params.sort ?? "review" : "review";
    const q = params.q ?? "";
    const page = Number(params.page);

    let failed = false;
    let assigned: Awaited<ReturnType<typeof loadAssignedStudents>> = [];
    try {
        assigned = await loadAssignedStudents(user.id, term?.id ?? "");
    } catch {
        failed = true;
    }

    const rows: RosterRow[] = assigned.map((student) => {
        const plan = student.plannedTerms[0];
        return {
            id: student.id,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            bannerId: student.bannerId,
            planId: plan?.id ?? null,
            status: (plan?.status ?? null) as RosterStatus,
            submittedAt: plan?.submittedAt?.getTime() ?? null,
            reviewedAt: plan?.reviewedAt?.getTime() ?? null,
        };
    });
    const waiting = rows.filter((row) => row.status === "SUBMITTED").length;
    const filtered = sortRoster(filterRoster(rows, {
        q,
        status: statusFromQuery[statusKey] === "all" ? undefined : String(statusFromQuery[statusKey]),
    }), sort);
    const paged = paginateRoster(filtered, Number.isFinite(page) ? page : 1);
    const termLabel = term ? academicTermLabel(term) : "";
    const queryString = new URLSearchParams();
    if (term) queryString.set("term", term.id);
    if (q.trim()) queryString.set("q", q.trim());
    if (statusKey !== "all") queryString.set("status", statusKey);
    if (sort !== "review") queryString.set("sort", sort);
    const returnTo = `/advisor/students${queryString.size ? `?${queryString}` : ""}`;

    const filtersChangedSet = paged.total !== rows.length;

    return (
        <div className="not-typeset flex flex-col gap-6 py-6">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Students</h1>
                <p className="max-w-prose text-balance text-sm text-muted-foreground">Review term plans for the students assigned to you.</p>
            </header>
            {failed ? (
                <DismissibleAlert
                    title="Students could not be loaded"
                    description="Try again."
                    action={<Button nativeButton={false} size="sm" render={<Link href={returnTo}>Try again</Link>} />}
                />
            ) : null}
            {choices.terms.length === 0 ? (
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyTitle>No terms available</EmptyTitle>
                        <EmptyDescription>There is no term open for plan review.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground">
                        {rows.length === 1 ? "1 student" : `${rows.length} students`} · {waiting} waiting for review
                    </p>
                    <RosterControls
                        query={{ term: term?.id ?? "", q, status: statusKey, sort }}
                        terms={choices.terms.map((item) => ({ id: item.id, label: academicTermLabel(item) }))}
                    />
                    {rows.length === 0 ? (
                        <Empty className="border">
                            <EmptyHeader>
                                <EmptyTitle>No students assigned yet</EmptyTitle>
                                <EmptyDescription>Students assigned to you will appear here.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : paged.total === 0 ? (
                        <Empty className="border">
                            <EmptyHeader>
                                <EmptyTitle>No students found</EmptyTitle>
                                <EmptyDescription>Try a different name, student ID, or plan status.</EmptyDescription>
                            </EmptyHeader>
                            <Button className="mt-2" variant="ghost" nativeButton={false} render={<Link href={`/advisor/students?term=${term?.id ?? ""}`}>Clear filters</Link>} />
                        </Empty>
                    ) : (
                        <>
                            {filtersChangedSet ? (
                                <p className="text-sm text-muted-foreground">
                                    {paged.total === 1 ? "1 student matches these filters" : `${paged.total} students match these filters`}
                                </p>
                            ) : null}
                            <div className="hidden xl:block">
                                <Card className="overflow-hidden py-0">
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Student</TableHead>
                                            <TableHead className="w-[16%]">Catalog year</TableHead>
                                            <TableHead className="w-[34%]">Plan status</TableHead>
                                            <TableHead className="w-[20%]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paged.rows.map((row) => {
                                            const student = assigned.find((item) => item.id === row.id);
                                            const name = `${row.firstName} ${row.lastName}`;
                                            return (
                                                <TableRow key={row.id}>
                                                    <TableCell className="align-top">
                                                        <p className="text-pretty text-base font-medium">{name}</p>
                                                        <p className="mt-1 text-sm text-muted-foreground">{row.bannerId ? `Student ID: ${row.bannerId}` : "Student ID not added"}</p>
                                                    </TableCell>
                                                    <TableCell className="align-top whitespace-nowrap tabular-nums">{catalogYearLabel(student?.catalogYear.year)}</TableCell>
                                                    <TableCell className="align-top">
                                                        {row.status ? <Badge variant={plannedTermStatusVariant(row.status)}>{plannedTermStatusLabel(row.status)}</Badge> : <Badge variant="outline">No plan yet</Badge>}
                                                        <p className="mt-1 text-sm text-muted-foreground">{timing(row, termLabel)}</p>
                                                    </TableCell>
                                                    <TableCell className="align-top whitespace-nowrap">{action(row, name, termLabel, returnTo)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                </Card>
                            </div>
                            <div className="space-y-4 xl:hidden">
                                {paged.rows.map((row) => {
                                    const student = assigned.find((item) => item.id === row.id);
                                    const name = `${row.firstName} ${row.lastName}`;
                                    return (
                                        <Card key={row.id}>
                                            <CardHeader>
                                                <p className="text-base font-medium">{name}</p>
                                                <p className="text-sm text-muted-foreground">{row.bannerId ? `Student ID: ${row.bannerId}` : "Student ID not added"}</p>
                                                {row.status ? <Badge variant={plannedTermStatusVariant(row.status)}>{plannedTermStatusLabel(row.status)}</Badge> : <Badge variant="outline">No plan yet</Badge>}
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm">Catalog year: {catalogYearLabel(student?.catalogYear.year)}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">{timing(row, termLabel)}</p>
                                            </CardContent>
                                            <CardFooter>{action(row, name, termLabel, returnTo, true)}</CardFooter>
                                        </Card>
                                    );
                                })}
                            </div>
                            {paged.pages > 1 ? (
                                <nav className="flex items-center justify-between gap-3" aria-label="Student pages">
                                    {paged.page <= 1 ? (
                                        <Button variant="outline" disabled aria-label="Previous page">Previous</Button>
                                    ) : (
                                        <Button variant="outline" nativeButton={false} render={<Link href={pageHref(returnTo, paged.page - 1)} aria-label="Previous page">Previous</Link>} />
                                    )}
                                    <p className="text-sm">Page {paged.page} of {paged.pages}</p>
                                    {paged.page >= paged.pages ? (
                                        <Button variant="outline" disabled aria-label="Next page">Next</Button>
                                    ) : (
                                        <Button variant="outline" nativeButton={false} render={<Link href={pageHref(returnTo, paged.page + 1)} aria-label="Next page">Next</Link>} />
                                    )}
                                </nav>
                            ) : null}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function pageHref(base: string, page: number) {
    const [path, search] = base.split("?");
    const params = new URLSearchParams(search ?? "");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    const text = params.toString();
    return text ? `${path}?${text}` : path ?? "/advisor/students";
}

function action(row: RosterRow, name: string, termLabel: string, returnTo: string, wide = false) {
    if (!row.planId) return <span className="text-sm text-muted-foreground">No plan to open</span>;
    const review = row.status === "SUBMITTED";
    const label = review ? "Review plan" : "View plan";
    return (
        <Button
            className={wide ? "h-11 w-full" : undefined}
            variant={review ? "default" : "outline"}
            nativeButton={false}
            render={(
                <Link
                    href={`/advisor/plans/${row.planId}?from=${encodeURIComponent(returnTo)}`}
                    aria-label={`${label} for ${name}, ${termLabel}`}
                >
                    {label}
                </Link>
            )}
        />
    );
}
