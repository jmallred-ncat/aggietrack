import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { ac, admin, advisor, student } from "./permissions";

const adminPlugin = adminClient({
    ac,
    roles: {
        STUDENT: student,
        ADVISOR: advisor,
        ADMIN: admin,
    },
});

export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), adminPlugin],
});

export const authReactClient = createReactAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), adminPlugin],
});
