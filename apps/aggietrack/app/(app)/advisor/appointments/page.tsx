import {
    addAvailabilityAction,
    cancelSessionAction,
    discardTermDraftAction,
    moveOpenSlotAction,
    publishTermAction,
    removeOpenSlotAction,
    removeZoomAction,
    rescheduleChoicesAction,
    rescheduleSessionAction,
    reviewTermAction,
    saveDurationAction,
    saveTermDraftAction,
    saveZoomAction,
} from "@/app/(app)/advising-actions";
import { AdvisorBoard } from "@/components/advising/advisor-board";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { Button } from "@/components/ui/button";
import { loadAdvisorAppointments } from "@/lib/advising-meetings";
import type { AdvisorAppointmentsView } from "@/lib/advising-types";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

async function load(userId: string, termId?: string): Promise<{ failed: boolean; view: AdvisorAppointmentsView | null }> {
    try {
        return { failed: false, view: await loadAdvisorAppointments(prisma, userId, new Date(), termId) };
    } catch {
        return { failed: true, view: null };
    }
}

export default async function AppointmentsPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string; session?: string; term?: string }>;
}) {
    const user = await getSessionUser();
    const query = await searchParams;
    const mode = query.view === "availability" ? "availability" : "sessions";
    const search = new URLSearchParams();
    if (query.view) search.set("view", query.view);
    if (query.session) search.set("session", query.session);
    if (query.term) search.set("term", query.term);
    const result = await load(user.id, query.term);
    if (result.failed) {
        return (
            <div className="not-typeset flex flex-col gap-6 py-6">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Appointments</h1>
                <DismissibleAlert
                    stacked
                    title="Appointments could not be loaded"
                    description="Try again to see your latest times and sessions."
                    action={<Button nativeButton={false} size="sm" render={<Link href="/advisor/appointments">Try again</Link>} />}
                />
            </div>
        );
    }
    if (!result.view) {
        return (
            <div className="not-typeset flex flex-col gap-4 py-6">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">This session is unavailable</h1>
                <p>It does not exist or you do not have access to it.</p>
                <Button nativeButton={false} variant="outline" render={<Link href="/advisor/appointments">Back to appointments</Link>} />
            </div>
        );
    }
    return (
        <AdvisorBoard
            view={result.view}
            nowIso={new Date().toISOString()}
            mode={mode}
            search={search.toString()}
            sessionId={query.session}
            actions={{
                saveDuration: saveDurationAction,
                addWindow: addAvailabilityAction,
                addOne: addAvailabilityAction,
                move: moveOpenSlotAction,
                remove: removeOpenSlotAction,
                cancel: cancelSessionAction,
                reschedule: rescheduleSessionAction,
                choices: rescheduleChoicesAction,
                saveZoom: saveZoomAction,
                removeZoom: removeZoomAction,
            }}
            scheduleActions={{
                saveDraft: saveTermDraftAction,
                discardDraft: discardTermDraftAction,
                review: reviewTermAction,
                publish: publishTermAction,
                addWindow: addAvailabilityAction,
                addOne: addAvailabilityAction,
            }}
        />
    );
}
