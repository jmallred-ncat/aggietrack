import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import "dotenv/config";
import type { auth } from "./auth";


export const authClient = createAuthClient({
    baseURL: `${process.env.BETTER_AUTH_URL}`,
    plugins: [inferAdditionalFields<typeof auth>()],
});

export const authReactClient = createReactAuthClient({
    baseURL: `${process.env.BETTER_AUTH_URL}`,
    plugins: [inferAdditionalFields<typeof auth>()],
});