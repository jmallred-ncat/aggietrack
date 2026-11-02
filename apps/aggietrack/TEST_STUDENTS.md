# Test Student Scenarios for AGT-40

This document lists test students, their scenarios, and expected progress metrics for grade and progress functionality testing.

## Test Students Summary

| Student | Email | Standing | Scenario | Credits | Progress % | GPA | Adjusted GPA | Resident Hours | Honors Badge |
|---------|-------|----------|----------|---------|------------|-----|--------------|----------------|--------------|
| Avery Cole | it.start@example.test | Freshman | Fresh start | 0 | 0.0% | — | — | 0 | None |
| Jordan Hale | it.mid@example.test | Junior | Mid-program + in-progress | ~45 | ~37.5% | ~3.35 | ~3.35 | 45 | On track for Cum Laude |
| Riley Brooks | it.late@example.test | Senior | Near graduation | 90 | 75.0% | 3.65 | 3.65 | 84 | Magna Cum Laude pace |
| Taylor Morgan | it.retake-f-to-pass@example.test | Sophomore | F→B retake + D below-min | 30 | 25.0% | 3.12 | ~2.64 | 33 | None |
| Casey Parker | it.retake-c-to-a@example.test | Sophomore | W→A retake | 30 | 25.0% | 3.58 | 3.58 | 30 | On track for Magna Cum Laude |
| Alex Rivera | it.diverse-grades@example.test | Junior | Diverse grades + unmapped | 36 | 30.0% | 2.91 | 2.91 | ≥36 | None |
| Morgan Lee | it.over-credits@example.test | Senior | Excessive credits | ≥120 | 100.0% | 3.82 | 3.82 | ≥114 | Summa Cum Laude pace |

**\*To get exact values:** Reset a student via Test Manager, log in, view Dashboard. The `computeDegreeProgress` function returns exact credits and percentage (1 decimal place) based on:
- Only COMPLETED courses with passing grades
- Best attempt for retakes
- Excludes grades below requirement minimums (e.g., D where C required)
- Excludes unmapped courses
- Capped at 100.0%

## Detailed Test Student Profiles

### 1. Avery Cole
- **Email:** `it.start@example.test`
- **Standing:** Freshman
- **Credits:** 0
- **Progress:** 0%
- **Purpose:** Baseline student with no prior coursework
- **Transcript:** Empty
- **Tests:**
  - Zero credits scenario
  - Initial progress page setup
  - Fresh student onboarding

