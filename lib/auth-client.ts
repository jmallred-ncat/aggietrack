import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient as createReactAuthClient } from "better-auth/react";
import { ac, admin, advisor, student } from "./permissions";

const additionalFields = inferAdditionalFields({
    user: {
        firstName: {
            type: "string",
            required: true,
        },
        lastName: {
            type: "string",
            required: true,
        },
    },
});

const adminPlugin = adminClient({
    ac,
    roles: {
        STUDENT: student,
        ADVISOR: advisor,
        ADMIN: admin,
    },
});

export const authClient = createAuthClient({
    plugins: [additionalFields, adminPlugin],
});

export const authReactClient = createReactAuthClient({
    plugins: [additionalFields, adminPlugin],
});
