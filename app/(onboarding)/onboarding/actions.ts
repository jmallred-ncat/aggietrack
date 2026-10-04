"use server";

import { getCatalogYearsForPrograms } from "@/lib/catalog";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { redirect } from "next/navigation";
import { z } from "zod";

const payloadSchema = z.object({
    catalogYearId: z.string().min(1, { message: "Catalog year is required" }),
});

export async function createStudentProfileAction(input: unknown) {
    const user = await getSessionUser();

    if (user.role !== "STUDENT") {
        return { error: "Only students can create a profile here." }
    }

    const existing = await getStudentProfile();

    if (existing) {
        redirect("/student");
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

    try {
        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                catalogYearId: catalogYear.id,
            }
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            redirect("/student");
        }
        throw error;
    }

    redirect("/student/progress");
}

export async function searchProgramsAction(query: string) {
    return await getCatalogYearsForPrograms(query);
}