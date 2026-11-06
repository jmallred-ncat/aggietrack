/**
 * Credits stored on a new attempt.
 * A catalog course uses the course record. The number sent by the browser is ignored.
 * A course that is not in the catalog keeps the credits the student entered.
 */
export function resolveAttemptCredits(input: {
    courseId: string | null;
    catalogCredits: number | null;
    clientCredits: number;
}): { ok: true; credits: number } | { ok: false; error: string } {
    if (input.courseId) {
        const credits = input.catalogCredits;
        if (typeof credits !== "number" || !Number.isInteger(credits) || credits < 1) {
            return { ok: false, error: "Course details unavailable." };
        }
        return { ok: true, credits };
    }

    if (!Number.isInteger(input.clientCredits) || input.clientCredits < 1 || input.clientCredits > 6) {
        return { ok: false, error: "Invalid attempt request." };
    }

    return { ok: true, credits: input.clientCredits };
}

/** Read-only credit line. One credit is singular. */
export function attemptCreditPhrase(credits: number): string {
    return credits === 1 ? "1 credit" : `${credits} credits`;
}

/** A named course can be retaken only when its catalog credits are a real positive number. */
export function catalogCreditsReady(credits: number): boolean {
    return Number.isInteger(credits) && credits >= 1;
}
