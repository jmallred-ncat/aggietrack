export const CATALOG_BROWSER_LABEL = "Catalog browser";

type CourseSearchFields = {
    subject: string;
    number: string;
    title: string;
};

/**
 * Code or title match shared by the catalog browser and the planner search.
 * The planner also waits for two characters and shows at most eight suggestions.
 */
export function courseMatchesSearch(course: CourseSearchFields, query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return false;
    }

    return `${course.subject} ${course.number} ${course.title}`.toLowerCase().includes(needle);
}
