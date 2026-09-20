export function formatProgramName(program: {
    name: string;
    degree: { abbreviation: string };
}) {
    return `${program.degree.abbreviation} ${program.name}`;
}
