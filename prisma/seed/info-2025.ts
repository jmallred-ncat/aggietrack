import {
  GenEdTag,
  Grade,
  RequirementSlot,
} from "../../lib/generated/prisma/client";
import { type CourseRef } from "./courses";
import { genEdRequirement, type CurriculumSeed } from "./curriculum";
import { gecAttributes } from "./gec";

const cst = (number: string): CourseRef => ({ subject: "CST", number });
const engl = (number: string): CourseRef => ({ subject: "ENGL", number });
const math = (number: string): CourseRef => ({ subject: "MATH", number });
const frst = (number: string): CourseRef => ({ subject: "FRST", number });
const mgmt = (number: string): CourseRef => ({ subject: "MGMT", number });
const spch = (number: string): CourseRef => ({ subject: "SPCH", number });

const majorCore = [
  cst("112"),
  cst("120"),
  cst("122"),
  cst("130"),
  cst("140"),
  cst("150"),
  cst("225"),
  cst("231"),
  cst("235"),
  cst("240"),
  cst("285"),
  cst("300"),
  cst("315"),
  cst("317"),
  cst("325"),
  cst("329"),
  cst("339"),
  cst("430"),
  cst("460"),
  cst("496"),
  cst("498"),
  cst("499"),
];

export const info2025: CurriculumSeed = {
  groups: [
    {
      name: "CST Major Core",
      slot: RequirementSlot.PROGRAM_CORE,
      minCredits: 56,
      minGrade: Grade.C,
      sortOrder: 10,
      courses: majorCore,
    },
    {
      name: "Mathematics",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 11,
      sortOrder: 20,
      courses: [math("110"), math("131"), math("224")],
    },
    {
      name: "Written Communication",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 6,
      sortOrder: 30,
      courses: [engl("100"), engl("101")],
    },
    {
      name: "College Success",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 1,
      sortOrder: 40,
      courses: [frst("101")],
    },
    {
      name: "Speech Fundamentals",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 3,
      sortOrder: 50,
      courses: [spch("250")],
    },
    {
      name: "Business Environment",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 3,
      sortOrder: 60,
      courses: [mgmt("110")],
    },
    {
      name: "Management Electives",
      slot: RequirementSlot.RELATED_POOL,
      minCredits: 6,
      sortOrder: 70,
      subject: "MGMT",
    },
    genEdRequirement({
      category: GenEdTag.GLOBAL_AWARENESS,
      minCredits: 3,
      sortOrder: 80,
    }),
    genEdRequirement({
      category: GenEdTag.AFRICAN_AMERICAN,
      minCredits: 3,
      sortOrder: 90,
    }),
    genEdRequirement({
      category: GenEdTag.SOCIAL_BEHAVIORAL,
      minCredits: 3,
      sortOrder: 100,
    }),
    genEdRequirement({
      category: GenEdTag.SCIENTIFIC_REASONING,
      requiredTag: GenEdTag.SCIENTIFIC_REASONING_LAB,
      minCredits: 7,
      sortOrder: 110,
    }),
    {
      name: "Technical Electives",
      slot: RequirementSlot.TECHNICAL_ELECTIVE,
      minCredits: 12,
      sortOrder: 120,
      subject: "CST",
    },
    {
      name: "Free Electives",
      slot: RequirementSlot.FREE_ELECTIVE,
      minCredits: 6,
      sortOrder: 130,
      minNumber: 100,
    },
  ],
  // Eight-semester sequence from the Information Technology curriculum guide.
  recommended: [
    {
      sequence: 1,
      courses: [cst("120"), cst("130"), engl("100"), frst("101"), math("110")],
      placeholders: ["Global Awareness"],
    },
    {
      sequence: 2,
      courses: [cst("112"), cst("122"), cst("140"), cst("150"), engl("101"), math("131")],
    },
    {
      sequence: 3,
      courses: [cst("231"), cst("240"), mgmt("110")],
      placeholders: [
        "Social/Behavioral Sciences",
        {
          group: "Scientific Reasoning",
          credits: 4,
          label: "Scientific Reasoning with Lab",
          requiresLab: true,
        },
      ],
    },
    {
      sequence: 4,
      courses: [cst("225"), cst("235"), cst("285"), spch("250")],
      placeholders: [
        { group: "Scientific Reasoning", credits: 3 },
        "African American Studies",
      ],
    },
    {
      sequence: 5,
      courses: [cst("325"), cst("329"), cst("339"), math("224")],
      placeholders: ["Technical Electives"],
    },
    {
      sequence: 6,
      courses: [cst("300"), cst("315"), cst("317"), cst("430")],
      placeholders: ["Technical Electives"],
    },
    {
      sequence: 7,
      courses: [cst("460"), cst("496"), cst("498")],
      placeholders: ["Management Electives", "Free Electives"],
    },
    {
      sequence: 8,
      courses: [cst("499")],
      placeholders: [
        "Management Electives",
        "Technical Electives",
        "Technical Electives",
        "Free Electives",
      ],
    },
  ],
  attributes: gecAttributes,
};
