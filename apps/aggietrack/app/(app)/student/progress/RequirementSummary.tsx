import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { LoggedGroupCredits } from "@/lib/logged-credits";
import pluralize from "pluralize";
import { LoggedCoursesAlert } from "./LoggedCoursesAlert";

function creditLabel(count: number) {
    return pluralize("credit", count, true);
}

export function RequirementSummary({
    programName,
    catalogYear,
    totalCredits,
    groups,
    hasCompletedEntries,
}: {
    programName: string;
    catalogYear: number;
    totalCredits: number;
    groups: LoggedGroupCredits[];
    hasCompletedEntries: boolean;
}) {
    const catalogReady = groups.length > 0;

    return (
        <section className="mt-4 space-y-4 not-typeset">
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted p-4">
                    <p className="text-xs font-medium text-muted-foreground">Program</p>
                    <p className="mt-1 text-sm font-semibold">{programName}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted p-4">
                    <p className="text-xs font-medium text-muted-foreground">Catalog year</p>
                    <p className="mt-1 text-sm font-semibold">{catalogYear}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted p-4">
                    <p className="text-xs font-medium text-muted-foreground">Credits required</p>
                    <p className="mt-1 text-sm font-semibold">{creditLabel(totalCredits)}</p>
                </div>
            </div>

            {catalogReady && !hasCompletedEntries && <LoggedCoursesAlert />}

            {catalogReady ? (
                <div>
                    <h2 className="text-lg font-semibold">Requirements</h2>
                    <p className="mt-1 max-w-prose text-sm text-balance text-muted-foreground">
                        Each group shows the credits this catalog requires and the credits you have logged as complete.
                    </p>
                    <ul className="mt-3 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {groups.map((group) => (
                            <li key={group.id} className="rounded-lg border border-border bg-muted p-4">
                                <h3 className="text-sm font-semibold">{group.name}</h3>
                                <dl className="mt-3 space-y-1 text-sm">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <dt className="text-muted-foreground">Required</dt>
                                        <dd className="font-medium">{creditLabel(group.requiredCredits)}</dd>
                                    </div>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <dt className="text-muted-foreground">Earned</dt>
                                        <dd className="font-medium">{creditLabel(group.earnedCredits)}</dd>
                                    </div>
                                </dl>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <Alert>
                    <AlertTitle>This catalog isn&apos;t ready</AlertTitle>
                    <AlertDescription>
                        {programName}, {catalogYear} catalog does not have requirement groups yet. There is nothing to compare with the courses you log.
                    </AlertDescription>
                </Alert>
            )}
        </section>
    );
}
