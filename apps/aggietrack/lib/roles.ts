export function homePathForRole(role: string | null | undefined) {
    if (role === "ADVISOR") {
        return "/advisor";
    }
    if (role === "ADMIN") {
        return "/admin";
    }
    return "/student";
}
