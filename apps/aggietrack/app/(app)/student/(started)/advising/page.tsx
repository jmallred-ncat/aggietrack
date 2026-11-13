import {
    bookSessionAction,
    cancelSessionAction,
    rescheduleChoicesAction,
    rescheduleSessionAction,
} from "@/app/(app)/advising-actions";
import { StudentBoard } from "@/components/advising/student-board";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { Button } from "@/components/ui/button";
import { loadStudentAdvising } from "@/lib/advising-meetings";
import type { StudentAdvisingView } from "@/lib/advising-types";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

async function load(userId: string): Promise<{ failed: boolean; view: StudentAdvisingView | null }> {
    try {
        return { failed: false, view: await loadStudentAdvising(prisma, userId) };
    } catch {
        return { failed: true, view: null };
    }
}

export default async function AdvisingPage() {
    const user = await getSessionUser();
    const result = await load(user.id);
    if (result.failed) {
        return (
            <div className="not-typeset flex flex-col gap-6 py-6">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Advising</h1>
                <DismissibleAlert
                    stacked
                    title="Advising could not be loaded"
                    description="Try again to see the latest times."
                    action={<Button nativeButton={false} size="sm" render={<Link href="/student/advising">Try again</Link>} />}
                />
            </div>
        );
    }
    if (!result.view) {
        return (
            <div className="not-typeset flex flex-col gap-4 py-6">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">This session is unavailable</h1>
                <p>It does not exist or you do not have access to it.</p>
                <Button nativeButton={false} variant="outline" render={<Link href="/student">Back to advising</Link>} />
            </div>
        );
    }
    return (
        <StudentBoard
            view={result.view}
            actions={{
                book: bookSessionAction,
                cancel: cancelSessionAction,
                reschedule: rescheduleSessionAction,
                choices: rescheduleChoicesAction,
            }}
        />
    );
}
