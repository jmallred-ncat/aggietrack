"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import { revalidatePath } from "next/cache";

export async function updateBannerId(bannerId: string) {
    const user = await getSessionUser();
    const trimmed = bannerId.trim();

    if (!trimmed) {
        return { success: false as const, error: "Banner ID is required." };
    }

    try {
        await prisma.studentProfile.update({
            where: {
                userId: user.id,
            },
            data: {
                bannerId: trimmed,
            },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const target = error.meta?.target;
            if (Array.isArray(target) && target.includes("bannerId")) {
                return { success: false as const, error: "That banner ID is already in use." };
            }
        }
        return { success: false as const, error: "Failed to update student profile." };
    }

    revalidatePath("/dashboard/account/profile");
    return { success: true as const };
}
