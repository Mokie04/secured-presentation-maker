import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const MATH_LAW_OF_SINES_TOPIC = 'Law of Sines and Ambiguous Cases';
const MATH_LAW_OF_SINES_COMPETENCY = 'Apply the law of sines in solving oblique triangles, including ambiguous cases.';

const MATH_LAW_OF_SINES_OBJECTIVES = [
  'By the end of Session 1, learners identify opposite angle-side pairs in oblique triangles, apply the Law of Sines to solve ASA and AAS cases, and justify answers with ratio setup and reasonableness checks.',
  'By the end of Session 2, learners identify SSA data, determine whether it forms no triangle, one triangle, or two triangles, and justify the decision using height comparison and angle reasoning.',
  'By the end of Session 3, learners solve SSA ambiguous-case problems by branching possible angle measures, calculating valid triangle measures, and evaluate which branches must be rejected.',
  'By the end of Session 4, learners classify Law of Sines case types, solve required measures including ambiguous cases, and defend whether the task has no, one, or two valid solutions.',
];

const mathLawOfSinesBlueprint: LessonBlueprint = {
  mainTitle: MATH_LAW_OF_SINES_TOPIC,
  planUnitLabel: 'Session',
  subject: 'Mathematics',
  gradeLevel: 'Grade 10',
  quarter: 'First Term',
  learningCompetency: MATH_LAW_OF_SINES_COMPETENCY,
  smartObjectives: [...MATH_LAW_OF_SINES_OBJECTIVES],
  studentFacingObjectives: [...MATH_LAW_OF_SINES_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Law of Sines for ASA and AAS',
      focus: 'Learners identify opposite angle-side pairs, set Law of Sines ratios, solve ASA/AAS cases, and check reasonableness.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'SSA Ambiguous Case Decisions',
      focus: 'Learners use height comparison and angle reasoning to decide whether SSA data gives no, one, or two triangles.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'SSA Branching and Validation',
      focus: 'Learners solve SSA cases with solution trees, test supplement branches, and reject invalid branches with angle-sum evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Law of Sines Performance Defense',
      focus: 'Learners classify case type, solve all valid Law of Sines solutions, and defend ambiguity decisions.',
      generationStatus: 'pending',
    },
  ],
};

const mathMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Mathematics',
  topic: MATH_LAW_OF_SINES_TOPIC,
  gradeLevel: 'Grade 10',
  gradeBand: '7-10',
  learningCompetency: MATH_LAW_OF_SINES_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'diagram',
): ImageSemanticMetadata => ({
  ...mathMetadata,
  visualRole,
  slideTemplate,
  semanticAnchor,
  style,
});

const slide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imagePrompt = '',
  slideTemplate = 'content',
  visualRole = 'content',
  style: ImageSemanticMetadata['style'] = 'diagram',
  imageOverlays?: Slide['imageOverlays'],
  visualLayout?: Slide['visualLayout'],
): Slide => ({
  title,
  content,
  speakerNotes,
  imagePrompt,
  imageStyle: imagePrompt ? style : 'none',
  ...(imagePrompt ? { imageSemanticMetadata: metadataFor(slideTemplate, visualRole, `${title}. ${content.join(' ')}`, style) } : {}),
  ...(imageOverlays ? { imageOverlays } : {}),
  ...(visualLayout ? { visualLayout } : {}),
});

const evidenceSlide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imagePrompt: string,
  slideTemplate = 'content',
  visualRole = 'content',
): Slide => slide(title, content, speakerNotes, imagePrompt, slideTemplate, visualRole, 'diagram', undefined, 'evidence');

