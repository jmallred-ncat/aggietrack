import {
  GenEdTag,
  Grade,
  RequirementSlot,
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
const phys = (number: string): CourseRef => ({ subject: "PHYS", number });
const spch = (number: string): CourseRef => ({ subject: "SPCH", number });

const majorCore = [
  cst("112"),
  cst("120"),
  cst("122"),
  cst("130"),
  cst("140"),
  cst("150"),
  cst("212"),
  cst("213"),
  cst("222"),
  cst("223"),
  cst("240"),
  cst("250"),
  cst("260"),
  cst("300"),
  cst("312"),
  cst("313"),
  cst("322"),
  cst("323"),
  cst("329"),
  cst("339"),
  cst("355"),
  cst("496"),
  cst("498"),
  cst("499"),
];

export const elet2025: CurriculumSeed = {
  groups: [
    {
      name: "CST Major Core",
      slot: RequirementSlot.PROGRAM_CORE,
      minCredits: 54,
      minGrade: Grade.C,
      sortOrder: 10,
      courses: majorCore,
    },
    {
      name: "Mathematics",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 15,
      sortOrder: 20,
      courses: [math("110"), math("131"), math("132"), math("224")],
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
      name: "Physics",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 8,
      sortOrder: 60,
      courses: [phys("225"), phys("235"), phys("226"), phys("236")],
    },
    {
      name: "Business Environment",
      slot: RequirementSlot.SUPPORTING_REQUIRED,
      minCredits: 3,
      sortOrder: 70,
      courses: [mgmt("110")],
    },
    {
      name: "Management Electives",
      slot: RequirementSlot.RELATED_POOL,
      minCredits: 6,
      sortOrder: 80,
      courses: mgmtElectives,
    },
    genEdRequirement({
      category: GenEdTag.GLOBAL_AWARENESS,
      minCredits: 3,
      sortOrder: 90,
    }),
    genEdRequirement({
      category: GenEdTag.AFRICAN_AMERICAN,
      minCredits: 3,
      sortOrder: 100,
    }),
    genEdRequirement({
      category: GenEdTag.SOCIAL_BEHAVIORAL,
      minCredits: 3,
      sortOrder: 110,
    }),
    {
      name: "Technical Electives",
      slot: RequirementSlot.TECHNICAL_ELECTIVE,
      minCredits: 9,
      sortOrder: 120,
      subject: "CST",
      minNumber: 200,
    },
    {
      name: "Free Electives",
      slot: RequirementSlot.FREE_ELECTIVE,
      minCredits: 6,
      sortOrder: 130,
      minNumber: 100,
    },
  ],
  recommended: [
    {
      sequence: 1,
      courses: [cst("120"), cst("130"), engl("100"), frst("101"), math("110")],
    },
    {
      sequence: 2,
      courses: [cst("112"), cst("122"), cst("140"), cst("150"), engl("101"), math("131")],
    },
    {
      sequence: 3,
      courses: [cst("212"), cst("222"), cst("240"), math("132"), spch("250")],
    },
    {
      sequence: 4,
      courses: [cst("213"), cst("223"), cst("250"), cst("260"), math("224")],
    },
    {
      sequence: 5,
      courses: [cst("312"), cst("322"), cst("329"), cst("339"), cst("355"), phys("225"), phys("235")],
    },
    {
      sequence: 6,
      courses: [cst("300"), cst("313"), cst("323"), mgmt("110"), phys("226"), phys("236")],
    },
    {
      sequence: 7,
      courses: [cst("496"), cst("498")],
    },
    {
      sequence: 8,
      courses: [cst("499")],
    },
  ],
  attributes: gecAttributes,
};
