# Test Student Scenarios for AGT-40

This document lists test students, their scenarios, and expected progress metrics for grade and progress functionality testing.

## Test Students Summary

| Student | Email | Standing | Scenario | Credits | Progress % | Key Features |
|---------|-------|----------|----------|---------|------------|--------------|
| Avery Cole | it.start@example.test | Freshman | Fresh start | 0 | 0.0% | Zero credits baseline |
| Jordan Hale | it.mid@example.test | Junior | Mid-program + in-progress | ~45 | ~37.5% | Realistic grades (A/B/C mix); term 4 in progress |
| Riley Brooks | it.late@example.test | Senior | Near graduation | TBD* | TBD%* | Strong grades (mostly A/B) |
| Taylor Morgan | it.retake-f-to-pass@example.test | Sophomore | F→B retake + D below-min | TBD* | TBD%* | CST 112: F→B retake; CST 120: D (NOT retaken) |
| Casey Parker | it.retake-c-to-a@example.test | Sophomore | W→A retake | TBD* | TBD%* | CST 130: W→A retake (realistic: withdrew then passed) |
| Alex Rivera | it.diverse-grades@example.test | Junior | Diverse grades + unmapped | TBD* | TBD%* | P/TR/W/I/F grades; JOUR 101 unmapped |
| Morgan Lee | it.over-credits@example.test | Senior | Excessive credits | ≥120 | 100.0% | 8 terms completed; excellent grades (capped) |

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
- **Credits:** ~45 (through term 3 completed + term 4 in progress)
- **Progress:** ~37.5% (term 4 courses don't count until completed)
- **GPA:** ~3.10 (varied A, A-, B+, B, B-, C+, C across completed courses)
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
- **Credits:** ~90 (through term 6)
- **Progress:** ~75%
- **GPA:** ~3.75 (strong A, A-, B+, B grades; transfer courses excluded)
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
- **Credits:** ~30 (through term 2, reduced: D doesn't count toward Major Core requirement)
- **Progress:** ~25% (F becomes B after retake counts; D doesn't count toward progress)
- **GPA:** ~2.65 (B grades + F→B retake uses B only; D counts in GPA but lowers it)
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
- **Credits:** ~30 (through term 2)
- **Progress:** ~25%
- **GPA:** ~3.50 (B+ grades throughout + W→A retake uses A only; W excluded from GPA)
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
- **Credits:** ~35-40 (through term 3, some excluded)
- **Progress:** ~30-35% (W/I/F/unmapped don't count)
- **GPA:** ~2.60 (only regular letter grades count: F 0.0, A 4.0, B 3.0; P/TR/W/I excluded)
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
- **Credits:** >120 (through term 8)
- **Progress:** 100% (capped)
- **GPA:** ~3.85 (excellent A, A-, B+ grades; transfer courses excluded)
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
