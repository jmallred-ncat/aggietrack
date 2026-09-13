import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import "dotenv/config";
import type { auth } from "./auth";
import { ac, admin, advisor, student } from "./permissions";

const getBaseUrl = () => {
    if (process.env.BETTER_AUTH_URL) {
        return process.env.BETTER_AUTH_URL;
    }
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return `http://localhost:3000`;
};

export const authClient = createAuthClient({
    baseURL: getBaseUrl(),
    plugins: [inferAdditionalFields<typeof auth>(), adminClient({
        ac,
        roles: {
            STUDENT: student,
            ADVISOR: advisor,
            ADMIN: admin
        }
    })],
});

export const authReactClient = createReactAuthClient({
    baseURL: getBaseUrl(),
    plugins: [inferAdditionalFields<typeof auth>(), adminClient({
        ac,
        roles: {
            STUDENT: student,
            ADVISOR: advisor,
            ADMIN: admin
        }
    })],
});