import { guardTestStudents } from "@/lib/test-student-accounts";
import { testStudents } from "@/lib/test-students";
import { computeDegreeProgress } from "@/lib/degree-progress";
import { computeGpa } from "@/lib/gpa";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Guard returns void on success, throws TestStudentError with status on failure
  try {
    guardTestStudents(request);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && "message" in error) {
      const status = typeof error.status === "number" ? error.status : 500;
      const message = typeof error.message === "string" ? error.message : "Unauthorized";
      return Response.json({ error: message }, { status });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const stats: Record<string, { credits: number; percentage: number; gpa: number | null; standing: string | null; place: string }> = {};
    
    for (const student of testStudents) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: student.email },
          select: {
            id: true,
            studentProfile: {
              select: {
                id: true,
                standing: true,
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
            standing: null,
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
        const standing = user.studentProfile.standing;
        const standingLabel = standing ? standing.charAt(0) + standing.slice(1).toLowerCase() : null;
        const programName = user.studentProfile.catalogYear.program.name;
        const year = user.studentProfile.catalogYear.year;
        
        // Format: "Information Technology 2025. Freshman: 3 credits, 2.5%, GPA 2.00"
        const gpaFormatted = gpa !== null ? gpa.toFixed(2) : "N/A";
        const place = standingLabel
          ? `${programName} ${year}. ${standingLabel}: ${progress.earnedCredits} credits, ${progress.percentage.toFixed(1)}%, GPA ${gpaFormatted}`
          : `${programName} ${year}. ${progress.earnedCredits} credits, ${progress.percentage.toFixed(1)}%, GPA ${gpaFormatted}`;
        
        stats[student.email] = {
          credits: progress.earnedCredits,
          percentage: progress.percentage,
          gpa,
          standing: standingLabel,
          place
        };
      } catch (error) {
        console.error(`Failed to get stats for ${student.email}:`, error);
        // Fallback on error
        stats[student.email] = {
          credits: 0,
          percentage: 0,
          gpa: null,
          standing: null,
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
