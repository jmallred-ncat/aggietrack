# Test Student Scenarios for AGT-40

This document lists test students, their scenarios, and expected progress metrics for grade and progress functionality testing.

## Test Students Summary

| Student | Email | Standing | Scenario | Credits | Progress % | GPA | Adjusted GPA | Resident Hours | Honors Badge |
|---------|-------|----------|----------|---------|------------|-----|--------------|----------------|--------------|
| Avery Cole | it.start@example.test | Freshman | Fresh start | 0 | 0.0% | — | — | 0 | None |
| Jordan Hale | it.mid@example.test | Junior | Mid-program + in-progress | 48 | 40.0% | 3.41 | 3.41 | 48 | Cum Laude pace |
| Riley Brooks | it.late@example.test | Senior | Near graduation | 92 | 76.7% | 3.64 | 3.64 | 86 | Magna Cum Laude pace |
| Taylor Morgan | it.retake-f-to-pass@example.test | Sophomore | F→B retake + D below-min | 29 | 24.2% | 3.02 | 2.76 | 35 | None |
| Casey Parker | it.retake-c-to-a@example.test | Sophomore | W→A retake | 32 | 26.7% | 3.61 | 3.61 | 32 | On track for Magna Cum Laude |
| Alex Rivera | it.diverse-grades@example.test | Junior | Diverse grades + unmapped | 41 | 34.2% | 2.83 | 2.83 | 40 | None |
| Morgan Lee | it.over-credits@example.test | Senior | Full curriculum | 120 | 100.0% | 3.98 | 3.98 | 114 | Summa Cum Laude pace |

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
- **Earned Credits:** 48 (terms 1–3: 17 + 15 + 16; term 4 is in progress)
- **Progress:** 40.0%
- **GPA:** **3.41** (163.6 quality points / 48 graded hours)
- **Adjusted GPA:** **3.41** (same as cumulative, no repeats)
- **Resident Hours:** 48 (all NC A&T letter grades)
- **Honors Badge:** **Cum Laude pace** (3.25–3.49, and 48 resident hours is enough)
- **Purpose:** Standard mid-program student with current-term enrollment
- **Transcript:** 
  - Terms 1-3 completed with varied grades (A, A-, B+, and B)
  - **Term 4 courses: IN_PROGRESS** (no final grades yet, excluded from GPA)
  - No transfer credits
  - Represents typical student mid-semester
- **Tests:**
  - ✅ **In-progress courses** (term 4, no grades)
  - ✅ **Varied plus/minus grades** (A, A-, B+, B)
  - In-progress excluded from earned credits and GPA
  - In-progress courses don't block prerequisites
  - Standard progress tracking
  - Mid-program completion

### 3. Riley Brooks
- **Email:** `it.late@example.test`
- **Standing:** Senior
- **Earned Credits:** 92 (terms 1–6 are 17 + 15 + 16 + 16 + 13 + 15, including 6 transfer credits)
- **Progress:** 76.7%
- **GPA:** **3.64** (312.9 quality points / 86 graded hours; ENGL 100 and MATH 224 are transfer)
- **Adjusted GPA:** **3.64** (same as cumulative, no repeats)
- **Resident Hours:** 86 (92 total − 6 transfer)
- **Honors Badge:** **Magna Cum Laude pace** (3.50-3.74 range, ≥48 resident hours eligible)
- **Purpose:** Near-graduation student with transfer credits
- **Transcript:** Terms 1-6 completed with strong grades
  - Mostly A, A-, B+, B grades (varied within high range)
  - **ENGL 100 and MATH 224: Transfer credits (TR)** - earn credit, but excluded from GPA
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
- **Earned Credits:** 29 (terms 1–2 are 32 credits; CST 120's D does not meet the C minimum)
- **Progress:** 24.2%
- **GPA:** **3.02** (96.7 quality points / 32 graded hours; the F is replaced by the B)
- **Adjusted GPA:** **2.76** (96.7 / 35; the F and the B both count)
- **Resident Hours:** 35 (every letter-graded attempt, including the F)
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
- **Earned Credits:** 32 (terms 1–2; the W does not count and the later A does)
- **Progress:** 26.7%
- **GPA:** **3.61** (115.4 quality points / 32 graded hours; W excluded)
- **Adjusted GPA:** **3.61** (W excluded from both cumulative and adjusted)
- **Resident Hours:** 32 (all NC A&T letter grades)
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
- **Earned Credits:** 41 (terms 1–3 are 48 credits; W, I, and F drop 7; JOUR 101 is outside the plan)
- **Progress:** 34.2%
- **GPA:** **2.83** (113.2 quality points / 40 graded hours; P, TR, W, and I excluded; the F and JOUR 101's B count)
- **Adjusted GPA:** **2.83** (same as cumulative, no repeated letter grades)
- **Resident Hours:** 40 (letter-graded NC A&T attempts, including the F and JOUR 101)
- **Honors Badge:** **None** (below 3.25 threshold)
- **Purpose:** Diverse grade types and edge cases
- **Transcript:**
  - **ENGL 100:** P (Pass) - counts for credit, excluded from GPA
  - **MATH 110:** TR (Transfer) - counts for credit, excluded from GPA. MATH 125 is not on this curriculum.
  - **CST 130:** W (Withdrawn) - excluded from credit and GPA, and not retaken
  - **CST 122:** I (Incomplete) - excluded from credit and GPA
  - **HIST 207:** F (Failed) - 0.0 quality points, counts in GPA, not retaken
  - **PSYC 101:** A (regular grade) - 4.0 quality points
  - **JOUR 101:** B - **outside the degree plan** (counts in GPA, not in progress)
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
- **Earned Credits:** 120 (through term 8, capped at 100%)
- **Progress:** 100.0% (capped)
- **GPA:** **3.98** (454.2 quality points / 114 graded hours; ENGL 101 and ECON 200 are A-, and ENGL 100 plus MATH 224 are transfer)
- **Adjusted GPA:** **3.98** (same as cumulative, no repeats)
- **Resident Hours:** 114 (120 total − 6 transfer)
- **Honors Badge:** **Summa Cum Laude pace** (3.75-4.00 range, ≥48 resident hours eligible)
- **Purpose:** Student with excessive credits and transfer work
- **Transcript:**
  - All 8 handbook terms completed
  - Excellent grades throughout (A, A-, B+)
  - **ENGL 100 and MATH 224: Transfer credits (TR)** - earn credit, but excluded from GPA
  - All courses have explicit grades
- **Tests:**
  - ✅ **All 120 curriculum credits earned** (percentage stays capped at 100 if a student goes past the total)
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
