import { betterAuth, type User } from "better-auth";
import { createEmailVerificationToken } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { ac, admin as adminRole, advisor, student } from "./permissions";
import { prisma } from "./prisma";

const APP_ROLES = ["STUDENT", "ADVISOR", "ADMIN"] as const;

function resolveAppRole(role: unknown) {
    return APP_ROLES.includes(role as (typeof APP_ROLES)[number])
        ? (role as (typeof APP_ROLES)[number])
        : "STUDENT";
}

type MailUser = User & { firstName?: string };

async function verificationUrlFor(email: string, request?: Request) {
    const { appUrlFromRequest } = await import("./email");
    const token = await createEmailVerificationToken(
        process.env.BETTER_AUTH_SECRET ?? "",
        email,
    );
    const origin = appUrlFromRequest(request);
    return `${origin}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent("/dashboard")}`;
}

async function sendWelcomeVerification(user: MailUser, url: string) {
    const { sendWelcomeEmail } = await import("./email");
    await sendWelcomeEmail(
        {
            email: user.email,
            firstName: user.firstName,
            name: user.name,
        },
        url,
    ).catch((error) => {
        console.error("Welcome email failed:", error);
    });
}

async function sendPasswordReset(user: MailUser, url: string) {
    const { sendPasswordResetEmail } = await import("./email");
    await sendPasswordResetEmail(
        {
            email: user.email,
            firstName: user.firstName,
            name: user.name,
        },
        url,
    ).catch((error) => {
        console.error("Password reset email failed:", error);
    });
}

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: {
        allowedHosts: [
            "localhost:*",
            "127.0.0.1:*",
            "*.vercel.app",
            "aggietrack.space",
            "*.aggietrack.space",
        ],
        fallback: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
        protocol: "auto",
    },
    trustedOrigins: [
        "http://localhost:*",
        "https://*.vercel.app",
        "https://*.aggietrack.space"
    ],
    advanced: {
        trustedProxyHeaders: true,
        useSecureCookies: process.env.VERCEL === "1",
    },
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            await sendPasswordReset(user as MailUser, url);
        },
        onExistingUserSignUp: async ({ user }, request) => {
            if (user.emailVerified) {
                return;
            }
            await sendWelcomeVerification(
                user as MailUser,
                await verificationUrlFor(user.email, request),
            );
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
            await sendWelcomeVerification(user as MailUser, url);
        },
    },
    user: {
        additionalFields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
        }
    },
    databaseHooks: {
        user: {
            create: {
                async before(user: User & Record<string, unknown>) {
                    return { data: { ...user, role: resolveAppRole(user.role) } };
                },
            },
            update: {
                async before(user: Partial<User> & Record<string, unknown>) {
                    if (!("role" in user) || user.role === undefined) {
                        return;
                    }
                    return { data: { ...user, role: resolveAppRole(user.role) } };
                },
            },
        },
    },
    plugins: [admin({
        ac,
        roles: {
            STUDENT: student,
            ADVISOR: advisor,
            ADMIN: adminRole
        },
        defaultRole: "STUDENT",
        adminRoles: ["ADMIN"]
    })]
});
