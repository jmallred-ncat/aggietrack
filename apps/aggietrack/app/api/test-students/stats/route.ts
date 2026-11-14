import { guardTestStudents } from "@/lib/test-student-accounts";
import { testStudents } from "@/lib/test-students";
import { computeDegreeProgress } from "@/lib/degree-progress";
import { computeGpa } from "@/lib/gpa";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    guardTestStudents(request);
    
    const stats: Record<string, { credits: number; percentage: number; gpa: number | null; place: string }> = {};
    
    for (const student of testStudents) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: student.email },
          select: {
            id: true,
            studentProfile: {
              select: {
                id: true,
                catalogYear: {
                  select: {
                    year: true,
                    program: {
                      select: {
                        name: true,
                        totalCredits: true,
                      }
                    }
                  }
                }
              }
            }
          }
        });
        
        if (!user?.studentProfile) {
          stats[student.email] = {
            credits: 0,
            percentage: 0,
            gpa: null,
            place: `${user?.studentProfile?.catalogYear.program.name ?? "Information Technology"} ${user?.studentProfile?.catalogYear.year ?? 2025}. Just started, with no prior coursework (0 credits).`
          };
          continue;
        }
        
        const [progress, transcript] = await Promise.all([
          computeDegreeProgress(user.studentProfile.id),
          prisma.transcriptEntry.findMany({
            where: { studentId: user.studentProfile.id },
            include: {
              course: {
                select: {
                  id: true,
                  subject: true,
                  number: true,
                  title: true,
                  credits: true,
                }
              }
            },
            orderBy: { createdAt: "desc" }
          })
        ]);
        
        const gpa = computeGpa(transcript);
        const programName = user.studentProfile.catalogYear.program.name;
        const catalogYear = user.studentProfile.catalogYear.year;
        
        // Determine standing based on credits
        let standing = "Freshman";
        if (progress.earnedCredits >= 90) standing = "Senior";
        else if (progress.earnedCredits >= 60) standing = "Junior";
        else if (progress.earnedCredits >= 30) standing = "Sophomore";
        
        const gpaStr = gpa !== null ? `GPA ${gpa.toFixed(2)}` : "no GPA yet";
        const place = `${programName} ${catalogYear}. ${standing}: ${progress.earnedCredits} credits, ${progress.percentage}%, ${gpaStr}.`;
        
        stats[student.email] = {
          credits: progress.earnedCredits,
          percentage: progress.percentage,
          gpa,
          place
        };
      } catch (error) {
        console.error(`Failed to get stats for ${student.email}:`, error);
        // Fallback on error
        stats[student.email] = {
          credits: 0,
          percentage: 0,
          gpa: null,
          place: `${student.firstName} ${student.lastName}. Information Technology 2025. Stats unavailable.`
        };
      }
    }
    
    return Response.json({ stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch test student stats.";
    return Response.json({ error: message }, { status: 500 });
  }
}
