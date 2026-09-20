export type CourseSeed = {
  subject: string;
  number: string;
  title: string;
  credits: number;
  isLab?: boolean;
};

export type CourseRef = Pick<CourseSeed, "subject" | "number">;

export function courseKey(course: CourseRef) {
  return `${course.subject}-${course.number}`;
}

/** Named courses from the CST Undergraduate Handbook (August 2025). No descriptions — the handbook defers those to the catalog. GEC electives are merged in seed.ts. */
export const courses: CourseSeed[] = [
  { subject: "CST", number: "112", title: "Electric Circuits I", credits: 3 },
  { subject: "CST", number: "120", title: "Fundamentals of Technology", credits: 3 },
  { subject: "CST", number: "122", title: "Electric Circuits I Lab", credits: 1, isLab: true },
  { subject: "CST", number: "130", title: "Introduction to Unix/Linux", credits: 3 },
  { subject: "CST", number: "140", title: "Intro to Computer Programming", credits: 3 },
  { subject: "CST", number: "150", title: "Intro to Computer Programming Lab", credits: 1, isLab: true },
  { subject: "CST", number: "212", title: "Electric Circuits II", credits: 3 },
  { subject: "CST", number: "213", title: "Digital Circuits", credits: 3 },
  { subject: "CST", number: "222", title: "Electric Circuits II Lab", credits: 1, isLab: true },
  { subject: "CST", number: "223", title: "Digital Circuits Lab", credits: 1, isLab: true },
  { subject: "CST", number: "225", title: "Computer Database Management I", credits: 3 },
  { subject: "CST", number: "231", title: "Web Systems", credits: 3 },
  { subject: "CST", number: "235", title: "Computer Database Management I Lab", credits: 1, isLab: true },
  { subject: "CST", number: "240", title: "Applied Java Programming", credits: 3 },
  { subject: "CST", number: "250", title: "Communication Systems", credits: 3 },
  { subject: "CST", number: "260", title: "Communication Systems Lab", credits: 1, isLab: true },
  { subject: "CST", number: "285", title: "Economic and Social Impacts of IT", credits: 3 },
  { subject: "CST", number: "300", title: "Intro to Project Management", credits: 3 },
  { subject: "CST", number: "312", title: "Active Circuits I", credits: 3 },
  { subject: "CST", number: "313", title: "Applied Hardware & Software Sys I", credits: 3 },
  { subject: "CST", number: "315", title: "Network Security Applications", credits: 3 },
  { subject: "CST", number: "317", title: "Human Computer Interaction", credits: 3 },
  { subject: "CST", number: "322", title: "Active Circuits I Lab", credits: 1, isLab: true },
  { subject: "CST", number: "323", title: "Applied Hardware & Software Sys I Lab", credits: 1, isLab: true },
  { subject: "CST", number: "325", title: "Computer Database Management II", credits: 3 },
  { subject: "CST", number: "329", title: "Computer Networking I", credits: 3 },
  { subject: "CST", number: "339", title: "Computer Networking I Lab", credits: 1, isLab: true },
  { subject: "CST", number: "355", title: "Electrical Power and Machinery", credits: 3 },
  { subject: "CST", number: "430", title: "Linux Systems Administration", credits: 3 },
  { subject: "CST", number: "460", title: "Systems Integration & Architecture", credits: 3 },
  { subject: "CST", number: "496", title: "Senior Colloquium", credits: 1 },
  { subject: "CST", number: "498", title: "Senior Capstone Project I", credits: 3 },
  { subject: "CST", number: "499", title: "Senior Capstone Project II", credits: 3 },
  { subject: "ENGL", number: "100", title: "Ideas and Their Expressions I", credits: 3 },
  { subject: "ENGL", number: "101", title: "Ideas and Their Expressions II", credits: 3 },
  { subject: "FRST", number: "101", title: "College Success", credits: 1 },
  { subject: "MATH", number: "110", title: "Pre-Calculus for Eng/Sci", credits: 4 },
  { subject: "MATH", number: "131", title: "Calculus I", credits: 4 },
  { subject: "MATH", number: "132", title: "Calculus II", credits: 4 },
  { subject: "MATH", number: "224", title: "Intro to Probability & Statistics", credits: 3 },
  { subject: "MGMT", number: "110", title: "Business Environment", credits: 3 },
  { subject: "PHYS", number: "225", title: "College Physics I", credits: 3 },
  { subject: "PHYS", number: "226", title: "College Physics II", credits: 3 },
  { subject: "PHYS", number: "235", title: "College Physics I Lab", credits: 1, isLab: true },
  { subject: "PHYS", number: "236", title: "College Physics II Lab", credits: 1, isLab: true },
  { subject: "SPCH", number: "250", title: "Speech Fundamentals", credits: 3 },
];

/** Lecture/lab pairs that the 8-semester guides place in the same term. */
export const concurrentPairs: [CourseRef, CourseRef][] = [
  [{ subject: "CST", number: "112" }, { subject: "CST", number: "122" }],
  [{ subject: "CST", number: "140" }, { subject: "CST", number: "150" }],
  [{ subject: "CST", number: "212" }, { subject: "CST", number: "222" }],
  [{ subject: "CST", number: "213" }, { subject: "CST", number: "223" }],
  [{ subject: "CST", number: "225" }, { subject: "CST", number: "235" }],
  [{ subject: "CST", number: "250" }, { subject: "CST", number: "260" }],
  [{ subject: "CST", number: "312" }, { subject: "CST", number: "322" }],
  [{ subject: "CST", number: "313" }, { subject: "CST", number: "323" }],
  [{ subject: "CST", number: "329" }, { subject: "CST", number: "339" }],
  [{ subject: "PHYS", number: "225" }, { subject: "PHYS", number: "235" }],
  [{ subject: "PHYS", number: "226" }, { subject: "PHYS", number: "236" }],
];
