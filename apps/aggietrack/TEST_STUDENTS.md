# Test Student Scenarios for AGT-40

This document lists which test student covers which test case for grade and progress functionality.

## Test Students

### 1. Avery Cole (`it.start@example.test`)
- **Standing:** Freshman
- **Credits:** 0 (zero credits as required)
- **Purpose:** Tests fresh student with no prior coursework
- **Covers:**
  - Zero credits scenario
  - Initial progress page setup

### 2. Jordan Hale (`it.mid@example.test`)
- **Standing:** Junior
- **Credits:** Through term 4 (~60 credits)
- **Purpose:** Standard mid-program student
- **Covers:**
  - Standard progress tracking
  - Mid-program completion

### 3. Riley Brooks (`it.late@example.test`)
- **Standing:** Senior
- **Credits:** Through term 6 (~90 credits)
- **Purpose:** Near-graduation student
- **Covers:**
  - Late-stage progress
  - Near-complete curriculum

### 4. Taylor Morgan (`it.retake-f-to-pass@example.test`)
- **Standing:** Sophomore
- **Credits:** Through term 2
- **Purpose:** Failed course followed by passing retake
- **Covers:**
  - **F then passing retake:** CST 110 - F (first attempt), B (second attempt)
  - Best attempt selection logic
  - Below-min grade followed by passing grade

### 5. Casey Parker (`it.retake-c-to-a@example.test`)
- **Standing:** Sophomore
- **Credits:** Through term 2
- **Purpose:** Grade improvement retake
- **Covers:**
  - **C then A retake:** CST 100 - C (first attempt), A (second attempt)
  - Grade improvement scenarios
  - Best grade selection

### 6. Alex Rivera (`it.diverse-grades@example.test`)
- **Standing:** Junior
- **Credits:** Through term 3
- **Purpose:** Diverse grade types including P/TR/W/I/F
- **Covers:**
  - **P grade:** ENGL 100 (Pass)
  - **TR grade:** MATH 125 (Transfer)
  - **W grade:** CST 100 (Withdrawn)
  - **I grade:** CST 110 (Incomplete)
  - **F grade:** HIST 207 (Failed)
  - **Unmapped course:** JOUR 101 - B (course not on degree plan)
  - Various grade types in one transcript

### 7. Morgan Lee (`it.over-credits@example.test`)
- **Standing:** Senior
- **Credits:** Through term 8 (>120 credits)
- **Purpose:** Student with excessive credits
- **Covers:**
  - **Transcript over 120 credits**
  - Progress capping at 100%
  - Handling extra coursework

## Testing with Test Manager

To test these scenarios:

1. Open Test Manager on preview environment
2. Click "Reset" for any test student
3. Log in as that student
4. Navigate to Progress page to see their grades
5. Edit grades, add attempts, or remove attempts
6. Observe progress updates on Dashboard

## Course Matching Multiple Requirements

While not a specific test student scenario, several courses in the IT program can satisfy multiple requirements (e.g., courses that count toward both Gen Ed and program requirements). This is handled by the `computeDegreeProgress` function which ensures each course only counts once toward the best-matching requirement.

## Validation Covered

All test students support testing:
- Grade required when marking completed
- TR implies transfer (automatically sets source)
- Server-side checks that student owns the entry
- Cannot edit/remove other students' entries
- Cannot remove in-progress courses
