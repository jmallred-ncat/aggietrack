"use server";

import { approveIfAssigned } from "@/lib/plan-approval-authz";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import { recordCoursesInProgress } from "@/lib/transcript";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const approvalSchema = z.object({
    plannedTermId: z.string().min(1),
    registrationPin: z.string().trim().regex(/^[A-Za-z0-9]{4,12}$/),
});

export async function approvePlannedTerm(plannedTermId: string, registrationPin: string) {
    const user = await getSessionUser();
    if (user.role !== "ADVISOR") {
        return { success: false as const, error: "Only an advisor can approve a term plan." };
    }
    // The advisor is the signed-in user. The client cannot supply an advisor id.
    const advisorId = user.id;

    const parsed = approvalSchema.safeParse({ plannedTermId, registrationPin });
    if (!parsed.success) {
        return { success: false as const, error: "Enter a registration pin of 4 to 12 letters or numbers." };
    }

    const outcome = await prisma.$transaction(async (tx) => {
        const plan = await tx.plannedTerm.findUnique({
            where: { id: parsed.data.plannedTermId },
            select: {
                id: true,
                status: true,
                studentId: true,
                termId: true,
                student: { select: { advisorId: true } },
                courses: { select: { courseId: true, course: { select: { credits: true } } } },
            },
        });

        return approveIfAssigned({
            advisorId,
            plan,
            persist: async (approved) => {
                const updated = await tx.plannedTerm.updateMany({
                    where: {
                        id: approved.id,
                        status: "SUBMITTED",
                        student: { advisorId },
                    },
                    data: {
                        status: "APPROVED",
                        registrationPin: parsed.data.registrationPin,
                        reviewedAt: new Date(),
                    },
                });
                if (updated.count !== 1) {
                    return false;
                }
                await recordCoursesInProgress(tx, {
                    studentId: approved.studentId,
                    termId: approved.termId,
                    courses: approved.courses.map((row) => ({
                        courseId: row.courseId,
                        credits: row.course.credits,
                    })),
                });
                return true;
            },
        });
    });
    if (!outcome.success) {
        return outcome;
    }

    revalidatePath("/advisor/plans");
    revalidatePath("/student/planner");
    revalidatePath("/student/progress");
    revalidatePath("/student");
    return { success: true as const };
}