const initialSlides: Slide[] = [
  evidenceSlide(
    mathLawOfSinesBlueprint.mainTitle,
    ['Subject: Mathematics', 'Grade Level: Grade 10', 'Term: First Term', 'Week focus: oblique triangles and ambiguity'],
    'Introduce the week as a reasoning arc: identify opposite pairs, use Law of Sines in ASA/AAS, decide SSA triangle counts, solve branches, and defend solution validity.',
    'HD precise trigonometry classroom diagram showing oblique triangles, opposite angle-side pairs, Law of Sines ratios, SSA height test, and branch validation.',
    'math-law-of-sines',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Label opposite angle-side pairs.', 'Set Law of Sines proportions.', 'Decide SSA triangle counts.', 'Defend all valid solutions.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${mathLawOfSinesBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD precise roadmap for Law of Sines with ASA/AAS ratio setup, SSA decision table, solution tree, and performance defense checklist.',
    'math-law-of-sines-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Trigonometry Problem Solvers',
    ['Draw and label before computing.', 'Find a known opposite pair.', 'Check calculator degree mode.', 'Reject answers only with evidence.'],
    'Set the classroom norm for the week. Learners should not compute first; they should identify the case, label opposite pairs, and check the geometry.',
    'HD precise trigonometry workspace with labeled oblique triangle, calculator degree mode reminder, ratio setup card, and branch check card.',
    'math-law-of-sines-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: MATH_LAW_OF_SINES_OBJECTIVES[0],
    studentGoals: ['Identify opposite angle-side pairs', 'Use Law of Sines for ASA and AAS', 'Justify answers with ratio setup and reasonableness checks'],
    question: 'Why does SOH-CAH-TOA fail without a right angle?',
    evidence: 'Labeled readiness triangle, annotated AAS walkthrough, solution table, solved card, repaired solution, and exit triangle',
    output: 'Labeled readiness triangle, annotated worked example, completed solution table, solved triangle card, repaired solution, and exit triangle',
  },
  2: {
    objective: MATH_LAW_OF_SINES_OBJECTIVES[1],
    studentGoals: ['Identify SSA data', 'Use height comparison before arcsin', 'Justify no, one, or two triangles'],
    question: 'How can the same SSA data form two triangles?',
    evidence: 'Ambiguity sketch, height-test model, decision table, branch sketch card, repaired branch note, and exit classification',
    output: 'Ambiguity sketch, annotated height-test model, completed decision table, branch sketch card, repaired branch note, and exit classification',
  },
  3: {
    objective: MATH_LAW_OF_SINES_OBJECTIVES[2],
    studentGoals: ['Branch possible angle measures', 'Calculate valid triangle measures', 'Reject invalid branches with angle-sum evidence'],
    question: 'Which branch remains a valid triangle?',
    evidence: 'Solution fork note, two-branch model, solution trees, shoreline context, invalid-branch repair, and exit SSA solution',
    output: 'Solution fork note, annotated two-branch model, completed solution trees, solved shoreline problem, invalid-branch repair, and exit SSA solution',
  },
  4: {
    objective: MATH_LAW_OF_SINES_OBJECTIVES[3],
    studentGoals: ['Classify ASA, AAS, and SSA cases', 'Solve all required measures', 'Defend whether no, one, or two solutions are valid'],
    question: 'Why identify the case before solving?',
    evidence: 'Case sort note, performance model, setup notes, completed task, peer review note, and transfer response',
    output: 'Case sort note, annotated performance model, approved setup notes, completed performance task, peer review note, and transfer response',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'Why Does SOH-CAH-TOA Fail Here?',
      ['Inspect the oblique triangle.', 'Mark whether a right angle is present.', 'Label one opposite angle-side pair.', 'Output: labeled readiness triangle.'],
      `Use this opener before the Law of Sines formula appears. Exact lesson-plan objective: ${structure.objective}. Ask: Which side is opposite angle A, and why is a new method needed?`,
      'HD precise oblique triangle warm-up showing no right angle, opposite angle-side labels, and learner readiness markings.',
      'opposite-pair-warm-up',
      'situation',
    ),
    2: evidenceSlide(
      'How Can the Same SSA Data Make Two Triangles?',
      ['Sketch the fixed angle.', 'Mark which side can swing.', 'Predict the possible triangle count.', 'Output: ambiguity sketch.'],
      `Use this opener before the height comparison. Exact lesson-plan objective: ${structure.objective}. Ask: What stays fixed, what swings, and how could two triangles appear?`,
      'HD precise SSA swinging-side sketch showing a fixed angle, fixed side, and two possible side positions.',
      'swinging-side-sketch',
      'situation',
    ),
    3: evidenceSlide(
      'How Do We Know Which Branch Remains Valid?',
      ['Write the calculator angle.', 'Write its supplement.', 'Place both on a solution fork.', 'Output: solution fork note.'],
      `Use this opener before solving branches. Exact lesson-plan objective: ${structure.objective}. Ask: Where will the angle-sum check happen, and why is one answer not enough?`,
      'HD precise SSA solution fork visual with calculator angle branch, supplement branch, and angle-sum checkpoint.',
      'solution-fork-preview',
      'situation',
    ),
    4: evidenceSlide(
      'Why Identify the Case Before Solving?',
      ['Sort each card as ASA, AAS, or SSA.', 'Mark if ambiguity is possible.', 'Choose a strategy card.', 'Output: case sort note.'],
      `Use this opener before the performance task. Exact lesson-plan objective: ${structure.objective}. Ask: What information is given, and does this card need a branch check?`,
      'HD precise case type sort with ASA, AAS, SSA, and not-enough-information cards.',
      'case-type-sort',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Opposite Pairs and Ratios',
      ['Opposite labels come first.', 'A known pair makes the ratio usable.', 'A missing angle may be solved first.', 'Reasonableness checks prevent blind answers.'],
      'Bridge from right-triangle trigonometry to oblique triangles. Ask learners why side-angle pairing matters before calculation.',
      'HD precise Law of Sines overview showing opposite pairs, a known pair, target pair, and reasonableness comparison.',
      'opposite-pair-ratio-goal',
      'overview',
    ),
    evidenceSlide(
      'Opposite Pair Warm-Up',
      ['1. Label angles A, B, and C.', '2. Trace the side opposite each angle.', '3. Mark whether any right angle exists.', '4. Explain why a new ratio is needed.'],
      'This is the connect-and-diagnose task. Check for reversed angle-side labels before any formula work begins.',
      'HD precise oblique triangle warm-up where learners trace side a opposite angle A, side b opposite angle B, and side c opposite angle C.',
      'opposite-pair-warm-up',
      'situation',
    ),
    evidenceSlide(
      'AAS Ratio Walkthrough',
      ['1. Find the missing angle first.', '2. Identify the known opposite pair.', '3. Match the target pair.', '4. Write the Law of Sines proportion.', '5. Check degree mode.'],
      'This is the worked example. Learners annotate the known pair, target pair, missing angle, proportion, and calculator mode.',
      'HD precise AAS triangle walkthrough with known opposite pair, missing angle step, Law of Sines proportion, and degree-mode reminder.',
      'aas-ratio-walkthrough',
      'model',
    ),
    evidenceSlide(
      'ASA-AAS Solution Table',
      ['1. Record the known opposite pair.', '2. Record the target pair.', '3. Write the proportion before calculating.', '4. Calculate the missing measure.', '5. Compare side size with angle size.'],
      'This is the main guided practice task. Output is a completed solution table with ratio setup, computation, and reasonableness check.',
      'HD precise ASA-AAS solution table with columns for known pair, target pair, proportion, computation, and reasonableness check.',
      'asa-aas-solution-table',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Solution Table',
      ['Known pair is correct.', 'Target pair matches the diagram.', 'Proportion is written before computation.', 'Answer fits side-angle size order.', 'Reasonableness sentence is included.'],
      'Make output criteria explicit before card exchange. Learners must show the setup and one check, not only the final number.',
      'HD precise solution table output checklist for Law of Sines ASA and AAS problems.',
      'solution-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Oblique Triangle Card Exchange',
      ['Annotate one card with opposite pairs.', 'Solve for one missing measure.', 'Exchange with another pair.', 'Defend the ratio used.', 'Revise if a pair was mismatched.'],
      'This is the peer-verification task. Ask pairs to verify labels before accepting a computation.',
      'HD precise oblique triangle card exchange with solve card, peer check card, and accepted ratio setup.',
      'oblique-triangle-card-exchange',
      'practice',
    ),
    evidenceSlide(
      'Ratio Setup Conference',
      ['Point to the known pair.', 'Point to the target pair.', 'Read the proportion aloud.', 'Ask if the answer size makes sense.'],
      'Use this discussion slide to slow down learners who calculate without interpreting the diagram.',
      'HD precise conference card showing known pair, target pair, proportion, and reasonableness prompt.',
      'ratio-setup-conference',
      'discussion',
    ),
    evidenceSlide(
      'Wrong-Pair Repair',
      ['Find the mismatched angle-side pair.', 'Rewrite the correct proportion.', 'Check calculator degree mode.', 'Solve the exit triangle.', 'Explain the prevention rule.'],
      'Use this misconception repair before the exit item. Ask: What was paired incorrectly, and what rule prevents that error?',
      'HD precise wrong-pair repair visual with flawed Law of Sines setup and corrected opposite-pair proportion.',
      'wrong-pair-repair',
      'misconception',
    ),
    evidenceSlide(
      'AAS Exit Triangle',
      ['Solve one AAS item independently.', 'Show the known pair and target pair.', 'Write one reasonableness check.', 'Submit the repaired rule with the answer.'],
      'Use this independent check. Look for correct opposite labels, valid proportion, degree mode, and side-angle reasonableness.',
      'HD precise AAS exit triangle card with answer fields for known pair, target pair, proportion, and reasonableness sentence.',
      'aas-exit-triangle',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: SSA Triangle Counts',
      ['SSA is not automatically one triangle.', 'Height comparison comes before arcsin.', 'The swinging side may miss, touch, or cross twice.', 'The count must be justified before solving.'],
      'Bridge from ASA/AAS to SSA ambiguity. Ask why a non-included angle can leave the side free to swing.',
      'HD precise SSA triangle-count overview showing a swinging side and no, one, or two possible intersections.',
      'ssa-triangle-count-goal',
      'overview',
    ),
    evidenceSlide(
      'Swinging Side Sketch',
      ['1. Draw the fixed angle.', '2. Draw the fixed side.', '3. Swing the loose side toward the base.', '4. Predict no, one, or two triangles.'],
      'This is the connect-and-diagnose task. Keep it visual before numbers appear so learners see where ambiguity comes from.',
      'HD precise swinging side sketch showing a fixed angle, a side swinging in an arc, and possible intersections with the base.',
      'swinging-side-sketch',
      'situation',
    ),
    evidenceSlide(
      'SSA Height Test Model',
      ['1. Identify side a, side b, and angle A.', '2. Calculate h = b sin A.', '3. Compare a with h and b.', '4. Record the triangle count before arcsin.'],
      'This is the worked example. Learners must state the triangle count before using inverse sine.',
      'HD precise SSA height test diagram with altitude h equals b sin A, side a comparison, and decision notes.',
      'ssa-height-test-model',
      'model',
    ),
    evidenceSlide(
      'Ambiguous Case Decision Table',
      ['1. Compute the height.', '2. Compare a with h and b.', '3. Classify no, one, or two triangles.', '4. Explain the decision in one sentence.'],
      'This is the main guided practice task. Output is a decision table for no-triangle, one-triangle, and two-triangle cases.',
      'HD precise ambiguous case decision table using h equals b sin A and comparisons a less than h, a equals h, h less than a less than b, and a at least b.',
      'ambiguous-case-decision-table',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Decision Table',
      ['Height value is shown.', 'Comparison uses the correct side.', 'Triangle count is stated before solving.', 'Explanation matches the sketch.', 'No branch is accepted without a check.'],
      'Make output criteria explicit before sketch checking. Learners should explain the count with height and sketch evidence.',
      'HD precise decision table output checklist with height comparison, triangle count, explanation, and branch check fields.',
      'decision-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Two-Branch Sketch Check',
      ['Draw both possible SSA triangles.', 'Calculate the acute angle.', 'Calculate the supplement angle.', 'Test each angle sum.', 'Label each valid branch.'],
      'This is the representation task. Another group checks one supplementary angle and one angle-sum test.',
      'HD precise two-branch SSA sketch showing acute and supplementary angle branches with angle-sum validation.',
      'two-branch-sketch-check',
      'practice',
    ),
    evidenceSlide(
      'Triangle Count Discussion',
      ['Which comparison decided the count?', 'What did the sketch show that numbers alone might hide?', 'When is the supplement possible?', 'What evidence changed your first answer?'],
      'Use this debrief to connect the sketch and table. Ask learners to name the evidence that changed or confirmed their prediction.',
      'HD precise discussion visual comparing SSA height test, swinging side sketch, and supplement-angle checkpoint.',
      'triangle-count-discussion',
      'discussion',
    ),
    evidenceSlide(
      'Missed Supplement Repair',
      ['Find the acute arcsin answer.', 'Compute 180 degrees minus that angle.', 'Test the new angle sum.', 'Reject or keep the branch with evidence.'],
      'Use this misconception repair before the exit classification. Ask: What angle did the solution miss, and when is the supplement valid?',
      'HD precise missed supplement repair visual showing calculator angle, supplement angle, and angle-sum validation.',
      'missed-supplement-repair',
      'misconception',
    ),
    evidenceSlide(
      'SSA Classification Exit',
      ['Classify one independent SSA case.', 'Show h = b sin A.', 'State the number of triangles.', 'Write the evidence sentence.'],
      'Use this independent check. Look for height computation, comparison, triangle count, and a clear justification before any full solving.',
      'HD precise SSA classification exit card with height computation, side comparison, triangle count, and explanation fields.',
      'ssa-classification-exit',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Branching Valid Solutions',
      ['Every possible angle branch must be tested.', 'Valid branches keep the angle sum below 180 degrees.', 'Invalid branches are rejected with evidence.', 'Final answers must report all valid triangles.'],
      'Bridge from classification to full SSA solving. Ask learners why recognizing two triangles is not enough without solving both branches.',
      'HD precise SSA branching overview showing calculator branch, supplement branch, angle-sum checks, and valid-results box.',
      'branching-valid-solutions-goal',
      'overview',
    ),
    evidenceSlide(
      'Solution Fork Preview',
      ['1. Write the calculator angle.', '2. Write the supplement angle.', '3. Draw a branch for each possibility.', '4. Place an angle-sum checkpoint on each branch.'],
      'This is the connect-and-diagnose task. Confirm both possible angles appear before solving sides.',
      'HD precise solution fork preview for SSA with calculator angle branch, supplement branch, and angle-sum checkpoint.',
      'solution-fork-preview',
      'situation',
    ),
    evidenceSlide(
      'Two-Branch Solution Model',
      ['1. Solve Branch 1 with the calculator angle.', '2. Solve Branch 2 with the supplement angle.', '3. Calculate remaining angles.', '4. Solve remaining sides.', '5. Verify each branch.'],
      'This is the worked model. Learners record both branches and explain why both must be tested.',
      'HD precise two-branch Law of Sines solution model showing branch 1 and branch 2 with angle and side computations.',
      'two-branch-solution-model',
      'model',
    ),
    evidenceSlide(
      'SSA Solution Tree Set',
      ['1. Classify the SSA case.', '2. Branch possible angle measures.', '3. Calculate valid triangle measures.', '4. Cross out invalid branches.', '5. Report all valid solutions.'],
      'This is the main guided practice task. Output is a set of solution trees for no-triangle, one-triangle, and two-triangle cases.',
      'HD precise SSA solution tree organizer with classification, branch angles, angle-sum checks, rejected branch, and valid final measures.',
      'ssa-solution-tree-set',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Solution Trees',
      ['Classification is shown first.', 'Each branch has an angle-sum check.', 'Rejected branches have a reason.', 'Valid measures are calculated.', 'Final answer states the number of triangles.'],
      'Make output criteria explicit before the context problem. Learners should not leave a branch untested.',
      'HD precise solution tree output checklist for SSA ambiguous cases with classification, branches, checks, and final measures.',
      'solution-trees-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Shoreline Position Problem',
      ['Draw the two possible positions.', 'Solve each valid branch.', 'Connect each branch to the context.', 'State whether one or two locations are possible.'],
      'This is the contextual representation task. Ask: What does each branch represent in the boat-location situation?',
      'HD precise shoreline triangulation visual with two possible boat positions from the same SSA measurements.',
      'shoreline-position-problem',
      'practice',
    ),
    evidenceSlide(
      'Branch Validity Conference',
      ['Point to the angle that starts each branch.', 'Show where the angle sum is checked.', 'Explain which branch remains valid.', 'Connect the decision to the drawing.'],
      'Use this debrief to make branch rejection mathematical, not a guess. Ask learners what evidence changed their first answer.',
      'HD precise branch validity conference visual with solution tree, angle-sum checkpoint, and sketch evidence.',
      'branch-validity-conference',
      'discussion',
    ),
    evidenceSlide(
      'Invalid Branch Audit',
      ['Find the branch with angle sum over 180 degrees.', 'Cross out only the invalid branch.', 'Keep any branch that passes all checks.', 'Explain the rejection with angle-sum evidence.'],
      'Use this misconception repair before the exit item. Ask: What made the branch invalid, and what valid triangles remain?',
      'HD precise invalid branch audit visual showing one rejected SSA branch and one valid branch with angle-sum evidence.',
      'invalid-branch-audit',
      'misconception',
    ),
    evidenceSlide(
      'SSA Solution Exit',
      ['Solve one independent SSA item.', 'Use a solution tree.', 'Reject invalid branches with evidence.', 'Report all valid measures.'],
      'Use this independent check. Look for complete branching, accurate Law of Sines setup, angle-sum rejection, and final solution count.',
      'HD precise SSA solution exit card with solution tree fields, Law of Sines setup, angle-sum check, and valid measures.',
      'ssa-solution-exit',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Case Type and Defense',
      ['Case type controls the strategy.', 'SSA needs an ambiguity check.', 'ASA and AAS need correct opposite pairs.', 'A complete solution defends the count.'],
      'Bridge from separate skills to performance. Ask why identifying the case before solving prevents wrong or incomplete answers.',
      'HD precise Law of Sines performance overview showing case type, ratio setup, branch check, final measures, and defense sentence.',
      'case-type-defense-goal',
      'overview',
    ),
    evidenceSlide(
      'Case Type Sort',
      ['1. Sort triangle cards into ASA, AAS, SSA, or not enough.', '2. Mark whether ambiguity is possible.', '3. Choose the matching strategy card.', '4. Explain one sort decision.'],
      'This is the connect-and-diagnose task. Check whether learners identify SSA before solving.',
      'HD precise case type sort visual with ASA, AAS, SSA, and not-enough-information columns.',
      'case-type-sort',
      'situation',
    ),
    evidenceSlide(
      'Performance Response Review',
      ['1. Annotate the diagram labels.', '2. Identify the case type.', '3. Check the Law of Sines setup.', '4. Locate the branch decision.', '5. Read the final meaning sentence.'],
      'This is the worked performance model. Learners annotate what makes the response complete.',
      'HD precise complete Law of Sines performance response with labeled diagram, proportion, branch check, and final answer in context.',
      'performance-response-review',
      'model',
    ),
    evidenceSlide(
      'Setup Checkpoint Pair',
      ['1. List the known opposite pair.', '2. Name the case type.', '3. Decide if a branch check is needed.', '4. Write the first proportion before solving.'],
      'This is the guided checkpoint. Teacher approves method and ambiguity decision before learners solve the full task.',
      'HD precise setup checkpoint pair table with known pair, case type, ambiguity check, and first Law of Sines proportion.',
      'setup-checkpoint-pair',
      'activity',
    ),
    evidenceSlide(
      'Law of Sines Performance Task',
      ['1. Label all given measures on the diagram.', '2. Classify the case type.', '3. Solve using correct proportions.', '4. Include all valid branches.', '5. Defend the number of solutions.'],
      'This is the main performance task. Output is a completed solution with diagram labels, proportions, valid measures, and ambiguity explanation.',
      'HD precise Law of Sines performance task visual with labeled oblique triangle, required output checklist, and ambiguity defense box.',
      'law-of-sines-performance-task',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Performance Task',
      ['Diagram labels are complete.', 'Case type is named first.', 'Proportions match opposite pairs.', 'All valid branches are shown.', 'Final answer explains no, one, or two solutions.'],
      'Make output criteria explicit before peer review. Learners should be able to defend the solution count, not only compute measures.',
      'HD precise performance task output checklist with diagram labels, case type, proportions, branch checks, and final defense.',
      'performance-task-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Ambiguity Peer Review',
      ['Check opposite-pair labels.', 'Check branch decisions.', 'Check calculator degree mode.', 'Check reasonableness.', 'Suggest one revision.'],
      'This is the peer-review task. Authors revise and answer why SSA needs extra checking.',
      'HD precise ambiguity peer review visual with reviewer checklist and author revision space.',
      'ambiguity-peer-review',
      'practice',
    ),
    evidenceSlide(
      'SSA Is Different From ASA and AAS',
      ['ASA and AAS use two angles.', 'SSA may swing into more than one triangle.', 'The supplement can matter.', 'The angle-sum test decides validity.'],
      'Use this misconception repair before transfer. Ask: Why can SSA be ambiguous while ASA and AAS are not?',
      'HD precise comparison visual showing ASA and AAS one-solution cards beside SSA ambiguous-case branch card.',
      'ssa-is-different-from-asa-and-aas',
      'misconception',
    ),
    evidenceSlide(
      'Transfer Defense Exit',
      ['Choose the correct strategy.', 'Set up the first ratio.', 'State whether ambiguity is possible.', 'Write one defense sentence.'],
      'Use this independent check. Look for case classification, setup, ambiguity decision, and concise mathematical defense.',
      'HD precise transfer defense exit card with strategy choice, first ratio, ambiguity decision, and defense sentence fields.',
      'transfer-defense-exit',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Law of Sines Evidence Path",
      ['Label opposite pairs.', 'Walk through an AAS ratio.', 'Complete the ASA-AAS table.', 'Exchange and defend a card.', 'Repair a wrong-pair solution.'],
      'Use this as the pacing guide. The core move is label first, set ratio second, calculate third, and check reasonableness last.',
      'HD precise activity path visual for opposite pair warm-up, AAS walkthrough, ASA-AAS solution table, card exchange, and wrong-pair repair.',
      'today-s-law-of-sines-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's SSA Decision Path",
      ['Sketch the swinging side.', 'Model the height test.', 'Complete the decision table.', 'Sketch two branches.', 'Repair a missed supplement.'],
      'Use this as the pacing guide. Learners decide no, one, or two triangles before solving any full SSA problem.',
      'HD precise activity path visual for swinging side sketch, SSA height test, ambiguous case decision table, two-branch sketch, and supplement repair.',
      'today-s-ssa-decision-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Branch Validation Path",
      ['Preview the solution fork.', 'Study a two-branch model.', 'Complete solution trees.', 'Solve a shoreline context.', 'Audit invalid branches.'],
      'Use this as the pacing guide. Learners must calculate, test, reject, and report branches systematically.',
      'HD precise activity path visual for solution fork, two-branch solution model, SSA solution tree, shoreline problem, and invalid branch audit.',
      'today-s-branch-validation-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Performance Defense Path",
      ['Sort case types.', 'Review a complete response.', 'Approve the setup.', 'Complete the performance task.', 'Peer review the ambiguity decision.'],
      'Use this as the pacing guide. Learners classify first, solve second, and defend the number of valid solutions last.',
      'HD precise activity path visual for case type sort, performance response review, setup checkpoint, Law of Sines performance task, and ambiguity peer review.',
      'today-s-performance-defense-path',
      'activity',
    ),
  ],
};

