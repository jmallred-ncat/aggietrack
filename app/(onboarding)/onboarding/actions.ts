"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { redirect } from "next/navigation";
import { z } from "zod";

const payloadSchema = z.object({
    catalogYearId: z.string().min(1, { message: "Catalog year is required" }),
    bannerId: z.string().trim().optional(),
});

export async function createStudentProfileAction(input: unknown) {
    const user = await getSessionUser();

    if (user.role !== "STUDENT") {
        return { error: "Only students can create a profile here." }
    }

    const existing = await getStudentProfile(user.id);

    if (existing) {
        redirect("/dashboard");
    }

    const parsed = payloadSchema.safeParse(input);
    if (!parsed.success) {
        return { error: parsed.error.message }
    }

    const catalogYear = await prisma.catalogYear.findUnique({
        where: { id: parsed.data.catalogYearId },
        select: { id: true }
    });

    if (!catalogYear) {
        return { error: "That catalog year is not available." }
    }

    const bannerId = parsed.data.bannerId || undefined;

    try {
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                catalogYearId: catalogYear.id,
                bannerId,
            }
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = error.meta?.target;
            if (Array.isArray(target) && target.includes("bannerId")) {
                return { error: "That banner ID is already in use." }
            }
            redirect("/dashboard");
        }
        throw error;
    }

    redirect("/dashboard/account/profile");
}