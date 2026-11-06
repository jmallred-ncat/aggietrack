import { Grade, PlannedTermStatus, TranscriptStatus, TranscriptSource } from "./generated/prisma/browser";

/**
 * Human-readable labels for Grade enum values
 */
export function gradeLabel(grade: Grade | null): string {
  if (grade === null) return "—";
  
  const labels: Record<Grade, string> = {
    [Grade.A]: "A",
    [Grade.A_MINUS]: "A-",
    [Grade.B_PLUS]: "B+",
    [Grade.B]: "B",
    [Grade.B_MINUS]: "B-",
    [Grade.C_PLUS]: "C+",
    [Grade.C]: "C",
    [Grade.C_MINUS]: "C-",
    [Grade.D_PLUS]: "D+",
    [Grade.D]: "D",
    [Grade.F]: "F",
    [Grade.P]: "P",
    [Grade.TR]: "TR",
    [Grade.W]: "W",
    [Grade.I]: "I",
  };
  
  return labels[grade];
}

/**
 * Human-readable labels for TranscriptStatus enum values
 */
export function transcriptStatusLabel(status: TranscriptStatus): string {
  const labels: Record<TranscriptStatus, string> = {
    [TranscriptStatus.COMPLETED]: "Completed",
    [TranscriptStatus.IN_PROGRESS]: "In Progress",
    [TranscriptStatus.WITHDRAWN]: "Withdrawn",
    [TranscriptStatus.FAILED]: "Failed",
  };
  
  return labels[status];
}

/**
 * Human-readable labels for TranscriptSource enum values
 */
const planStatusLabels: Record<PlannedTermStatus, string> = {
  [PlannedTermStatus.DRAFT]: "Draft",
  [PlannedTermStatus.SUBMITTED]: "Waiting for review",
  [PlannedTermStatus.APPROVED]: "Approved",
};

/** The same plan-status words on every student page. Unknown values stay unlabeled. */
export function planStatusLabel(status: string): string {
  if (status in planStatusLabels) {
    return planStatusLabels[status as PlannedTermStatus];
  }
  return "Status unavailable";
}

export function planStatusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  if (status === PlannedTermStatus.APPROVED) return "default";
  if (status === PlannedTermStatus.DRAFT || status === PlannedTermStatus.SUBMITTED) return "secondary";
  return "outline";
}

export function transcriptSourceLabel(source: TranscriptSource): string {
  const labels: Record<TranscriptSource, string> = {
    [TranscriptSource.NCAT]: "NC A&T",
    [TranscriptSource.TRANSFER]: "Transfer",
    [TranscriptSource.AP]: "AP Credit",
    [TranscriptSource.CLEP]: "CLEP Credit",
  };
  
  return labels[source];
}