### 2. Jordan Hale
- **Email:** `it.mid@example.test`
- **Standing:** Junior
- **Earned Credits:** 45 (through term 3 completed)
- **Progress:** 37.5% (term 4 courses don't count until completed)
- **GPA:** **~3.35** (45 graded hours: varied A-, B+, B, B-, C+, C; mostly B range, C ~12%)
- **Adjusted GPA:** **~3.35** (same as cumulative, no repeats)
- **Resident Hours:** 45 (all NC A&T, no transfer)
- **Honors Badge:** **On track for Cum Laude** (3.25-3.49 range, but <48 resident hours)
- **Purpose:** Standard mid-program student with current-term enrollment
- **Transcript:** 
  - Terms 1-3 completed with varied grades (A through C, full plus/minus scale)
  - **Term 4 courses: IN_PROGRESS** (no final grades yet, excluded from GPA)
  - No transfer credits
  - Represents typical student mid-semester
- **Tests:**
  - ✅ **In-progress courses** (term 4, no grades)
  - ✅ **Varied plus/minus grades** (A, A-, B+, B, B-, C+, C)
  - In-progress excluded from earned credits and GPA
  - In-progress courses don't block prerequisites
  - Standard progress tracking
  - Mid-program completion

### 3. Riley Brooks
- **Email:** `it.late@example.test`
- **Standing:** Senior
- **Earned Credits:** 90 (through term 6, including 6 transfer credits)
- **Progress:** 75.0%
- **GPA:** **3.65** (84 graded hours: strong A, A-, B+, B; no C grades; 6 transfer credits excluded)
- **Adjusted GPA:** **3.65** (same as cumulative, no repeats)
- **Resident Hours:** 84 (90 total - 6 transfer)
- **Honors Badge:** **Magna Cum Laude pace** (3.50-3.74 range, ≥48 resident hours eligible)
- **Purpose:** Near-graduation student with transfer credits
- **Transcript:** Terms 1-6 completed with strong grades
  - Mostly A, A-, B+, B grades (varied within high range)
  - **ENGL 100 and MATH 125: Transfer credits (TR)** - earn credit, but excluded from GPA
  - All courses have explicit grades
  - Represents high-performing student with transfer work
- **Tests:**
  - ✅ **Transfer credits** (TR grade, source TRANSFER, excluded from GPA)
  - Late-stage progress
  - Near-complete curriculum
  - High GPA scenario
  - Plus/minus grade variation

### 4. Taylor Morgan
- **Email:** `it.retake-f-to-pass@example.test`
- **Standing:** Sophomore
- **Earned Credits:** 30 (through term 2, reduced: D doesn't count toward Major Core requirement)
- **Progress:** 25.0% (F becomes B after retake counts; D doesn't count toward progress)
- **GPA:** **3.12** (33 graded hours: varied A–B- + F→B retake uses B only; D counts in GPA as 1.0)
- **Adjusted GPA:** **~2.64** (F→B both attempts count, lowering adjusted vs cumulative)
- **Resident Hours:** 33 (all attempts, including F)
- **Honors Badge:** **None** (below 3.25 threshold)
- **Purpose:** Failed course with passing retake, and un-retaken below-minimum grade
- **Transcript:**
  - Terms 1-2 base courses: B grades
  - **CST 112:** F (first attempt), B (retake) - only B counts in GPA (repeat rule)
  - **CST 120:** D - **BELOW minimum** (C required for Major Core) - **NOT RETAKEN** - counts in GPA but not progress
  - All courses have explicit grades
  - **Realistic:** Only retakes after F (non-passing grade)
- **Tests:**
  - ✅ **F then passing retake** (realistic: failed, then passed; only B counts in GPA)
  - ✅ **Below-min grade not retaken** (D where C required; counts in GPA, not progress)
  - ✅ **GPA includes D** (quality points 1.0, lowers GPA)
  - Best attempt selection (B counts, F doesn't)
  - Grade requirement enforcement (D doesn't count toward progress)

### 5. Casey Parker
- **Email:** `it.retake-c-to-a@example.test`
- **Standing:** Sophomore
- **Earned Credits:** 30 (through term 2)
- **Progress:** 25.0%
- **GPA:** **3.58** (30 graded hours: varied A–B + W→A retake uses A only; W excluded from GPA)
- **Adjusted GPA:** **3.58** (W excluded from both cumulative and adjusted)
- **Resident Hours:** 30 (all NC A&T, no transfer)
- **Honors Badge:** **On track for Magna Cum Laude** (3.50-3.74 range, but <48 resident hours)
- **Purpose:** Withdrawal followed by successful retake
- **Transcript:**
  - Terms 1-2 base courses: B+ grades (3.3 quality points)
  - **CST 130:** W (withdrew first attempt), A (retake and passed) - only A counts in GPA, W excluded
  - All courses have explicit grades
  - **Realistic:** Only retakes after W (withdrew, non-countable)
- **Tests:**
  - ✅ **W then A retake** (realistic: withdrew, then passed; only A counts in GPA, W excluded)
  - ✅ **GPA excludes W** (W contributes no hours or points)
  - Best grade selection logic (A counts, W doesn't)
  - Multiple attempts display
  - **No unrealistic pass→retake** (e.g., C→A would be unrealistic)

### 6. Alex Rivera
- **Email:** `it.diverse-grades@example.test`
- **Standing:** Junior
- **Earned Credits:** 36 (through term 3, W/I/F/unmapped excluded from progress)
- **Progress:** 30.0%
- **GPA:** **2.91** (36 graded hours: F 0.0, A 4.0, varied B+/B/B-; P/TR/W/I excluded, unmapped B counts)
- **Adjusted GPA:** **2.91** (same as cumulative, special grades excluded)
- **Resident Hours:** ≥36 (varies by seed)
- **Honors Badge:** **None** (below 3.25 threshold)
- **Purpose:** Diverse grade types and edge cases
- **Transcript:**
  - **ENGL 100:** P (Pass) - counts for credit, excluded from GPA
  - **MATH 125:** TR (Transfer) - counts for credit, excluded from GPA
  - **CST 100:** W (Withdrawn) - excluded from credit and GPA
  - **CST 110:** I (Incomplete) - excluded from credit and GPA
  - **HIST 207:** F (Failed) - 0.0 quality points, counts in GPA (lowers it)
  - **PSYC 101:** A (regular grade) - 4.0 quality points
  - **JOUR 101:** B - **UNMAPPED COURSE** (not on degree plan, but counts in GPA)
  - Other courses: mostly B (3.0 quality points)
  - All courses have explicit grades
- **Tests:**
  - ✅ **P/TR/W/I/F grades** (P/TR/W/I excluded from GPA; F counts as 0.0)
  - ✅ **Unmapped course** (doesn't count toward progress, but counts in GPA)
  - ✅ **F lowers GPA** (0.0 quality points but counts in hours)
  - Special grade handling
  - Edge cases

### 7. Morgan Lee
- **Email:** `it.over-credits@example.test`
- **Standing:** Senior
- **Earned Credits:** ≥120 (through term 8, capped at 100%)
- **Progress:** 100.0% (capped)
- **GPA:** **3.82** (≥114 graded hours: excellent A, A-, B+; 6 transfer credits excluded)
- **Adjusted GPA:** **3.82** (same as cumulative, no repeats)
- **Resident Hours:** ≥114 (120 total - 6 transfer)
- **Honors Badge:** **Summa Cum Laude pace** (3.75-4.00 range, ≥48 resident hours eligible)
- **Purpose:** Student with excessive credits and transfer work
- **Transcript:**
  - All 8 handbook terms completed
  - Excellent grades throughout (A, A-, B+)
  - **ENGL 100 and MATH 125: Transfer credits (TR)** - earn credit, but excluded from GPA
  - All courses have explicit grades
- **Tests:**
  - ✅ **Transcript over 120 credits**
  - ✅ **Transfer credits** (TR grade, source TRANSFER, excluded from GPA)
  - Progress capping at 100%
  - Handling extra coursework
  - Complete curriculum
  - High GPA with plus/minus grades

## Course Matching Multiple Requirements

The IT curriculum has courses that can satisfy multiple requirement groups. For example:
- Gen Ed courses may also count as free electives
- Some courses satisfy both a specific requirement and a gen ed requirement

The `computeDegreeProgress` function ensures each course only counts once toward the best-matching requirement group.

## Testing with Test Manager

### How to Reset and Test

1. Open Test Manager on preview environment: `/students`
2. Find the student you want to test
3. Click "Reset" button for that student
4. Log in as that student on AggieTrack
5. Navigate to Progress page (`/student/progress`)
6. View their preset grades and transcript
7. Test functionality:
   - Edit existing grades
   - Add retakes with "Add attempt"
   - Remove attempts
   - Mark additional courses as complete
8. Navigate to Dashboard (`/student`) to see progress update

### Expected Behaviors

- **All students** have explicit grades on completed courses
- **No ungraded COMPLETED entries** exist after reset
- **Progress updates immediately** after grade changes
- **Toast notifications** confirm actions
- **Dashboard progress ring** animates on changes
- **Test Manager** lists all 7 students with reset buttons

## Validation Covered

All test students support testing:
- ✅ **In-progress courses** (Jordan Hale: term 4 enrollment, no grades yet)
- ✅ In-progress excluded from earned credits (don't count toward progress %)
- ✅ Converting in-progress to completed by setting grade
- ✅ Grade required when marking completed
- ✅ TR grade implies transfer (automatically sets source)
- ✅ Server-side ownership checks (students can only edit their own entries)
- ✅ Cannot edit/remove other students' entries
- ✅ Cannot remove in-progress courses
- ✅ Below-minimum grade scenario (Taylor Morgan)
- ✅ Multiple retakes (Taylor Morgan, Casey Parker)
- ✅ Diverse grade types (Alex Rivera)
- ✅ Unmapped courses (Alex Rivera)
- ✅ Over 120 credits (Morgan Lee)
