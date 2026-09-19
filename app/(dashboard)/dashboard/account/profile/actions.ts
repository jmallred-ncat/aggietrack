"use server";

import { prisma } from "@/lib/prisma";

export async function updateBannerId(userId: string, bannerId: string) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            studentProfile: true,
        }
    });

    if (!user) {
        return { success: false, error: "User not found" };
    }

    if (!user.studentProfile) {
        return { success: false, error: "Student profile not found" };
    }

    const studentProfile = await prisma.studentProfile.update({
        where: {
            id: user.studentProfile.id,
        },
        data: {
            bannerId: bannerId,
        },
    });

    if (!studentProfile) {
        return { success: false, error: "Failed to update student profile" };
    }

    return { success: true, data: studentProfile };
}