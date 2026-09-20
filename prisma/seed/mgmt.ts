import { type CourseRef, type CourseSeed, courseKey } from "./courses";

/**
 * NCAT Undergraduate Catalog — Management (MGMT) course descriptions.
 * https://catalog.ncat.edu/content.php?catoid=5&navoid=182&filter[item_type]=3&filter[only_active]=1&filter[3]=1&filter[cpage]=18&print
 *
 * Credits default to 3 (typical for these listings). MGMT 110 is required for
 * CST (Business Environment) and is excluded from the elective pool.
 */

const c = (
  number: string,
  title: string,
  credits = 3,
): CourseSeed => ({ subject: "MGMT", number, title, credits });

export const mgmtCourses: CourseSeed[] = [
  c("110", "Business Environment"),
  c("201", "Principles of Management"),
  c("221", "Global Business Environment"),
  c("260", "Business Communication"),
  c("303", "Legal Environment of Business"),
  c("315", "Management Science I"),
  c("321", "Organizational Behavior"),
  c("322", "Human Resource Management"),
  c("323", "Leading Work Groups and Teams"),
  c("330", "Operations Management"),
  c("343", "Entrepreneurship"),
  c("345", "Entrepreneurship Consulting"),
  c("347", "Entrepreneurial Financing"),
  c("349", "New Venture Creation"),
  c("353", "Cross Cultural Communication and Negotiation"),
  c("355", "International Business Management"),
  c("373", "Managing Process Improvement"),
  c("375", "Service Innovation and Project Management"),
  c("398", "Internship in Entrepreneurship"),
  c("427", "Business, Ethics and Social Responsibility"),
  c("429", "Business Law"),
  c("430", "Organizational Design and Change"),
  c("442", "Marketing for Entrepreneurs"),
  c("446", "Entrepreneurial Strategy"),
  c("463", "Commercial Law"),
  c("466", "Emerging Issues in Human Resource Management"),
  c("467", "Human Resource Management Strategy and Practice"),
  c("474", "Service Operations Management"),
  c("485", "Special Topics in Management"),
  c("490", "Independent Study in Business"),
  c("492", "Senior Management Seminars"),
  c("495", "Strategic Management"),
];

/** MGMT courses eligible for CST Management Electives (excludes required MGMT 110). */
export const mgmtElectives: CourseRef[] = mgmtCourses
  .filter((course) => course.number !== "110")
  .map(({ subject, number }) => ({ subject, number }));

export function mergeMgmtCourses(existing: CourseSeed[]): CourseSeed[] {
  const seen = new Set(existing.map(courseKey));
  const additions = mgmtCourses.filter((course) => !seen.has(courseKey(course)));
  return [...existing, ...additions];
}
