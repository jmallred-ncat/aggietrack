# Test Student Scenarios for AGT-40

This document lists test students, their scenarios, and expected progress metrics for grade and progress functionality testing.

## Test Students Summary

| Student | Email | Standing | Scenario | Credits | Progress % | Key Features |
|---------|-------|----------|----------|---------|------------|--------------|
| Avery Cole | it.start@example.test | Freshman | Fresh start | 0 | 0.0% | Zero credits baseline |
| Jordan Hale | it.mid@example.test | Junior | Mid-program | TBD* | TBD%* | Realistic passing grades (A/B/C mix) |
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
- **Credits:** ~60 (through term 4)
- **Progress:** ~50%
- **Purpose:** Standard mid-program student
- **Transcript:** Terms 1-4 completed with realistic grades
  - Mix of A (33%), B (33%), C (33%)
  - All courses have explicit grades
  - Represents typical student performance
- **Tests:**
  - Standard progress tracking
  - Mid-program completion
  - Realistic grade distribution

### 3. Riley Brooks
- **Email:** `it.late@example.test`
- **Standing:** Senior
- **Credits:** ~90 (through term 6)
- **Progress:** ~75%
- **Purpose:** Near-graduation student
- **Transcript:** Terms 1-6 completed with strong grades
  - Mostly A and B+ grades (50% A, 50% B/B+)
  - All courses have explicit grades
  - Represents high-performing student
- **Tests:**
  - Late-stage progress
  - Near-complete curriculum
  - High GPA scenario

### 4. Taylor Morgan
- **Email:** `it.retake-f-to-pass@example.test`
- **Standing:** Sophomore
- **Credits:** TBD (through term 2, reduced due to F and below-min)
- **Progress:** TBD% (reduced: F becomes B after retake, D doesn't count)
- **Purpose:** Failed course with passing retake, and un-retaken below-minimum grade
- **Transcript:**
  - Terms 1-2 base courses: B grades
  - **CST 112:** F (first attempt in term 2), B (retake) - demonstrates F→pass logic
  - **CST 120:** D - **BELOW minimum grade** (C required for Major Core) - **NOT RETAKEN**
  - All courses have explicit grades
  - **Realistic:** Only retakes after F (non-passing grade)
- **Tests:**
  - ✅ **F then passing retake** (realistic: failed, then passed)
  - ✅ **Below-min grade not retaken** (D where C required, permanent example)
  - Best attempt selection (B counts, F doesn't)
  - Grade requirement enforcement (D doesn't count toward progress)

### 5. Casey Parker
- **Email:** `it.retake-c-to-a@example.test`
- **Standing:** Sophomore
- **Credits:** TBD (through term 2)
- **Progress:** TBD%
- **Purpose:** Withdrawal followed by successful retake
- **Transcript:**
  - Terms 1-2 base courses: B+ grades
  - **CST 130:** W (withdrew first attempt), A (retake and passed)
  - All courses have explicit grades
  - **Realistic:** Only retakes after W (withdrew, non-countable)
- **Tests:**
  - ✅ **W then A retake** (realistic: withdrew, then passed on retry)
  - Best grade selection logic (A counts, W doesn't)
  - Multiple attempts display
  - **No unrealistic pass→retake** (e.g., C→A would be unrealistic)

### 6. Alex Rivera
- **Email:** `it.diverse-grades@example.test`
- **Standing:** Junior
- **Credits:** ~35-40 (through term 3, some excluded)
- **Progress:** ~30-35% (some courses don't count)
- **Purpose:** Diverse grade types and edge cases
- **Transcript:**
  - **ENGL 100:** P (Pass)
  - **MATH 125:** TR (Transfer)
  - **CST 100:** W (Withdrawn)
  - **CST 110:** I (Incomplete)
  - **HIST 207:** F (Failed)
  - **PSYC 101:** A (regular grade)
  - **JOUR 101:** B - **UNMAPPED COURSE** (not on degree plan)
  - Other courses: mostly B
  - All courses have explicit grades
- **Tests:**
  - ✅ **P/TR/W/I/F grades**
  - ✅ **Unmapped course** (doesn't count toward progress)
  - Special grade handling
  - Edge cases

### 7. Morgan Lee
- **Email:** `it.over-credits@example.test`
- **Standing:** Senior
- **Credits:** >120 (through term 8)
- **Progress:** 100% (capped)
- **Purpose:** Student with excessive credits
- **Transcript:**
  - All 8 handbook terms completed
  - Excellent grades throughout (mostly A and A-)
  - All courses have explicit grades
- **Tests:**
  - ✅ **Transcript over 120 credits**
  - Progress capping at 100%
  - Handling extra coursework
  - Complete curriculum

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
