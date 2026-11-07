import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "@/components/ui/circular-progress";
import { MedalIcon } from "@phosphor-icons/react/dist/ssr";

export type DashboardHonor = "Summa Cum Laude" | "Magna Cum Laude" | "Cum Laude";

/** Eligible honors keep the pace qualifier. Under 48 resident hours, the honor is provisional. */
export function honorBadgeLabel(honor: DashboardHonor | null, eligible: boolean) {
    if (!honor) {
        return null;
    }
    return eligible ? `${honor} pace` : `On track for ${honor}`;
}

export function DashboardTiles({
    earnedCredits,
    totalCredits,
    percentage,
    targetLabel,
    gpa,
    honor,
    honorEligible,
}: {
    earnedCredits: number;
    totalCredits: number;
    percentage: number;
    /** Human term label, such as "Spring 2028". Null omits the target line. */
    targetLabel: string | null;
    gpa: number | null;
    honor: DashboardHonor | null;
    honorEligible: boolean;
}) {
    const badge = gpa !== null ? honorBadgeLabel(honor, honorEligible) : null;

    return (
        <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
            <div className="flex h-full min-w-0 flex-col items-center space-y-3 rounded-lg border border-border bg-muted p-4 text-center not-typeset">
                <span className="text-sm font-semibold">Degree Completion</span>
                <div className="flex flex-1 items-center justify-center">
                    <CircularProgress
                        strokeWidth={16}
                        size={120}
                        value={earnedCredits}
                        max={totalCredits}
                        label={`${percentage}%`}
                        labelClassName="text-2xl font-semibold tabular-nums"
                    />
                </div>
                <p className="text-center text-xs leading-tight text-muted-foreground">
                    {earnedCredits} of {totalCredits} Credits ({percentage}%)
                </p>
                {targetLabel ? (
                    <p className="max-w-full text-center text-sm text-balance text-muted-foreground">Target: {targetLabel}</p>
                ) : null}
            </div>
            <div className="flex h-full min-w-0 flex-col items-center space-y-3 rounded-lg border border-border bg-muted p-4 text-center not-typeset">
                <span className="text-sm font-semibold">GPA</span>
                <div className="flex flex-1 items-center justify-center">
                    {gpa !== null ? (
                        <p className="text-3xl font-semibold tabular-nums">{gpa.toFixed(2)}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground">No GPA yet</p>
                    )}
                </div>
                {gpa !== null ? <p className="text-xs leading-tight text-muted-foreground" aria-hidden="true">&nbsp;</p> : null}
                {badge ? (
                    <div className="flex max-w-full flex-wrap items-center justify-center">
                        <MedalIcon weight="fill" size={24} className="mr-2 shrink-0 text-primary" aria-hidden="true" />
                        <Badge
                            variant={honorEligible ? "default" : "outline"}
                            className={honorEligible ? "h-auto max-w-full whitespace-normal" : "h-auto max-w-full whitespace-normal text-muted-foreground"}
                        >
                            {badge}
                        </Badge>
                    </div>
                ) : gpa !== null ? (
                    <div className="h-8" />
                ) : null}
            </div>
        </section>
    );
}
