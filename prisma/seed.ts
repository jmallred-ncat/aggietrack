import "dotenv/config";
import { prisma } from "../lib/prisma";
import { academicTerms } from "./seed/academic-terms";
import {
  concurrentPairs as handbookConcurrentPairs,
  courses as handbookCourses,
  courseKey,
} from "./seed/courses";
import { replaceCurriculum } from "./seed/curriculum";
import { degrees } from "./seed/degrees";
import { departments } from "./seed/departments";
import { elet2025 } from "./seed/elet-2025";
import {
  gecAttributes,
  gecCourses,
  gecCatalogRelations,
  mergeGecConcurrentPairs,
  mergeGecCourses,
} from "./seed/gec";
import { info2025 } from "./seed/info-2025";
import { mergeCstCatalogCourses, mergeCstCatalogConcurrentPairs, cstTechnicalElectiveCandidates, cstCatalogRelations } from "./seed/cst-catalog";
import {
  mergeMgmtConcurrentPairs,
  mergeMgmtCourses,
  mgmtCatalogRelations,
  mgmtElectives,
} from "./seed/mgmt";

const INFO_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
const HANDBOOK_YEAR = 2025;

const courses = mergeCstCatalogCourses(
  mergeMgmtCourses(mergeGecCourses(handbookCourses)),
);
const concurrentPairs = mergeMgmtConcurrentPairs(
  mergeCstCatalogConcurrentPairs(
    mergeGecConcurrentPairs(handbookConcurrentPairs),
  ),
);
const catalogPrerequisiteRelations = [
  ...cstCatalogRelations,
  ...gecCatalogRelations,
  ...mgmtCatalogRelations,
];

async function seedDegrees() {
  const seeded = await Promise.all(
    degrees.map((degree) =>
      prisma.degree.upsert({
        where: { abbreviation: degree.abbreviation },
        update: {
          name: degree.name,
          level: degree.level,
          isActive: true,
          sortOrder: degree.sortOrder,
        },
        create: {
          name: degree.name,
          abbreviation: degree.abbreviation,
          level: degree.level,
          sortOrder: degree.sortOrder,
        },
      }),
    ),
  );

  const bachelorOfScience = seeded.find((degree) => degree.abbreviation === "B.S.");
  if (!bachelorOfScience) {
    throw new Error("Bachelor of Science degree was not seeded");
  }

  return bachelorOfScience;
}

async function seedCourses() {
  const courseIds = new Map<string, string>();

  for (const course of courses) {
    const row = await prisma.course.upsert({
      where: {
        subject_number: {
          subject: course.subject,
          number: course.number,
        },
      },
      update: {
        title: course.title,
        credits: course.credits,
        description: course.description ?? null,
        isLab: course.isLab ?? false,
        offeredIn: course.offeredIn ?? [],
      },
      create: {
        subject: course.subject,
        number: course.number,
        title: course.title,
        credits: course.credits,
        description: course.description ?? null,
        isLab: course.isLab ?? false,
        offeredIn: course.offeredIn ?? [],
      },
    });

    courseIds.set(courseKey(course), row.id);
  }

  for (const [lecture, lab] of concurrentPairs) {
    const lectureId = courseIds.get(courseKey(lecture));
    const labId = courseIds.get(courseKey(lab));
    if (!lectureId || !labId) {
      throw new Error(`Missing concurrent pair ${courseKey(lecture)} / ${courseKey(lab)}`);
    }

    await prisma.coursePrerequisite.upsert({
      where: {
        courseId_requiresId: {
          courseId: lectureId,
          requiresId: labId,
        },
      },
      update: { isConcurrent: true },
      create: {
        courseId: lectureId,
        requiresId: labId,
        isConcurrent: true,
      },
    });

    await prisma.coursePrerequisite.upsert({
      where: {
        courseId_requiresId: {
          courseId: labId,
          requiresId: lectureId,
        },
      },
      update: { isConcurrent: true },
      create: {
        courseId: labId,
        requiresId: lectureId,
        isConcurrent: true,
      },
    });
  }

  for (const relation of catalogPrerequisiteRelations) {
    if (relation.isConcurrent) {
      continue; // already handled via concurrentPairs
    }

    const courseId = courseIds.get(courseKey(relation.course));
    const requiresId = courseIds.get(courseKey(relation.requires));
    if (!courseId || !requiresId) {
      continue; // missing targets stay description-only
    }

    await prisma.coursePrerequisite.upsert({
      where: {
        courseId_requiresId: {
          courseId,
          requiresId,
        },
      },
      update: { isConcurrent: false },
      create: {
        courseId,
        requiresId,
        isConcurrent: false,
      },
    });
  }

  return courseIds;
}