const getSessionSlides = (dayNumber: number): Slide[] => {
  const slides = sessionSlides[dayNumber];
  if (!slides) return [];
  const [goalSlide, ...remainingSlides] = slides;
  const detailSlides = sessionDetailSlides[dayNumber] || [];
  return [
    sessionOpenerSlide(dayNumber),
    ...detailSlides,
    goalSlide,
    ...remainingSlides,
  ];
};

const getCompletePresentationSlides = (): Slide[] => [
  ...initialSlides,
  ...mathLawOfSinesBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const mathLawOfSinesSignals = [
  'law of sines',
  'oblique triangles',
  'ambiguous cases',
  'asa',
  'aas',
  'ssa',
  'opposite angle-side',
  'opposite pairs',
  'height comparison',
  'h = b sin a',
  'arcsin',
  'supplementary angle',
  'solution tree',
  'solution fork',
  'branch',
  'angle sum',
  'shoreline',
  'case type',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableMathLawOfSinesLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasMathContext = /\bmathematics\b/.test(normalized) || /\bmath\b/.test(normalized);
  const hasGradeOrTopic = /\bgrade\s*10\b/.test(normalized)
    || normalized.includes('law of sines')
    || normalized.includes('oblique triangles')
    || normalized.includes('ambiguous cases');
  const score = mathLawOfSinesSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);
  return hasMathContext && hasGradeOrTopic && score >= 5;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...mathLawOfSinesBlueprint,
  smartObjectives: [...mathLawOfSinesBlueprint.smartObjectives],
  studentFacingObjectives: [...mathLawOfSinesBlueprint.studentFacingObjectives],
  days: mathLawOfSinesBlueprint.days.map((day) => ({ ...day })),
});

const mathMainActivityByDayNumber: Record<number, string> = {
  1: 'ASA-AAS Solution Table',
  2: 'Ambiguous Case Decision Table',
  3: 'SSA Solution Tree Set',
  4: 'Law of Sines Performance Task',
};

export const validateMathLawOfSinesK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: mathLawOfSinesBlueprint.subject,
    gradeLevel: mathLawOfSinesBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mathMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 96,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getMathLawOfSinesK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getMathLawOfSinesK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateMathLawOfSinesK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Math Law of Sines reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getMathLawOfSinesK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
