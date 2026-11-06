/** Path segment for /advisor/plans/[plannedTermId]. The id is looked up; it is not decoded into a term. */
export function advisorPlanIdFromPath(pathname: string | null | undefined) {
    if (!pathname) return null;
    const path = pathname.split("?")[0]?.split("#")[0] ?? "";
    const match = /^\/advisor\/plans\/([^/]+)\/?$/.exec(path);
    const id = match?.[1];
    if (!id) return null;
    try {
        return decodeURIComponent(id);
    } catch {
        return id;
    }
}