async function seedDepartments() {
  const seeded = await Promise.all(
    departments.map((department) =>
      prisma.department.upsert({
        where: { abbreviation: department.abbreviation },
        update: {
          name: department.name,
          isActive: true,
          sortOrder: department.sortOrder,
        },
        create: {
          name: department.name,
          abbreviation: department.abbreviation,
          sortOrder: department.sortOrder,
        },
      }),
    ),
  );

  const computerSystemsTechnology = seeded.find((department) => department.abbreviation === "CST");
  if (!computerSystemsTechnology) {
    throw new Error("Computer Systems Technology department was not seeded");
  }

  return computerSystemsTechnology;
}

async function seedProgram(input: {
  code: string;
  shortName: string;
  name: string;
  totalCredits: number;
  degreeId: string;
  departmentId: string;
}) {
  return prisma.program.upsert({
    where: { code: input.code },
    update: {
      shortName: input.shortName,
      name: input.name,
      totalCredits: input.totalCredits,
      degreeId: input.degreeId,
      departmentId: input.departmentId,
    },
    create: input,
  });
}

async function seedCatalogYears(programId: string, years: readonly number[]) {
  return Promise.all(
    years.map((year) =>
      prisma.catalogYear.upsert({
        where: {
          programId_year: {
            programId,
            year,
          },
        },
        update: {},
        create: {
          programId,
          year,
        },
      }),
    ),
  );
}

async function seedAcademicTerms() {
  const seeded = await Promise.all(
    academicTerms.map((term) =>
      prisma.academicTerm.upsert({
        where: {
          season_year: {
            season: term.season,
            year: term.year,
          },
        },
        update: {
          startsOn: term.startsOn,
          endsOn: term.endsOn,
        },
        create: {
          season: term.season,
          year: term.year,
          startsOn: term.startsOn,
          endsOn: term.endsOn,
        },
      }),
    ),
  );

  const keepKeys = new Set(
    academicTerms.map((term) => `${term.season}:${term.year}`),
  );
  const existing = await prisma.academicTerm.findMany({
    select: { id: true, season: true, year: true },
  });
  const staleIds = existing
    .filter((term) => !keepKeys.has(`${term.season}:${term.year}`))
    .map((term) => term.id);

  if (staleIds.length > 0) {
    await prisma.academicTerm.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  return { seeded, removed: staleIds.length };
}

async function main() {
  const bachelorOfScience = await seedDegrees();
  const computerSystemsTechnology = await seedDepartments();
  const { seeded: terms, removed: termsRemoved } = await seedAcademicTerms();
  const courseIds = await seedCourses();

  const informationTechnology = await seedProgram({
    code: "0432",
    shortName: "INFO",
    name: "Information Technology",
    totalCredits: 120,
    degreeId: bachelorOfScience.id,
    departmentId: computerSystemsTechnology.id,
  });

  const electronicsTechnology = await seedProgram({
    code: "0340",
    shortName: "ELET",
    name: "Electronics Technology",
    totalCredits: 120,
    degreeId: bachelorOfScience.id,
    departmentId: computerSystemsTechnology.id,
  });

  const infoYears = await seedCatalogYears(informationTechnology.id, INFO_YEARS);
  const eletYears = await seedCatalogYears(electronicsTechnology.id, [HANDBOOK_YEAR]);

  const info2025Year = infoYears.find((year) => year.year === HANDBOOK_YEAR);
  const elet2025Year = eletYears.find((year) => year.year === HANDBOOK_YEAR);
  if (!info2025Year || !elet2025Year) {
    throw new Error("2025 catalog years were not seeded");
  }

  await replaceCurriculum(prisma, info2025Year.id, courseIds, info2025);
  await replaceCurriculum(prisma, elet2025Year.id, courseIds, elet2025);

  console.log(
    `Seeded ${degrees.length} degrees, ${departments.length} departments, ${terms.length} academic terms (NCAT Fall/Spring/Summer/I/II; removed ${termsRemoved} out-of-scope), ${courses.length} courses (${gecCourses.length} GEC catalog courses / ${gecAttributes.length} GEC attributes, ${mgmtElectives.length} MGMT electives, ${cstTechnicalElectiveCandidates.length} CST ≥200 catalog courses), programs ${informationTechnology.code} and ${electronicsTechnology.code}, and 2025 CST handbook curricula.`,
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
