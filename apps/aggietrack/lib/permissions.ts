import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";


const statement = {
    ...defaultStatements
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({});

export const advisor = ac.newRole({});

export const admin = ac.newRole({
    ...adminAc.statements
})