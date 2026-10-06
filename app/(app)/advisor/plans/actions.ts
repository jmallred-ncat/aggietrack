"use server";

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

    const parsed = approvalSchema.safeParse({ plannedTermId, registrationPin });
    if (!parsed.success) {
        return { success: false as const, error: "Enter a registration pin of 4 to 12 letters or numbers." };
    }

    const plan = await prisma.plannedTerm.findFirst({
        where: {
            id: parsed.data.plannedTermId,
            status: "SUBMITTED",
            student: { advisorId: user.id },
        },
        select: {
            id: true,
            studentId: true,
            termId: true,
            courses: { select: { courseId: true, course: { select: { credits: true } } } },
        },
    });
    if (!plan) {
        return { success: false as const, error: "That term plan is not waiting for your review." };
    }

    await prisma.$transaction(async (tx) => {
        await tx.plannedTerm.update({
            where: { id: plan.id },
            data: {
                status: "APPROVED",
                registrationPin: parsed.data.registrationPin,
                reviewedAt: new Date(),
            },
        });
        await recordCoursesInProgress(tx, {
            studentId: plan.studentId,
            termId: plan.termId,
            courses: plan.courses.map((row) => ({
                courseId: row.courseId,
                credits: row.course.credits,
            })),
        });
    });

    revalidatePath("/advisor/plans");
    revalidatePath("/student/planner");
    revalidatePath("/student/progress");
    revalidatePath("/student");
    return { success: true as const };
}
