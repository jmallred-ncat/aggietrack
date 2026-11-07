import { FlaskIcon, LecternIcon } from "@phosphor-icons/react";

const markClass = "size-2 shrink-0 rounded-full bg-destructive";

export function PrerequisiteMark({ decorative = false }: { decorative?: boolean }) {
    if (decorative) {
        return <span className={markClass} aria-hidden="true" />;
    }
    return <span className={markClass} role="img" aria-label="Has a prerequisite or corequisite" />;
}

export function CourseKindIcon({ lab, decorative = false }: { lab: boolean; decorative?: boolean }) {
    const Icon = lab ? FlaskIcon : LecternIcon;
    if (decorative) return <Icon size={16} weight="bold" aria-hidden="true" />;
    return <Icon size={16} weight="bold" role="img" aria-label={lab ? "Lab" : "Lecture"} />;
}

export function CourseIconLegend() {
    return (
        <div
            role="region"
            aria-label="Course card symbols"
            className="mt-4 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"
        >
            <span className="text-sm font-medium text-foreground">On each card</span>
            <span className="inline-flex items-center gap-2">
                <PrerequisiteMark decorative />
                Prerequisite or corequisite
            </span>
            <span className="inline-flex items-center gap-2">
                <CourseKindIcon lab={false} decorative />
                Lecture
            </span>
            <span className="inline-flex items-center gap-2">
                <CourseKindIcon lab decorative />
                Lab
            </span>
        </div>
    );
}
