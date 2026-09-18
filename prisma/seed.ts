import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const program = await prisma.program.upsert({
    where: { code: "0432" },
    update: {
      name: "Information Technology, B.S.",
      totalCredits: 120,
    },
    create: {
      code: "0432",
      name: "Information Technology, B.S.",
      totalCredits: 120,
    },
  });

  const years = [
    { label: "2020-2021", from: "2020-08-15", to: "2021-08-14" },
    { label: "2021-2022", from: "2021-08-15", to: "2022-08-14" },
    { label: "2022-2023", from: "2022-08-15", to: "2023-08-14" },
    { label: "2023-2024", from: "2023-08-15", to: "2024-08-14" },
    { label: "2024-2025", from: "2024-08-15", to: "2025-08-14" },
    { label: "2025-2026", from: "2025-08-15", to: "2026-08-14" },
    { label: "2026-2027", from: "2026-08-15", to: null },
  ] as const;

  const catalogYears = await Promise.all(
    years.map((year) =>
      prisma.catalogYear.upsert({
        where: {
          programId_label: {
            programId: program.id,
            label: year.label,
          },
        },
        update: {
          effectiveFrom: new Date(year.from),
          effectiveTo: year.to ? new Date(year.to) : null,
        },
        create: {
          programId: program.id,
          label: year.label,
          effectiveFrom: new Date(year.from),
          effectiveTo: year.to ? new Date(year.to) : null,
        },
      }),
    ),
  );

  console.log(
    `Seeded program ${program.code} (${program.name}) and catalog years ${catalogYears
      .map((year) => year.label)
      .join(", ")}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
