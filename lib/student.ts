import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CatalogYear, StudentProfile, User } from "./generated/prisma/client";
import { prisma } from "./prisma";

export async function getSessionUser() {
    const response = await auth.api.getSession({
        headers: await headers(),
    });
    if (!response?.user) {
        return redirect("/");
    }
    return response.user as User;
}

export type StudentProfileWithCatalog = NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>;

export async function getStudentProfile(userId: User["id"]) {
    const profile = await prisma.studentProfile.findUnique({
        where: {
            userId,
        },
        include: {
            catalogYear: {
                include: {
                    program: {
                        include: {
                            degree: true,
                            department: true,
                        },
                    },
                }
            }
        }
    });

    if (!profile) {
        return null;
    }

    return profile;
}

export async function requireStudentProfile(userId: User["id"]) {
    const profile = await getStudentProfile(userId);
    if (!profile) {
        throw new Error("Student profile not found");
    }
    return profile;
}

export async function createStudentProfile(userId: User["id"], catalogYearId: CatalogYear["id"]) {
    const profile = await prisma.studentProfile.create({
        data: {
            userId,
            catalogYearId,
        }
    });
    return { success: true, profile: profile as StudentProfile };
}