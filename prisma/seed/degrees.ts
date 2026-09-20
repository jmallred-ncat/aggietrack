import { DegreeLevel } from "../../lib/generated/prisma/client";

export const degrees = [
  { name: "Bachelor of Science", abbreviation: "B.S.", level: DegreeLevel.BACCALAUREATE, sortOrder: 10 },
  { name: "Bachelor of Arts", abbreviation: "B.A.", level: DegreeLevel.BACCALAUREATE, sortOrder: 20 },
  { name: "Master of Science", abbreviation: "M.S.", level: DegreeLevel.MASTERS, sortOrder: 30 },
  { name: "Master of Arts", abbreviation: "M.A.", level: DegreeLevel.MASTERS, sortOrder: 40 },
  { name: "Master of Arts in Teaching", abbreviation: "M.A.T.", level: DegreeLevel.MASTERS, sortOrder: 50 },
  { name: "Master of Arts in Education", abbreviation: "M.A.Ed.", level: DegreeLevel.MASTERS, sortOrder: 60 },
  { name: "Master of Business Administration", abbreviation: "M.B.A.", level: DegreeLevel.MASTERS, sortOrder: 70 },
  { name: "Master of Accountancy", abbreviation: "M.Acc.", level: DegreeLevel.MASTERS, sortOrder: 80 },
  { name: "Master of Social Work", abbreviation: "M.S.W.", level: DegreeLevel.MASTERS, sortOrder: 90 },
  { name: "Master of School Administration", abbreviation: "M.S.A.", level: DegreeLevel.MASTERS, sortOrder: 100 },
  { name: "Doctor of Philosophy", abbreviation: "Ph.D.", level: DegreeLevel.DOCTORAL, sortOrder: 110 },
  { name: "Doctor of Nursing Practice", abbreviation: "D.N.P.", level: DegreeLevel.DOCTORAL, sortOrder: 120 },
  { name: "Undergraduate Certificate", abbreviation: "Cert.", level: DegreeLevel.CERTIFICATE, sortOrder: 130 },
  { name: "Post-Baccalaureate Certificate", abbreviation: "P.B.C.", level: DegreeLevel.CERTIFICATE, sortOrder: 140 },
  { name: "Post-Master's Certificate", abbreviation: "P.M.C.", level: DegreeLevel.CERTIFICATE, sortOrder: 150 },
] as const;
