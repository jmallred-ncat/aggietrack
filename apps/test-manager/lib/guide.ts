export type GuideMatch = { section?: string; label: string };

export type GuideEntry = {
  term: string;
  plain: string;
  labels?: GuideMatch[];
};

export type GuideGroup = {
  id: string;
  title: string;
  intro: string;
  entries: GuideEntry[];
};

export const guideGroups: GuideGroup[] = [
  {
    id: "workspace",
    title: "The workspace",
    intro: "These are the kinds of records you will open. Each one has its own dashboard.",
    entries: [
      { term: "Test case", plain: "A check someone can follow. It says what to set up, what to do, and what has to be true before it counts as passed." },
      { term: "Requirement", plain: "Something the product is supposed to do, or a quality it is supposed to have. Test cases are linked to the requirement they check." },
      { term: "Functional", plain: "A task a person should be able to do, such as signing in or adding a course.", labels: [{ section: "Traceability", label: "Functional" }] },
      { term: "Non-functional", plain: "A quality the product should have, such as speed, security, or working in common browsers.", labels: [{ section: "Traceability", label: "Non-functional" }] },
      { term: "Defect", plain: "A problem found while trying a test case. It stays open until someone checks the fix and agrees it can be closed." },
      { term: "Decision", plain: "A question the team still needs to settle, or has already settled. Open means it is not settled yet. Approved means it was accepted. Deferred means it was postponed." },
      { term: "Static finding", plain: "A note about a gap. Findings are kept for the record and are left out of pass and fail counts.", labels: [{ label: "Static findings" }] },
      { term: "Fixture", plain: "A prepared set of people, courses, and settings. Tests start from a fixture so everyone tries the same situation.", labels: [{ section: "Data", label: "Fixture" }] },
      { term: "Course catalog", plain: "The courses that can be loaded for a test, with credits, terms, and general-education tags." },
      { term: "Test plan", plain: "The written plan for this round of testing: what is in scope and how the work is organized." },
      { term: "Archive", plain: "Hides the record from the active lists and from coverage counts. The record stays on its page and can be restored." },
      { term: "Related records", plain: "Other items this one points to. Open a card to see that item’s dashboard." },
      { term: "History", plain: "Earlier saves of this record. They stay here when the record changes." },
      { term: "Execution", plain: "What happened the last time someone tried this case: the result, who tried it, when, and where." },
      { term: "Update", plain: "The fields you fill in after the item exists, such as status, owner, and the outcome." },
      { term: "Coverage", plain: "How far the linked test cases have gotten. Execution incomplete means at least one linked case has not passed yet." },
      { term: "Mapped", plain: "How many test cases are linked to this requirement." },
      { term: "Passed", plain: "How many of those linked test cases have passed." },
      { term: "Open defects", plain: "Problems that are not closed yet." },
      { term: "Unresolved decisions", plain: "Decisions that are still marked Open." },
      { term: "Execution standard", plain: "What to write down before you leave a test: what you saw, who tried it, when, where, and where the proof is." },
      { term: "Requirement coverage", plain: "Each requirement, the cases linked to it, and how many of those cases have passed.", labels: [{ label: "Requirement coverage" }] },
    ],
  },
  {
    id: "tests",
    title: "Test cases",
    intro: "Update case changes the written case. Record execution is a separate step for the latest try: the result, who tried the case, when, and where.",
    entries: [
      { term: "Test / scenario", plain: "What you are checking, in one sentence." },
      { term: "Requirement IDs", plain: "The requirements this case is meant to check." },
      { term: "Type", plain: "The kind of check. Functional means a person can do the task. The others are qualities such as security, speed, reliability, or ease of use." },
      { term: "Preconditions", plain: "What must already be true before you start, such as an account that exists or a term that is open." },
      { term: "Inputs / data", plain: "The information you type or use during the case, such as a name, a course, or a password." },
      { term: "Procedure", plain: "The steps, in the order you do them." },
      { term: "Expected result", plain: "What you should see if the product does the right thing.", labels: [{ section: "Tests", label: "Expected result" }, { section: "Defects", label: "Expected result" }] },
      { term: "Pass criterion", plain: "The specific thing that must be true before you mark this case Passed." },
      { term: "Decision dependency", plain: "A decision that has to be settled before this case can pass." },
      { term: "Evidence to retain", plain: "What to keep so someone else can see that this attempt happened." },
      { term: "Priority", plain: "How soon this should be tried. High comes before Medium, and Medium comes before Low." },
      { term: "Test status", plain: "Where this case stands. Not run means nobody has tried it yet. Pass means it met the pass criterion. Fail means it did not. Blocked means something else stopped the attempt.", labels: [{ section: "Tests", label: "Status" }] },
      { term: "Not run", plain: "Nobody has tried this yet." },
      { term: "Pass", plain: "The case did what the pass criterion asked." },
      { term: "Fail", plain: "The case did not do what the pass criterion asked." },
      { term: "Blocked", plain: "Something else stopped the attempt, so this is neither a pass nor a fail." },
      { term: "Actual result", plain: "What you actually saw when you tried it.", labels: [{ section: "Tests", label: "Actual result" }, { section: "Defects", label: "Actual result" }] },
      { term: "Defect ID", plain: "A problem found from this case. You can link one that already exists, or create one." },
      { term: "Evidence reference", plain: "Where to find the proof for this attempt, such as a file name or a link." },
      { term: "Environment", plain: "Where you tried it. Local is a machine of your own. Preview is a shared test site. Production is the live site." },
    ],
  },
  {
    id: "defects",
    title: "Defects",
    intro: "A defect records who found a problem, who is fixing it, and the later test runs that check the fix.",
    entries: [
      { term: "Steps and inputs", plain: "What you did, in order, when you found the problem." },
      { term: "Test / requirement IDs", plain: "The test case or requirement this problem came from. A linked test case is also a retest." },
      { term: "Severity", plain: "How serious the problem is. Critical and High need attention before Medium and Low." },
      { term: "Found by", plain: "The person who created the defect. A new defect starts with the person who is signed in." },
      { term: "Assigned to", plain: "The person responsible for fixing the problem. A new defect leaves this empty until someone is chosen.", labels: [{ section: "Defects", label: "Assigned to" }] },
      { term: "Defect status", plain: "New means it was just recorded. Open means it still needs work. In progress means someone is fixing it. Fixed means a fix is ready to check. Closed means a linked test passed and someone approved the close.", labels: [{ section: "Defects", label: "Status" }] },
      { term: "Fix build", plain: "The version where someone says the problem is fixed. Leave it empty until there is one." },
      { term: "Retests", plain: "Each linked test case. Its latest result, date, and evidence appear here after someone records an execution. You do not type a retest ID." },
      { term: "Regression / closure approval", plain: "Who agreed the fix held and did not break a neighboring task, so the defect can be closed." },
    ],
  },
  {
    id: "risks",
    title: "Risks and decisions",
    intro: "A decision is a call the team needs to make. A finding is a gap that is written down and left out of the pass and fail counts.",
    entries: [
      { term: "Source gap or constraint", plain: "What is missing or unclear in the requirement, the product, or the rules." },
      { term: "Affected requirements", plain: "The requirements this decision changes." },
      { term: "Affected tests", plain: "The test cases this decision changes." },
      { term: "Decision status", plain: "Open means the call is not made yet. Approved means it was accepted. Deferred means it was postponed.", labels: [{ section: "Risks & Decisions", label: "Status" }] },
      { term: "Decision owner role", plain: "The people who need to make this call. More than one person can be selected." },
      { term: "Proposed control / decision", plain: "The suggested way to handle the risk." },
      { term: "Approved decision / evidence", plain: "What was decided, and the proof that it was accepted." },
      { term: "Review", plain: "Who looked at this decision, and the date they did." },
    ],
  },
  {
    id: "requirements",
    title: "Requirements",
    intro: "A requirement dashboard shows the agreed wording, where it came from, and which test cases cover it.",
    entries: [
      { term: "Baseline requirement (faithful summary)", plain: "The requirement in the words the team agreed to test." },
      { term: "Source priority", plain: "How important the source document says this is: High, Medium, or Low. Not stated means the document did not rank it." },
      { term: "Source location", plain: "Where to find this in the source document, such as a page number." },
      { term: "Decision dependencies", plain: "Decisions that have to be settled before this requirement can be counted as covered." },
    ],
  },
  {
    id: "fixtures",
    title: "Fixtures and sources",
    intro: "A fixture is the starting situation for a test. The purpose says why it exists. The other fields say how to build it and how to know the right answer.",
    entries: [
      { term: "Seed definition", plain: "The exact people, courses, and settings that are loaded before the test starts." },
      { term: "Independent oracle / rule", plain: "The answer key. It says what the correct outcome is, without relying on the screen you are testing." },
      { term: "Setup and reset", plain: "How to put that data in place, and how to put it back so the next person starts clean." },
    ],
  },
  {
    id: "catalog",
    title: "Course catalog",
    intro: "Each course is a record the tests can use. The codes below are the catalog’s own shorthand.",
    entries: [
      { term: "Offered codes", plain: "The terms this course is offered. Fall is F, Spring is S, and Summer is SS. Not specified means the catalog did not name a term." },
      { term: "GEC categories", plain: "General-education tags, such as humanities or social science. Not tagged means this course is not in those groups." },
      { term: "Seed status", plain: "Seedable means this course can be loaded into a fresh test. Skipped by seed means it is left out on purpose." },
      { term: "Raw prerequisites", plain: "The catalog’s own words for what a student must already have taken." },
      { term: "Raw corequisites", plain: "The catalog’s own words for what a student must take at the same time." },
      { term: "Absent references", plain: "A course this record mentions that is not in the catalog we loaded." },
      { term: "Source file", plain: "The file this row was copied from." },
      { term: "Catalog source URL", plain: "The public catalog page for this course." },
    ],
  },
  {
    id: "plan",
    title: "Test plan",
    intro: "Each section is a piece of the written plan.",
    entries: [
      { term: "Plan and process", plain: "The wording of this part of the plan." },
    ],
  },
];

const entries = guideGroups.flatMap(group => group.entries);

export function guideSlug(term: string) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function explain(section: string, label: string) {
  return entries.find(entry => {
    const labels = entry.labels ?? [{ label: entry.term }];
    return labels.some(item => item.label === label && (item.section === undefined || item.section === section));
  });
}
