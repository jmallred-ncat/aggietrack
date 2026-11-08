# AGT-17 Design Quality Gate: Advisor Meeting Request

**Issue:** [AGT-17 Advisor Meeting Request](https://linear.app/jamesmallred/issue/AGT-17/advisor-meeting-request)  
**Repo:** `jmallred-ncat/aggietrack`, branch `preview` (inspected read-only via GitHub; no code edited)  
**Site:** https://preview.aggietrack.space (public marketing pages only; signed-in advising screens are stubs)  
**Quality bar:** Apple-level polish and care, not Apple style. Match AggieTrack’s current navy/gold language.  
**This file:** implementation rules for consistent outcomes. Agatha coordinates implementation and functional/security verification. Wanda reviews rendered UI and stays involved until this gate passes.

---

## How this gate works

1. **Design approval names evidence and outstanding gaps.** An approval lists the screenshot and interaction files inspected, the rules and acceptance criteria that passed, and anything still open. It never says “looks done.”
2. **Screenshots cannot prove behavior.** Do not infer booking, cancellation, rescheduling, Zoom saves, conflict protection, atomicity, refresh persistence, or authorization from a still image. Those need named interaction evidence or a separate functional/security report. A passing screenshot of a confirmation card does not prove the booking survived refresh or that a concurrent request was rejected.
3. **Visual review is required at 390px and 1280px** before any design pass, in light and dark if both ship, using real screens (not mocked crops that hide the shell).
4. **Iterate until it passes.** Failed rules get a correction request that cites the rule number, the evidence file, and the exact fix. No partial “good enough” on hierarchy, copy, contrast, overflow, or dialog behavior.
5. **Do not restyle unrelated screens.** This work fills `/student/advising` and `/advisor/appointments`, and may add a compact upcoming-session card on each dashboard only when a real upcoming session exists (rules 29–31). Do not rebuild planner, progress, students, plans, review, or the original student dashboard tiles.

---

## Sources inspected (preview branch)

Read-only. Latest preview commits visible on GitHub at inspection time include PR #33 (`5850b68`, planner term dialog), PR #32 (`062649d`, restored student dashboard tiles), PR #31 (legend and fixture loader), and the advisor dashboard/language work from PR #26 onward.

| Source | What it tells this feature |
| --- | --- |
| AGT-17 (nine “Done when” criteria) | Product requirements this matrix maps to |
| `apps/aggietrack/app/(app)/student/(started)/advising/page.tsx` | Student advising is a stub (`<h1>Advising</h1>`) |
| `apps/aggietrack/app/(app)/advisor/appointments/page.tsx` | Advisor appointments is a stub header only |
| `apps/aggietrack/app/(app)/dashboard-sidebar.tsx` | Student nav includes Advising; advisor nav includes Appointments |
| `apps/aggietrack/app/(app)/book-advising-button.tsx` | Existing sidebar CTA already goes to `/student/advising` |
| `apps/aggietrack/app/(app)/dashboard-breadcrumbs.tsx` | Crumbs already map `advising` → Advising and `appointments` → Appointments |
| `apps/aggietrack/app/(app)/student/(started)/page.tsx` | Current student dashboard: header, `DashboardTiles`, Next step card, course cards, advising-notes empty card |
| `apps/aggietrack/components/dashboard-tiles.tsx` | Original student tiles to preserve: Degree Completion (circular progress) and GPA |
| `apps/aggietrack/app/(app)/advisor/page.tsx` | Advisor dashboard: header, title-value-badge count tiles, review queue, notes |
| `apps/aggietrack/app/(app)/advisor/students/page.tsx` | Inner-page header, `gap-6 py-6`, Card table from `xl`, cards below |
| `apps/aggietrack/components/plan-notes-view.tsx` | Official `@shadcn/message` usage, `[overflow-wrap:anywhere]`, `whitespace-nowrap` times |
| `apps/aggietrack/lib/plan-status.ts` | `planDate` / `planTimestamp` via `Intl` in `America/New_York` with short zone |
| `apps/aggietrack/lib/plan-notes.ts` | Note timestamps, 2,000-character limit pattern, plain-word event phrases |
| `apps/aggietrack/components/dismissible-alert.tsx` | Durable errors; close control labeled “Dismiss message” |
| `apps/aggietrack/lib/completion-menu.ts` | `runAfterConfirmCloses` — dialog closes before the request starts |
| `apps/aggietrack/app/(app)/advisor/plans/[plannedTermId]/ReviewPanel.tsx` | Approve AlertDialog + Return Dialog with required note, pending labels, sonner |
| `apps/aggietrack/app/(app)/student/(started)/planner/term-choice-dialog.tsx` | Dialog stacking: column on narrow, row from ~400px / `@min-[23rem]` |
| `apps/aggietrack/app/(app)/layout.tsx` | Shared shell; content `overflow-y-auto overflow-x-hidden`; `container mx-auto`; `px-4` |
| `packages/ui/src/styles.css` | Navy/gold CSS variables, Montserrat, radius 0.75rem |
| `apps/aggietrack/components.json` | shadcn `base-nova`, Phosphor icons |
| `apps/aggietrack/prisma/advising.prisma` | Scaffold `AdvisingAppointment` (`startsAt`, `notes` only) — insufficient for status, duration, availability, Zoom, or change notes. Schema work is implementation; the UI must not expose raw scaffold fields. |
| `apps/aggietrack/prisma/enums.prisma` | No meeting-status enum yet. Never print any stored value you add. |
| https://preview.aggietrack.space | Marketing copy mentions advisor appointments; it is not the signed-in UI |

Existing components to reuse (import through `@/components/ui` and app wrappers): Card, Badge, Button, AlertDialog, Dialog, Field, FieldLabel, FieldDescription, FieldGroup, Label, Input, Textarea, Select, Calendar, Popover, Empty, Alert, Avatar, Separator, Table, Skeleton, ScrollArea, Message (`message.tsx`), sonner (`toast` from `sonner` + `SonnerToaster` in `app/layout.tsx`), `DismissibleAlert`.

---

## Standing rules (carry forward)

6. **shadcn only.** Use installed base-nova wrappers. Do not add AI Elements, a second toast system, custom chat bubbles, or a new visual kit. Phosphor icons are allowed where EmptyMedia or a decorative glyph is already the pattern (`plan-notes-view.tsx`).
7. **Keep the UX simple.** One student page and one advisor page. No extra settings area, no week-view calendar app, no tabs unless a single page would otherwise become two competing modes. Calendar is a date picker, not a new product surface.
8. **Never show raw enum values.** No `CONFIRMED`, `CANCELED`, `CANCELLED`, `RESCHEDULED`, `AVAILABLE`, `BOOKED`, or similar. Map through a helper in the same spirit as `plannedTermStatusLabel` in `lib/plan-status.ts`. Unknown values render as “Status unavailable” (outline Badge), never the raw string.
9. **Feedback is sonner or a dismissible Alert.** Short outcomes use `toast` from `sonner`. Durable validation, stale data, and conflicts use `DismissibleAlert` (title + description + “Dismiss message”). Do not use a lone red paragraph or the older Base UI `toast.tsx` helper for this feature.
10. **Confirm dialogs close as soon as the action starts.** Use `runAfterConfirmCloses` from `lib/completion-menu.ts` the way `ReviewPanel.tsx` and `CurrentSemesterPrompt.tsx` do. Pending copy lives on the page (button label or a pending Card), not inside a stuck modal.
11. **Preserve original student dashboard tiles.** Leave `DashboardTiles` in `components/dashboard-tiles.tsx` as shipped by PR #32: Degree Completion (title, circular progress, credits line, optional target) and GPA (title, number or “No GPA yet”, optional honor badge). Do not replace them with advisor-style count tiles, add a third metric tile, or restyle GPA.
12. **Advisor pages keep their own layout and tools.** Reuse the student *language* (header rhythm, cards, badges, empty voice, table-from-`xl`) but do not clone degree-completion tiles, course grids, or the planner Next step onto `/advisor` or `/advisor/appointments`.
13. **Write copy in plain words.** Sentence-case buttons and titles in the product voice already used (“Review plan”, “Open the planner”, “Which term do you want to plan?”).
14. **No global horizontal scrolling.** The shell already uses `overflow-x-hidden` (`app/(app)/layout.tsx`); do not rely on that to hide overflow. Use `min-w-0`, wrapping text, and cards below `xl`. Contained scroll is allowed only for a genuinely wide table inside a labeled region.
15. **Long URLs use `[overflow-wrap:anywhere]`** (same as note bodies in `plan-notes-view.tsx`).
16. **Dates and times use `whitespace-nowrap`** (same as `NoteTime` in `plan-notes-view.tsx` and roster date cells).
17. **Destructive actions use `variant="destructive"`** on the confirming button (Cancel session, Remove Zoom link). Do not style a primary navy button as a delete.
18. **Notes and change explanations use the official Message component** (`apps/aggietrack/components/ui/message.tsx` via `@/components/ui/message`), not custom bubbles and not AI Elements. Follow the `PlanNoteRow` structure: avatar initials, name, role, nowrap timestamp, wrapping body.

---

## 1. Screen placement and information hierarchy

### Student — `/student/advising`

19. **This is the student home for booking and sessions.** Keep the sidebar item “Advising” and the existing Book Advising control pointing at `/student/advising`. Do not add a new student route for v1. **Default:** a query `?session={id}` may scroll/focus that card; there is no `/student/advising/[id]` page.
20. **Page frame** matches Students / current dashboards: `not-typeset flex flex-col gap-6 py-6` inside the shared container. No extra max-width, no second sidebar, no second page scroller.
21. **Header, in this order:**
    - `h1` **Advising** — `text-3xl font-bold text-balance sm:text-4xl`
    - `text-base` line (not muted): **Your advisor is {First Last}.** If no advisor, omit this line (the empty state below explains).
    - `text-sm text-muted-foreground` line: **Times are shown in Eastern Time (EST or EDT).**
22. **Section order:**
    - Upcoming sessions (omit the heading only when empty *and* the bookable area below already explains the empty life; if they have an advisor and no upcoming sessions, omit this section rather than stacking a second empty well)
    - Book a session (always present when an advisor is assigned)
    - Canceled sessions (only if any canceled session is still inside the visibility window — rule 191)
    - Past sessions (only if any confirmed session has ended; show the latest 8)
23. **Upcoming session card hierarchy:** other person’s name (`text-base font-medium`) → status Badge → full date/time/zone (`whitespace-nowrap` where it can sit on one line; wrap the *block*, never mid-timestamp) → duration in words (“30 minutes”) → optional topic note → Zoom row if saved → change notices → actions.
24. **Book a session hierarchy:** section `h2` **Book a session** (`text-2xl font-bold`) → one muted line naming duration and zone: **Each session is {n} minutes. Times are in Eastern Time.** → date headings → slot buttons. Do not show another advisor’s name, email, or workplace.
25. **Do not put booking controls on Progress, Planner, or Courses.**

### Advisor — `/advisor/appointments`

26. **This is the advisor home for duration, availability, and sessions.** Keep the sidebar label and page title **Appointments**. Body copy says “session,” matching AGT-17, not a second product word like “event.”
27. **Header:**
    - `h1` **Appointments** — `text-3xl font-bold text-balance sm:text-4xl` (replace the stub’s `text-4xl` + `py-6` without `gap-6`)
    - Intro `text-sm text-muted-foreground max-w-prose text-balance`: **Set how long each session lasts, add the times students can book, and manage upcoming sessions.**
    - Zone line: **Times are shown in Eastern Time (EST or EDT).**
28. **Section order:**
    - Session length
    - Availability
    - Upcoming sessions
    - Canceled sessions (visibility window, rule 191)
    - Past sessions (latest 8)
    Advisor tools (length + availability) stay above the session lists. Do not hide availability behind a student roster.

### Dashboards (limited, optional surfacing)

29. **Student dashboard (`student/(started)/page.tsx`):** If the student has at least one confirmed upcoming session, add **one** Card **after** the existing Next step card and **before** the semester course section. CardTitle **Upcoming advising**. CardDescription: `{weekday, month day, year}, {start}–{end} {TZ} with {advisorName}`. Button **View session** → `/student/advising` (optional `?session=`). If there is no upcoming session, add nothing. Do not revive mock notes or an inert “Request New Meeting” control.
30. **Do not change** the student header, `DashboardTiles`, Next step planner card, course cards, or the Advising notes empty card as part of AGT-17.
31. **Advisor dashboard (`advisor/page.tsx`):** If the advisor has at least one confirmed upcoming session, add a compact **Upcoming sessions** block **after the count tiles and before** “Waiting for review.” Show up to three rows (student name, nowrap time, outline **View** → `/advisor/appointments`). If more than three, text link **See all appointments**. If none, omit the block. Do not add a fifth count tile and do not reorder or restyle the existing review tiles, queue, or notes.

### Breadcrumbs and entry points

32. Breadcrumbs already know these pages (`dashboard-breadcrumbs.tsx`). Last crumb is not a link and uses `text-foreground`. Do not invent a “Details” crumb.
33. Keep `BookAdvisingButton` destination `/student/advising`. **Default:** leave the visible label **Book Advising** as shipped so this work does not restyle the sidebar control. The button is hidden until the student has confirmed start (`dashboard-sidebar.tsx`); do not change that gating.

---

## 2. Exact labels and copy

Use these strings verbatim unless a later Wanda review amends them. `{Name}` is `personName` style (first + last, fallback “Former user”). Times use rule 134.

### Page chrome

34. Student title: **Advising**. Advisor title: **Appointments**.
35. Student assigned intro: **Your advisor is {Name}.**
36. Shared zone helper: **Times are shown in Eastern Time (EST or EDT).**
37. Book section title: **Book a session**. Book section helper: **Each session is {n} minutes. Times are in Eastern Time.**
38. Upcoming section title: **Upcoming sessions**. Canceled: **Canceled sessions**. Past: **Past sessions**.
39. Advisor length title: **Session length**. Availability title: **Availability**.

### Status badges (never enums)

40. Confirmed upcoming → Badge `default`: **Confirmed**
41. Canceled → Badge `outline`: **Canceled**
42. A confirmed session whose end is in the past → no extra status word required when it already sits under Past sessions. If a badge is shown, use outline **Past**. Never invent “Completed,” “RESCHEDULED,” or “BOOKED.”
43. Open (unbooked) advisor time → outline **Open**
44. Open time that is booked → `default` **Booked** (advisor availability list only). The booked row also shows the student name.
45. Unknown stored status → outline **Status unavailable**

### Empty states (`Empty` + `EmptyTitle` / `EmptyDescription`; dashed `border` when the well is a named section, `border-0` when nested inside a Card)

46. Student, no assigned advisor: title **No advisor is assigned yet**. Description **When an advisor is assigned to you, you can book a time here.** No slot list, no booking button, no fabricated advisor name.
47. Student, assigned, zero open times: title **No times are open**. Description **{advisorName} has not posted any open times yet. Check back soon.**
48. Student, assigned, has open times but no upcoming booking: omit an upcoming empty well.
49. Advisor, no availability: title **No open times yet**. Description **Add a window or a single time so your assigned students can book.** EmptyContent button **Add a window of times**.
50. Advisor, no upcoming sessions: title **No upcoming sessions**. Description **When a student books one of your open times, it shows up here.**
51. Canceled / past sections: omit the section when empty. Do not stack extra empty wells.

### Session length

52. Label: **Session length**
53. Select options (visible): **15 minutes**, **20 minutes**, **30 minutes**, **45 minutes**, **60 minutes**
54. Helper: **This length applies to new times you add. Existing times and booked sessions stay as they are.**
55. Button: **Save session length**. Pending: **Saving session length…**
56. Success toast: **Session length saved**
57. Failure toast: **Session length could not be saved. Try again.**

### Availability forms

58. Primary button: **Add a window of times**. Secondary outline: **Add one time**.
59. Window dialog title: **Add a window of times**. Description: **Students will see every session that fits inside this window.**
60. Single-slot dialog title: **Add one time**. Description: **This adds one session at the length you saved.**
61. Fields: **Date**, **Start time**, **End time** (window only). Read-only line on single-slot: **Session length: {n} minutes.**
62. Window preview (after valid times): **This adds {n} sessions of {n} minutes on {weekday, month day, year}.** If a remainder exists: **The last {n} minutes are unused because they are shorter than a session.**
63. Window confirm: **Add times**. Single: **Add time**. Pending: **Adding times…** / **Adding time…**
64. Success toasts: **Times added** / **Time added**
65. Remove open times (no bookings in the target): dialog title **Remove these open times?** Description: **Open times on {date} from {start} to {end} will be removed. Booked sessions stay as they are.** Buttons: **Keep times** (outline, initial focus), **Remove times** (`destructive`). Success toast: **Open times removed**
66. Edit that would cover a booking — Alert title **This time has a booked session**. Description: **{studentName} is booked on {full timestamp}. Cancel or reschedule that session first. Removing other open times does not change the booking.** Action: **View session** (focuses that upcoming card). Do not offer a silent overwrite.

### Validation copy (client and server; same words)

67. Missing date: title **Choose a date**. Description **Pick the day these times should fall on.**
68. Missing start or end: title **Enter a start and end time**. Description **Both times are required.**
69. End before start, or end equal to start: title **Check the end time**. Description **Choose an end time after the start time.**
70. Past date/time: title **That time is in the past**. Description **Add a time that has not started yet.**
71. Duration / window mismatch (nothing fits): title **This window is too short**. Description **Offered sessions have to fit inside the window. A {n}-minute session does not fit between {start} and {end}.**
72. Date too far ahead (rule 152): title **That date is too far ahead**. Description **Add times in the next 16 weeks.**
73. Nonexistent Eastern civil time (spring-forward gap): title **That time does not exist**. Description **Eastern Time skips this hour when clocks change. Choose another time.**
74. Invalid duration (not one of the five options): title **Choose a session length**. Description **Pick 15, 20, 30, 45, or 60 minutes.**

### Booking

75. Slot accessible name: **{weekday, month day}, {start} to {end} Eastern Time**
76. Confirm dialog title: **Book this session?** Description: **Meet with {advisorName} on {weekday, month day, year}, {start}–{end} {TZ}. The session is {n} minutes.**
77. Optional student note: label **What do you want to talk about? (optional)**. Placeholder **Share anything that will help your advisor prepare.** Helper **Your advisor can read this note.** Counter `{n}/2,000 characters`
78. Buttons: **Cancel** (outline, initial focus), **Book session** (default). Pending page copy: Card title **Booking your session**, description **Saving your request…** (or the trigger label **Booking session…** if the card is already visible).
79. Success toast: **Session booked**
80. Confirmation card must then show, without another click: advisor name, full date, start–end, **EST** or **EDT**, and duration in minutes. After refresh it must still show the same facts (prove this with interaction evidence, not the first screenshot alone).
81. Failure toast/alert: **Session could not be booked. Try again.** Keep the selected slot if it is still open.

### Cancel

82. Student title: **Cancel this session?** Description: **Your session with {advisorName} on {full timestamp} will be canceled.** Optional note label **Add a note (optional)**. Placeholder **Let your advisor know why you need to cancel.**
83. Advisor title: **Cancel this session?** Description: **This cancels {studentName}’s session on {full timestamp}. They will see your note.** Required note label **Why are you canceling?** Placeholder **Explain the change so the student knows what to do next.** Helper **Required. The student can read this note.** Counter `{n}/2,000 characters`
84. Buttons: **Keep session** (outline, initial focus), **Cancel session** (`destructive`). Pending: **Canceling session…**
85. Advisor blank/whitespace note: do **not** close the dialog. `DismissibleAlert` title **Add a note**. Description **Explain why you are canceling this session.** Focus the textarea; `aria-invalid`.
86. Note too long: title **Note is too long**. Description **Keep your note to 2,000 characters or fewer.**
87. Success toast: the student sees **Session canceled**. The advisor sees **Session canceled. {studentName} can see your note.** `{studentName}` is the name stored on that session. Do not invent a name, and do not show this toast when the cancel did not save.
88. After success the session leaves Upcoming and appears under Canceled, with the note visible to the student (and the advisor).

### Reschedule

89. Dialog title: **Pick a new time**. Student description: **Your current session is {full timestamp}. Choose another open time with {advisorName}.** Advisor description: **{studentName} is currently booked on {full timestamp}. Choose another of your open times.**
90. Student optional note: **Add a note (optional)**. Advisor required note: **Why are you rescheduling?** Helper **Required. The student can read this note.** Same 2,000-character pattern and blank validation as cancel (**Add a note** / **Explain why you are rescheduling this session.**).
91. Buttons: **Keep current time** (outline, initial focus), **Reschedule session** (default). Pending: **Rescheduling session…**
92. No other open times (student): Empty title **No other times are open**. Description **Cancel this session, or wait for your advisor to add more times.**
93. No other open times (advisor): Empty title **No other times are open**. Description **Add more availability before you reschedule, or cancel this session and leave a note.**
94. Success toast: **Session rescheduled**
95. Failure (new time unavailable, save error, conflict): title **Session could not be rescheduled**. Description **Your original time is unchanged.** The original card must still show the old time after refresh.
96. Visible change notice (both people): **{Name} rescheduled this session.** Supporting line: **From {old full timestamp} to {new full timestamp}.** Then the advisor/student note, if any.

### Zoom

97. Only after the session is confirmed. Booking must succeed without a link.
98. Advisor empty: muted **No Zoom link yet**. Button **Add Zoom link**. After a link exists: **Edit Zoom link** (outline) and **Remove Zoom link** (outline, confirms destructively).
99. Dialog title **Add a Zoom link** or **Edit Zoom link**. Label **Zoom link**. Placeholder `https://zoom.us/j/…`
100. Helper (**this allowlist is a chosen default**): **Use an https Zoom link. Links on zoom.us and school Zoom addresses (like ncat.zoom.us) are accepted.**
101. Buttons: **Cancel** (outline), **Save Zoom link** (default). Pending: **Saving Zoom link…**. Success toast: **Zoom link saved**
102. Both participants see the saved URL (`[overflow-wrap:anywhere]`) and a button **Open Zoom** that opens a new tab (`rel="noopener noreferrer"`). Accessible name: **Open Zoom link (opens in a new tab)**.
103. Validation:
    - Empty: title **Enter a Zoom link**. Description **Paste the https link for this session.**
    - Not https: title **Use a secure link**. Description **The link must start with https://.**
    - Malformed: title **Check the Zoom link**. Description **Enter a valid Zoom URL.**
    - Host not allowed (**default** allowlist: `zoom.us` or a subdomain of `zoom.us`): title **Use a Zoom link**. Description **Use a zoom.us address.**
104. Remove dialog: title **Remove this Zoom link?** Description **You and the student will no longer see a join link for this session.** Buttons: **Keep link**, **Remove Zoom link** (`destructive`). Toast: **Zoom link removed**
105. Never render a rejected or unvalidated string as an `href`. Unsafe schemes (`http:`, `javascript:`, `data:`) never become links.

### Change notices

106. Render notices with Message (rule 18), oldest first, on the session card. Do not use raw kind enums (`CANCEL`, `RESCHEDULE`, `ZOOM`).
107. Phrases:
    - **{Name} booked this session.**
    - **{Name} canceled this session.**
    - **{Name} rescheduled this session.**
    - **{Name} added a Zoom link.**
    - **{Name} updated the Zoom link.**
    - **{Name} removed the Zoom link.**
    Role label: **Student** or **Advisor**. Timestamp via rule 134.
108. The optional student booking topic appears as a normal Message from the student with the body they wrote, not a fake system caption.

### Load and permission

109. Student load failure: title **Advising could not be loaded**. Description **Try again to see the latest times.** Button **Try again**. Close: **Dismiss message**.
110. Advisor load failure: title **Appointments could not be loaded**. Description **Try again to see your latest times and sessions.** Button **Try again**.
111. Unauthorized or missing session: heading **This session is unavailable**. Body **It does not exist or you do not have access to it.** Do not reveal another person’s name, whether a session exists, or another advisor’s calendar. Button: **Back to advising** (student) or **Back to appointments** (advisor).

---

## 3. Components, tokens, and spacing

112. **Tokens only from the existing theme** (`packages/ui/src/styles.css`): `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-secondary`, `text-destructive`, `ring-ring`. Light theme is navy and gold on white; dark uses the inverted palette. No new status colors.
113. **Type:** Montserrat (`--font-sans`). Page titles `text-3xl sm:text-4xl font-bold`. Section titles `text-2xl font-bold`. Names `text-base font-medium`. Supporting copy `text-sm text-muted-foreground`. Intro `max-w-prose text-balance`. Duration and numeric counts `tabular-nums` where they are numbers. Do not use `text-5xl` or the old student `gap-16 py-16` rhythm.
114. **Spacing:** page `gap-6 py-6`; inner header `space-y-2`; grids `gap-4`; related controls `gap-2`; field groups `gap-4`; card padding as the existing Card provides. Shell padding stays `px-4`. Radius stays `rounded-lg` / theme radius. No gradients, ornamental timelines, or new shadows.
115. **Buttons:** default for the primary next step (Book session, Add times, Reschedule session, Save Zoom link). Outline for secondary. Destructive for irreversible confirms. Ghost for dismissals like “Not now” only if needed. Mobile primary actions `h-11 w-full` (same as student roster cards). Desktop table-row actions stay compact and `whitespace-nowrap`.
116. **Slots:** `Button variant="outline"` when idle, `default` when selected. Do not build a custom chip kit.
117. **Advisor availability from `xl`:** wrap a `Table` in `Card className="overflow-hidden py-0"` (copy `advisor/students/page.tsx` and `advisor/page.tsx`). Columns: Date, Time, Length, Status, Action. `table-fixed`, cells `align-top`, times `whitespace-nowrap`. Below `xl`: one Card per window or slot (date, time, badge, actions `h-11 w-full`).
118. **Session lists:** cards on all widths (these are few and action-heavy). Do not force a dense table of student sessions at 390px.
119. **Do not add Tabs.** Date grouping with `h3` headings is enough for the slot list.

---

## 4. Duration and availability behavior

These are **chosen defaults** except where AGT-17 already requires the behavior (validation, no silent booking changes, sessions fitting inside the window).

120. **Allowed lengths:** 15, 20, 30, 45, or 60 minutes. **Default selected length: 30 minutes** until the advisor saves another.
121. Changing the saved length never rewrites existing open slots or bookings. It only applies to the next window or single time the advisor adds (helper in rule 54).
122. **Manual entry means the advisor types/selects availability**, not that they book a student on someone’s behalf. There is no “Book for student” flow in this version.
123. **Two add paths:** a window (date + start + end, split into consecutive slots of the saved length, starting at the window start) and a single time (date + start; end = start + saved length).
124. **No recurrence in this version.** Each window or slot is one calendar date. If weekly hours are wanted later, that is new scope.
125. **Time choices are 15-minute steps** from **7:00 AM through 9:00 PM** Eastern, shown as “7:00 AM”, “2:15 PM”. Use Select (and Calendar + Popover for the date), not a free-text time field that invites invalid typing.
126. Generate only whole sessions. Never offer a leftover partial slot. Show the unused-remainder helper when needed (rule 62).
127. Reject invalid duration, end-before-start, zero-length, past times, too-far-ahead times, and nonexistent DST civil times (rules 67–74). Server repeats every check.
128. **Advisors may edit or remove only open (unbooked) times.** Booked times are locked from silent edit. Conflicts use rule 66.
129. Removing a window removes only its remaining open slots. Booked sessions in that span stay put and remain visible as bookings.
130. Overlapping open times the advisor adds are rejected: title **This overlaps another open time**. Description **Change the start or end so it does not cover a time you already added.**
131. Students see **only** open, unbooked, future slots that belong to **their currently assigned advisor**. Never another advisor’s calendar.

---

## 5. Date, time, and time zone

132. Store instants unambiguously (UTC). **Enter and display in `America/New_York`.** Use `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", …, timeZoneName: "short" })` the way `planTimestamp` does in `lib/plan-status.ts`. Reuse or extend that helper rather than a one-off formatter.
133. **Always label the zone as EST or EDT**, whichever is correct that day. Never print `America/New_York` to users. Never print `GMT-5` or `UTC`.
134. **Full timestamp** (confirmation, session cards, notices, dialogs): `Tuesday, November 10, 2026, 2:00–2:30 PM EST` (weekday + month name + day + year + start en-dash end + 12-hour time + zone). Use a real en-dash (`–`) between times.
135. **Slot buttons** may show the shorter `2:00–2:30 PM` because the date heading and page helper already carry the date and zone. The accessible name still includes the date and “Eastern Time” (rule 75).
136. **Date headings** over groups of slots: `Tuesday, November 10, 2026`.
137. **List dates without a time** (if needed) may use `planDate` (`Nov 10, 2026`). Session cards always include the time and zone.
138. Wrap the timestamp element with `whitespace-nowrap`. If the card is too narrow, wrap *before* the timestamp, not in the middle of `2:00–2:30 PM EST`.
139. Use a semantic `<time dateTime={ISO string}>`. Title attribute may hold the full timestamp (see `planNoteTimestampTitle`).
140. After the advisor enters a window, show the preview in Eastern with the correct EST/EDT label so they can catch a DST mistake before saving.
141. **Spring-forward:** a local time that does not exist is invalid (rule 73). **Fall-back:** if a civil time occurs twice, **default** to the first (earlier, daylight) occurrence and show the resulting EDT/EST label in the preview so the advisor can adjust.

---

## 6. Booking, cancel, reschedule, and Zoom interactions

142. **Booking an open slot confirms immediately.** No advisor approval step. Confirmation and change notices are in-app only. No calendar invites, email, SMS, or automatic Zoom meeting creation in this version.
143. Selecting a slot opens the Book dialog; it does not book on highlight or on hover.
144. Close the dialog, then start the request (rule 10). Disable duplicate submits with a synchronous in-flight guard. Pending must not look like success.
145. On success, the session appears in **both** the student’s and the advisor’s Upcoming lists and remains after a full refresh.
146. Students may hold **more than one** upcoming session if the times do not overlap. Overlap of either participant is a conflict (rule 160).
147. **Cancel and reschedule** are available to both people until the session starts. After start: hide those actions and show muted **This session has already started.** After end: the card lives under Past; no cancel/reschedule.
148. Advisor cancel and advisor reschedule **require a nonblank trimmed note**, visible to the student on the session card. Student notes are optional.
149. Reschedule uses the same slot picker, excluding the current time. The write must be atomic: validate the new time and move the booking in one step. If the new time is unavailable or saving fails, the original booking remains (copy in rule 95). On success, the old time becomes open again if it is still in the future and still part of the advisor’s availability; it must not stay “ghost booked.”
150. The person who made the change gets the success toast (rules 87 and 94). The other person sees the updated card and the change notice on next load (in-app; no email).
151. **Default lead time:** a slot must start at least **15 minutes** from now to be bookable or to be added as new availability.
152. **Default student horizon:** next **8 weeks** of open slots. **Default advisor add horizon:** next **16 weeks**.
153. **Assignment changes (default):** existing confirmed sessions stay visible to the original student and original advisor until they end or are canceled. New booking options follow the student’s **current** assigned advisor only. Reschedule of an existing session uses that session’s advisor’s remaining open times.
154. Zoom add/edit/remove follows rules 97–105 and is advisor-only. Students never type a Zoom URL.

---

## 7. Loading, pending, success, error, empty, stale, and conflict states

155. Add `apps/aggietrack/app/(app)/student/(started)/advising/loading.tsx` and `apps/aggietrack/app/(app)/advisor/appointments/loading.tsx`. Skeleton the header, one card, and a row of slot placeholders. Screen-reader text: **Loading advising…** / **Loading appointments…**. Never flash a fake “Confirmed” badge, a sample Tuesday 2:00 PM slot, or a zero count presented as truth.
156. **Pending:** after the dialog closes, show page-level pending (Card or button label) and `aria-busy` on the region. After 10 seconds without a result, polite text: **This is taking longer than usual. Please wait before trying again.** Do not re-enable a second write until the first is reconciled.
157. **Success:** sonner success + the updated card/list. Do not also show a success Alert that repeats the toast.
158. **Empty:** rules 46–51. One empty well per situation; do not stack three empties on a healthy page.
159. **Validation errors:** `DismissibleAlert` next to the field, `aria-invalid` on the control, focus the field. Dialog stays open when validation failed because no action started.
160. **Stale slot / taken mid-booking / concurrent double-book:** title **That time is no longer open**. Description **Someone booked it, or it was removed. Pick another time.** Refresh the visible slots and clear the stale selection. This covers AGT-17 criterion 4’s useful error; server enforcement is still required and cannot be inferred from the Alert screenshot.
161. **Stale page after the advisor edited availability:** booking a disappeared slot uses rule 160. Advisors who try to delete or shrink over a booking use rule 66. Offer **Refresh times** on those alerts.
162. **Availability or duration edit must never silently move, resize, or cancel a booking.** If the change would affect a booking, block it and explain (rule 66). There is no “update bookings to match” checkbox in this version.
163. **Network / unknown failure:** sonner or Alert **Something did not save. Try again.** Do not print stack traces, Prisma errors, or codes like `UNIQUE_CONSTRAINT`.
164. **Session expired:** title **Sign in to continue**. Description **Your session ended. Sign in again before making changes.** Button **Sign in**. Do not put notes or Zoom URLs in the return path.
165. If prior data exists while a refresh fails, keep it visible and mark it with Alert title **Information may be out of date**. Description **Refresh before making changes.** Button **Refresh times**.

---

## 8. Keyboard, focus, and accessibility

166. Target WCAG 2.2 AA. Text contrast 4.5:1; UI chrome 3:1. Badge meaning is its words, never color alone (gold secondary vs outline vs default).
167. Real headings: page `h1`, sections `h2`, date groups `h3`. One main landmark (the shared shell already provides the chrome).
168. Every field has a visible Label / FieldLabel. Slot buttons have accessible names (rule 75). Repeated Cancel/Reschedule actions include the other person and the time in the accessible name: **Cancel session with {Name} on {date} at {time}**.
169. Built-in focus rings (`focus-visible:ring-ring/50` from the Button component). Do not remove them. Do not `blur()` to tidy hover styles.
170. Dialogs use the existing Dialog / AlertDialog title and description, focus trap, and Escape / Cancel. Initial focus: the safe action (**Cancel**, **Keep session**, **Keep current time**, **Keep times**, **Keep link**). Required-note dialogs may focus the textarea instead (same as Return plan in `ReviewPanel.tsx`).
171. After a dialog closes into pending, move focus to the pending card title or the session heading — not to the document start.
172. Minimum 44×44 CSS pixel targets on 390px for slot buttons and card actions (`h-11`). Desktop table actions may stay the default control height.
173. Do not make an entire session card an unlabeled clickable region. Actions are explicit buttons/links.
174. Zoom opens in a new tab and says so (rule 102).
175. Avatars are decorative (`aria-hidden`) when the name is present, matching plan notes.
176. Live regions are polite and limited to pending text and new-notice counts. Do not mark the entire session list `aria-live`.
177. Support 200% text size, 400% zoom/reflow, reduced motion, keyboard-only use, and VoiceOver/TalkBack reading order: name, status, time, duration, notes, actions.
178. Mobile inputs that accept typing should render at 16px to avoid iOS zoom (existing Field/Textarea text size).

---

## 9. 390px versus desktop (1280px)

179. Review viewports: **390px** (narrow phone) and **1280px** (desktop with the inset sidebar). Also spot-check 360 and 400 if a dialog footer is close to wrapping.
180. **390px:** single column. Header, then stacked cards. Slot buttons `h-11 w-full` in date groups. Session actions stack full width (Reschedule, then Cancel). Availability forms stack Date / Start / End. No four-column grids. No `md:grid-cols-4` inside the shell (that pattern already clipped Students filters).
181. **From ~400px / `@min-[23rem]`** (see `term-choice-dialog.tsx`): dialog footers may sit in a row, outline first, primary or destructive last. If a long label wraps (student or advisor full name inside a button), **stack the footer again** rather than clipping text. Follow the PR #33 lesson: viewport `sm` is wider than a dialog card, so prefer container queries over `sm:` for footer direction.
182. **1280px:** page still one column of sections (this is not a dashboard tile wall). Slot buttons wrap in a `flex flex-wrap gap-2` row under each date. Advisor availability uses the Card table (rule 117). Session cards may put actions in a right-aligned row (`flex-wrap`, `whitespace-nowrap` on the time).
183. Dialog width: `w-full max-w-[calc(100%-2rem)]` on narrow, `sm:max-w-md` on desktop, matching term-choice containment. Dialog max-height is viewport-relative; body scrolls; footer actions stay reachable.
184. No page-level horizontal scrollbar at 390 or 1280, at 200% text, or with a long hyphenated name and a long Zoom URL. Long names use `text-pretty` / wrapping; URLs use `[overflow-wrap:anywhere]`.

---

## Chosen defaults (not extra owner requirements)

These are labeled so implementers can proceed. They are not AGT-17 text; they fill gaps AGT-17 left open.

185. **Spelling:** American “Canceled” / “Canceling” in UI (the issue text uses “cancelled”). Buttons stay **Cancel session**.
186. **No weekly recurrence.** One-off windows and slots only.
187. **No in-person location field** and no “Virtual / In person” enum. A Zoom link is an optional add-on after confirmation, not a meeting-type selector.
188. **Duration presets** 15/20/30/45/60; default **30 minutes**; no freeform custom length.
189. **Time grid** 15-minute steps, 7:00 AM–9:00 PM Eastern.
190. **Lead time** 15 minutes; **student visibility** 8 weeks; **advisor add window** 16 weeks.
191. **Canceled sessions stay visible for 30 days** after the original start so the required advisor note remains readable, under **Canceled sessions**, not Upcoming.
192. **Past sessions** show the latest 8 confirmed sessions that have ended.
193. **Single page per role**; optional `?session=` focus. No new detail route.
194. **Dashboard surfacing** only when an upcoming session exists (rules 29–31).
195. **Student booking note** is optional (“What do you want to talk about?”).
196. **Multiple non-overlapping bookings** are allowed.
197. **Zoom allowlist default:** `https` + hostname `zoom.us` or `*.zoom.us` (includes `ncat.zoom.us`). No `http`, no other hosts, no auto-created Zoom meetings.
198. **Fall-back DST** uses the earlier occurrence and shows the zone label.
199. **Assignment change** keeps existing sessions with the original pair; new slots come only from the current assigned advisor.
200. **Not now / later work:** calendar sync, email/SMS, automatic Zoom, booking with a non-assigned advisor, advisor booking on behalf of a student.

---

## Blocking product ambiguity

201. **None.** AGT-17’s nine criteria plus the working defaults in the issue are enough to specify the UI. Items 185–200 are chosen defaults, not open questions that should halt implementation. If James later wants weekly office hours, an office-location field, or a wider Zoom allowlist, amend this file rather than improvising during review.

---

## Pass / fail review matrix (mapped to AGT-17)

Wanda marks each row pass or fail against **named evidence**. Behavior rows cannot pass on screenshots alone.

| AC | Criterion (from AGT-17) | Design pass requires | Evidence required | Fail examples |
| --- | --- | --- | --- | --- |
| **1** | Assigned student sees advisor’s open times, session duration, and an explicitly labeled time zone. No advisor → clear explanation, no booking options. No availability → clear empty state. | Rules 21, 24, 35–37, 46–47, 131–137. Duration and EST/EDT visible without hover. Unassigned screen has zero slot buttons. | `student-advising-assigned-390.png`, `student-advising-assigned-1280.png`, `student-no-advisor-390.png`, `student-no-advisor-1280.png`, `student-no-slots-390.png`, `student-no-slots-1280.png` | Another advisor’s times shown; zone missing; raw `America/New_York`; unassigned student still sees slots; empty page with only a blank header |
| **2** | Advisors set durations and add/edit/remove availability, including manual windows or slots. Invalid duration, end-before-start, and past slots rejected. Offered sessions fit in the window. | Rules 52–74, 120–130. Forms use Field labels; preview states how many sessions fit; unused remainder explained. | `advisor-duration-390.png`, `advisor-duration-1280.png`, `advisor-availability-390.png`, `advisor-availability-1280.png`, `validation-end-before-start-390.png`, `validation-past-slot-390.png`, `validation-window-too-short-390.png`, plus interaction notes that save/remove persisted after refresh | Recurring UI shipped against default 186 without an amendment; partial leftover slot offered; past time accepted on screen; end-before-start only fails on the server with no Alert; changing duration silently rewrites existing slots |
| **3** | Student selects an open slot and confirms. Confirmation shows advisor, date, time, zone, duration. Session appears in both upcoming lists and stays correct after refresh. | Rules 75–80, 145. Confirmation card complete on student *and* advisor upcoming. | `student-book-confirm-390.png`, `student-book-confirm-1280.png`, `student-booked-390.png`, `student-booked-1280.png`, `advisor-upcoming-390.png`, `advisor-upcoming-1280.png`, **interaction:** `student-booked-after-refresh` (screenshot after reload or a short recording) | Booked without a confirm dialog; missing zone or duration on the confirmation; advisor upcoming not captured; refresh evidence missing (cannot infer persistence) |
| **4** | Server validates current availability and assignment. Stale/conflict selections show a useful error. Concurrent requests cannot double-book either person or create duplicates. | Rule 160 copy is used. UI disables double-submit. **Functionality does not pass from the Alert screenshot.** | `conflict-slot-taken-390.png` (and 1280 if layout differs) showing rule 160 words after a taken slot, **plus** a functional note naming the two sessions/actors used and the resulting single booking | Alert screenshot alone offered as proof of server locking; generic “Error” toast; both UI sessions appearing booked without a functional report |
| **5** | Both can cancel or reschedule. Advisor changes require a nonblank note visible to the student; student notes optional. Both see change notices and updated details. Actor gets confirmation. Canceled sessions leave Upcoming. Changes persist after refresh. | Rules 82–96, 106–108, 147–148. Destructive cancel button. Advisor dialog refuses to close on a blank note. | `advisor-cancel-note-390.png`, `student-sees-cancel-note-390.png`, `student-sees-cancel-note-1280.png`, `advisor-reschedule-390.png`, `student-sees-reschedule-390.png`, `student-canceled-not-upcoming-390.png`, toasts for the actor, **interaction:** refresh after cancel and after reschedule | Advisor can cancel without a note; note not shown on the student card; canceled card still under Upcoming; student dialog requires a note (against spec); refresh evidence missing |
| **6** | Reschedule validates the new time and changes atomically. Failure leaves the original intact. Successful cancel or move releases the old time when it is still valid availability. | Rules 89–95, 149. Failure copy in rule 95. | `reschedule-failure-original-kept.png` (or recording) **and** `reschedule-success-old-slot-released` showing the old time open again for booking (or documented why that old time was no longer valid availability) | Failure UI shown but original time missing; success shown without proving the old slot returned; atomicity claimed from a single success screenshot |
| **7** | Changing availability or default duration does not silently move, resize, or cancel bookings. Conflicting edits are explained and need an explicit booking change. | Rules 54, 66, 121, 128–129, 162. | `advisor-edit-length-bookings-unchanged.png` (same booking before/after a length change), `conflict-availability-over-booking-390.png` showing rule 66 | Booking time changed after an availability edit without a reschedule dialog; booking vanished after “Remove times”; no explanation Alert |
| **8** | After confirmation, advisor can add or edit a valid Zoom URL. Both can see and open it. Missing links do not block booking. Unsafe or malformed URLs are rejected. | Rules 97–105, 15, 184. URL wraps; Open Zoom present only for a saved valid link. | `student-booked-without-zoom-390.png`, `advisor-zoom-add-390.png`, `student-sees-zoom-390.png`, `student-sees-zoom-1280.png`, `validation-bad-zoom-390.png` (http, malformed, and non-zoom host), `long-url-390.png` | Zoom required on the book dialog; `http` or `javascript:` accepted or rendered as href; long URL overflows the page; student cannot see a link the advisor saved |
| **9** | Server authorization: students manage only their sessions and book only their assigned advisor; advisors manage only their availability and sessions. Tampering with IDs cannot expose someone else’s records. | Unassigned empty state (AC1). Generic unavailable copy (rule 111). No other-student names on unauthorized views. **Authorization does not pass from hidden buttons in a screenshot.** | `student-no-advisor-390.png` (no slots), `session-unavailable.png` if an unauthorized URL was opened in a controlled test, **plus** a functional/security note covering ID tampering and cross-account reads | Design approval that treats “I don’t see a button” as authorization; unavailable page that names another student |

---

## Required evidence (for the next Wanda review)

Put files under `/workspace/evidence/agt17/review/` (create it when screenshots are ready). Name files so the matrix can cite them.

### Screenshots at 390px and 1280px

202. Student advising with assigned advisor and open slots (both widths).
203. Student confirmation dialog (both widths, stacked vs row footer).
204. Student upcoming / confirmation card after booking (both widths).
205. Student, no advisor (both widths).
206. Student, advisor assigned, zero slots (both widths).
207. Advisor appointments: session length, availability list, upcoming (both widths).
208. Advisor empty availability (both widths).
209. Advisor cancel dialog with required note (390 at minimum).
210. Advisor reschedule dialog (390 at minimum).
211. Student view of an advisor cancel note and of a reschedule notice (both widths).
212. Zoom: advisor editor, student view of the link, rejected unsafe URL (390 at minimum; 1280 for the long-URL case).
213. Student dashboard with original tiles unchanged (both widths). If an upcoming card is shown, capture that too — tiles must still match `dashboard-tiles.tsx`.
214. Advisor dashboard with original count tiles and review queue unchanged (both widths). If the compact upcoming block is shown, it sits below the tiles, not in place of them.
215. Long student or advisor name and a long Zoom URL (both widths) — no global horizontal scroll, no clipped timestamp, URL wraps.
216. Dialog footers: 390 stacked, 1280 (or 400+) in a row; a long-label case that wraps must stack instead of clipping (PR #33 lesson).

### Interaction evidence (recordings or sequenced stills plus a one-line caption)

217. Book → confirmation card → **reload** → same details on student and advisor.
218. Two attempts to book the same slot (two browsers or two students) → one success, one rule 160 error, a single upcoming session.
219. Student books a slot, then the slot is removed from the stale picker → rule 160, list refreshes.
220. Advisor cancel with note → student sees note → canceled item is not in Upcoming after refresh.
221. Advisor reschedule success → both see the new time and the from/to notice after refresh; old time is bookable again if still valid.
222. Reschedule failure (slot taken or save error) → original time still present after refresh (rule 95).
223. Advisor changes session length → existing booking unchanged.
224. Advisor tries to delete or shorten availability that covers a booking → rule 66, booking unchanged.
225. Add/edit Zoom after confirmation → both can open the https Zoom URL; booking without Zoom still works.
226. DST fixture: display or reject a spring-forward gap; display a fall-back time with the correct EST/EDT label (rule 141).

### What a design approval will say

227. Each Wanda approval or rejection will name: the evidence paths reviewed, each AC row’s pass/fail, failed rule numbers, and leftover gaps. It will explicitly list any AC that still waits on functional/security verification (especially **4, 6, and 9**). It will never treat a screenshot of a toast or a confirmation card as proof that the server accepted, rejected, or persisted a write.

---

## Out of scope (do not build in this gate)

228. Calendar integrations, email, SMS, push, or the stub `/account/notifications` page.
229. Automatic Zoom meeting creation.
230. Booking an advisor who is not assigned, or an advisor booking on a student’s behalf.
231. Restyling student dashboard tiles, advisor review tiles, planner, progress, or plan notes beyond the compact upcoming cards in rules 29–31.
232. Private advising notes (`AdvisingNote` in `prisma/advising.prisma`) mixed into session change notices.

---

*Prepared as Wanda’s design quality gate for AGT-17. Inspected preview sources are listed above. No repository files were changed.*
