import {
  GenEdTag,
  Grade,
  RequirementKind,
  RequirementSlot,
  TermSeason,
} from "../../lib/generated/prisma/client";
import { type CourseRef } from "./courses";
import { genEdRequirement, type CurriculumSeed } from "./curriculum";
import { gecAttributes } from "./gec";
import { mgmtElectives } from "./mgmt";

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
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.PROGRAM_CORE,
      minCredits: 56,
      minGrade: Grade.C,
      sortOrder: 10,
      courses: majorCore,
    },
    {
      name: "Mathematics",
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 11,
      sortOrder: 20,
      courses: [math("110"), math("131"), math("224")],
    },
    {
      name: "Written Communication",
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 6,
      sortOrder: 30,
      courses: [engl("100"), engl("101")],
    },
    {
      name: "College Success",
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 1,
      sortOrder: 40,
      courses: [frst("101")],
    },
    {
      name: "Speech Fundamentals",
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 3,
      sortOrder: 50,
      courses: [spch("250")],
    },
    {
      name: "Business Environment",
      kind: RequirementKind.ALL_OF,
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 3,
      sortOrder: 60,
      courses: [mgmt("110")],
    },
    {
      name: "Management Electives",
      kind: RequirementKind.CREDITS_FROM_POOL,
      slot: RequirementSlot.RELATED_POOL,
      minCredits: 6,
      sortOrder: 70,
      subject: "MGMT",
      courses: mgmtElectives,
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
      minCredits: 6,
      sortOrder: 100,
    }),
    genEdRequirement({
      category: GenEdTag.SCIENTIFIC_REASONING,
      requiredTag: GenEdTag.SCIENTIFIC_REASONING_LAB,
      minCredits: 4,
      sortOrder: 110,
    }),
    {
      name: "Technical Electives",
      kind: RequirementKind.SUBJECT_ELECTIVE,
      slot: RequirementSlot.TECHNICAL_ELECTIVE,
      minCredits: 12,
      sortOrder: 120,
      subject: "CST",
      minNumber: 200,
    },
    {
      name: "Free Electives",
      kind: RequirementKind.FREE_ELECTIVE,
      slot: RequirementSlot.FREE_ELECTIVE,
      minCredits: 6,
      sortOrder: 130,
      minNumber: 100,
    },
  ],
  recommended: [
    {
      sequence: 1,
      season: TermSeason.FALL,
      courses: [cst("120"), cst("130"), engl("100"), frst("101"), math("110")],
    },
    {
      sequence: 2,
      season: TermSeason.SPRING,
      courses: [cst("112"), cst("122"), cst("140"), cst("150"), engl("101"), math("131")],
    },
    {
      sequence: 3,
      season: TermSeason.FALL,
      courses: [cst("231"), cst("240"), mgmt("110")],
    },
    {
      sequence: 4,
      season: TermSeason.SPRING,
      courses: [cst("225"), cst("235"), cst("285"), spch("250")],
    },
    {
      sequence: 5,
      season: TermSeason.FALL,
      courses: [cst("325"), cst("329"), cst("339"), math("224")],
    },
    {
      sequence: 6,
      season: TermSeason.SPRING,
      courses: [cst("300"), cst("315"), cst("317"), cst("430")],
    },
    {
      sequence: 7,
      season: TermSeason.FALL,
      courses: [cst("460"), cst("496"), cst("498")],
    },
    {
      sequence: 8,
      season: TermSeason.SPRING,
      courses: [cst("499")],
    },
  ],
  attributes: gecAttributes,
};
