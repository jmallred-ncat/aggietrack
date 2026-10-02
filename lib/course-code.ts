const courseCodePattern = /^([A-Z]{2,4})\s*(\d{3}[A-Z]?)$/;

export function parseCourseCode(input: string): { subject: string; number: string } | null {
    const match = input.trim().toUpperCase().match(courseCodePattern);
    if (!match) {
        return null;
    }

    return { subject: match[1], number: match[2] };
}

export function courseCodeLabel(subject: string, number: string) {
    return `${subject.toUpperCase()} ${number.toUpperCase()}`;
}
