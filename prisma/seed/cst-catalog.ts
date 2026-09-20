import { type CourseSeed, courseKey } from "./courses";

/**
 * NCAT Undergraduate Catalog — Computer System Technology (CST).
 * https://catalog.ncat.edu/content.php?catoid=5&navoid=182
 * (CST listings span filter pages 7–8)
 *
 * Handbook major-core CST courses live in courses.ts; this file adds the
 * remaining catalog CST rows so SUBJECT_ELECTIVE (CST ≥ 200) pickers have
 * non-core options. Credits: 3 lecture / 1 lab unless noted.
 */

const c = (
  number: string,
  title: string,
  credits = 3,
  isLab = false,
): CourseSeed => ({ subject: "CST", number, title, credits, isLab });

export const cstCatalogCourses: CourseSeed[] = [
  c("101", "Microcomputer Applications"),
  c("112", "Electric Circuits I"),
  c("120", "Fundamentals of Technology"),
  c("122", "Electric Circuits I Laboratory", 1, true),
  c("130", "Introduction to Unix/Linux"),
  c("140", "Introduction to Computer Programming"),
  c("150", "Introduction to Computer Programming Laboratory", 1, true),
  c("212", "Electric Circuits II"),
  c("213", "Digital Circuits"),
  c("222", "Electric Circuits II Laboratory", 1, true),
  c("223", "Digital Circuits Laboratory", 1, true),
  c("225", "Computer Database Management I"),
  c("231", "Web Systems"),
  c("235", "Computer Database Management Laboratory", 1, true),
  c("240", "Applied Java Programming"),
  c("250", "Communications Systems"),
  c("260", "Communication Systems Laboratory", 1, true),
  c("285", "Economic and Social Impacts of Information Technology"),
  c("300", "Introduction to Project Management for Information Technology Professionals"),
  c("305", "Foundations of Storage Technology"),
  c("306", "Big Data Analytics"),
  c("312", "Active Circuits I"),
  c("313", "Applied Hardware and Software Systems I"),
  c("314", "Active Circuits II"),
  c("315", "Network Security for Information Technology Professionals"),
  c("316", "Information Security"),
  c("317", "Human Computer Interaction"),
  c("322", "Active Circuits I Laboratory", 1, true),
  c("323", "Applied Hardware and Software Laboratory", 1, true),
  c("325", "Computer Database Management II"),
  c("326", "Database Security"),
  c("329", "Computer Networking I"),
  c("330", "Computer Networking II"),
  c("339", "Computer Networking I Laboratory", 1, true),
  c("340", "Introduction to Mainframe Operations"),
  c("346", "Intermediate Enterprise Sys Operations"),
  c("347", "Advanced Enterprise Sys Operations"),
  c("355", "Electrical Power and Machinery"),
  c("357", "Network Servers"),
  c("383", "Alternative Energy Systems"),
  c("384", "Energy, Power and the Environment"),
  c("390", "Special Topics in CST"),
  c("405", "Cloud Infrastructure and Services"),
  c("406", "Backup Recovery Systems and Architectures"),
  c("413", "Applied Hardware and Software Systems II"),
  c("414", "ASIC/FPGA Design"),
  c("425", "Data Warehousing"),
  c("426", "Actionable Knowledge Mining"),
  c("430", "Linux Systems Administration"),
  c("432", "Computer Systems Architecture"),
  c("433", "Introduction to High Performance Computing"),
  c("434", "High Performance Computer Architecture and System Administration"),
  c("435", "Introduction to Parallel Programming"),
  c("448", "Advanced Networking Security Applications"),
  c("450", "Wireless Communications Sys I"),
  c("460", "System Integration and Architecture"),
  c("465", "Wireless Geo-Location Systems"),
  c("475", "Video Communication Systems"),
  c("481", "Power System Analysis and Control"),
  c("483", "Solar Energy"),
  c("484", "Wind and Water Energy"),
  c("496", "Senior Colloquium", 1),
  c("497", "Independent Study"),
  c("498", "Senior Project: A Capstone Experience"),
  c("499", "Senior Project II: A Capstone Experience"),
];

/** CST ≥ 200 from the catalog (candidates for SUBJECT_ELECTIVE technical electives). */
export const cstTechnicalElectiveCandidates = cstCatalogCourses.filter(
  (course) => Number.parseInt(course.number, 10) >= 200,
);

export function mergeCstCatalogCourses(existing: CourseSeed[]): CourseSeed[] {
  const seen = new Set(existing.map(courseKey));
  const additions = cstCatalogCourses.filter(
    (course) => !seen.has(courseKey(course)),
  );
  return [...existing, ...additions];
}
