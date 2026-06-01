import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const MATH_WAGES_INCOME_TOPIC = 'Wages, Benefits, Deductions, and Net Income';
const MATH_WAGES_INCOME_COMPETENCY = 'Calculate weekly or monthly wages from an annual salary, wages from an hourly rate, including situations involving overtime and other allowances, and earnings based on commission or piecework. Solve problems involving salaries, wages, benefits, and deductions (tax computations, overtime pay, and gross and net incomes) using appropriate technology.';

const MATH_WAGES_INCOME_OBJECTIVES = [
  'By the end of Session 1, learners explain the purpose of wage, salary, benefit, deduction, commission, piecework, gross income, and net income computations, identify the quantities and units involved, and complete a worked example using correct notation, formulas, and reasonableness checks.',
  'By the end of Session 2, learners solve multi-step wage, salary, benefit, deduction, commission, piecework, gross income, and net income computations problems and justify the method chosen using source data, formulas, tables, graphs, or technology output.',
  'By the end of Session 3, learners analyze and compare alternative solutions for wage, salary, benefit, deduction, commission, piecework, gross income, and net income computations, then defend a recommendation using mathematical evidence and practical criteria.',
  'By the end of Session 4, learners create a portfolio-ready pay computation brief that solves a realistic payroll and first-job income planning problem and explains the mathematical decision with evidence, criteria, and reflection.',
];

const mathWagesIncomeBlueprint: LessonBlueprint = {
  mainTitle: MATH_WAGES_INCOME_TOPIC,
  planUnitLabel: 'Session',
  subject: 'General Mathematics',
  gradeLevel: 'Grade 11',
  quarter: 'First Term',
  learningCompetency: MATH_WAGES_INCOME_COMPETENCY,
  smartObjectives: [...MATH_WAGES_INCOME_OBJECTIVES],
  studentFacingObjectives: [...MATH_WAGES_INCOME_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Payroll Quantities, Units, and Meaning',
      focus: 'Learners define payroll quantities, compare salary and hourly earnings, and interpret gross and net income with units.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Multi-Step Payroll Method Choice',
      focus: 'Learners choose methods for wage, benefit, deduction, commission, and net-income tasks, then verify with technology or hand checks.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Payroll Recommendation and Criteria',
      focus: 'Learners compare alternative pay solutions and defend a recommendation using computations, criteria, and ethical source use.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Portfolio Pay Computation Brief',
      focus: 'Learners create, review, revise, and reflect on a portfolio-ready pay computation brief for a realistic audience.',
      generationStatus: 'pending',
    },
  ],
};

const mathMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'General Mathematics',
  topic: MATH_WAGES_INCOME_TOPIC,
  gradeLevel: 'Grade 11',
  gradeBand: '11-12',
  learningCompetency: MATH_WAGES_INCOME_COMPETENCY,
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
    mathWagesIncomeBlueprint.mainTitle,
    ['Subject: General Mathematics', 'Grade Level: Grade 11', 'Term: First Term', 'Week focus: payroll and first-job income planning'],
    'Introduce the week as a financial numeracy arc: define wage quantities, calculate gross and net income, verify methods, compare options, and build a portfolio-ready pay brief.',
    'HD precise payroll math overview with simulated pay slip, gross-to-net flow, spreadsheet verification, and recommendation brief.',
    'math-wages-income',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Read payroll data with units.', 'Compute gross and net income.', 'Verify and compare methods.', 'Build a portfolio pay brief.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${mathWagesIncomeBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD precise roadmap for Grade 11 payroll math showing wage quantities, method choice, criteria matrix, and portfolio brief.',
    'math-wages-income-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Financial Problem Solvers',
    ['Use simulated or cited data only.', 'Define every quantity and unit.', 'Check technology output by reasoning.', 'Explain what the answer means for a decision.'],
    'Set the classroom norm. Emphasize privacy-safe data, source citation, unit labels, and interpretation before portfolio work.',
    'HD precise financial math workspace with simulated data card, calculator, spreadsheet check, unit checklist, and source note.',
    'math-wages-income-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: MATH_WAGES_INCOME_OBJECTIVES[0],
    studentGoals: ['Identify payroll quantities and units', 'Compute salary, hourly pay, overtime, gross income, and net income', 'Interpret answers with reasonableness checks'],
    question: 'What does a paycheck number actually mean?',
    evidence: 'Diagnostic mark-up, annotated worked example, paired solution, two-column solution, corrected error, and independent check',
    output: 'Diagnostic mark-up, annotated worked example, paired solution, two-column solution, corrected error, and payroll meaning exit',
  },
  2: {
    objective: MATH_WAGES_INCOME_OBJECTIVES[1],
    studentGoals: ['Choose the method that fits the payroll context', 'Solve multi-step wage and deduction tasks', 'Verify with source data, formulas, tables, or technology output'],
    question: 'Which method fits this payroll problem?',
    evidence: 'Retrieval item, method-choice check, decision board, spreadsheet verification note, sample answer check, and independent check',
    output: 'Retrieval item, completed decision board, technology verification note, peer check, sample answer evaluation, and net weekly income exit',
  },
  3: {
    objective: MATH_WAGES_INCOME_OBJECTIVES[2],
    studentGoals: ['Compare alternative pay solutions', 'Use mathematical evidence and practical criteria', 'Defend a recommendation clearly and ethically'],
    question: 'Which pay option should we recommend?',
    evidence: 'Decision vote, comparison model, criteria matrix, draft recommendation, peer feedback, revised paragraph, and highlighted evidence',
    output: 'Criteria matrix, draft recommendation, peer feedback, revised paragraph, and highlighted evidence exit',
  },
  4: {
    objective: MATH_WAGES_INCOME_OBJECTIVES[3],
    studentGoals: ['Plan a portfolio-ready pay brief', 'Show computation and verification evidence', 'Revise for accuracy, source use, privacy, and audience clarity'],
    question: 'What makes a pay computation brief ready for an audience?',
    evidence: 'Portfolio readiness plan, strong-output review, pay computation brief, peer review, revision log, and reflection',
    output: 'Portfolio readiness plan, completed pay computation brief, peer review, revision log, and reflection exit',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'What Does This Paycheck Number Mean?',
      ['Mark the given quantities.', 'Circle the unknown quantity.', 'Write the unit beside each number.', 'Output: diagnostic payroll mark-up.'],
      `Use this opener before formulas. Exact lesson-plan objective: ${structure.objective}. Ask learners what decision the payroll scenario is trying to support.`,
      'HD precise diagnostic payroll scenario card with simulated values, quantity labels, unknown marker, unit tags, and decision prompt.',
      'diagnostic-payroll-mark-up',
      'situation',
    ),
    2: evidenceSlide(
      'What Method Fits This Payroll Problem?',
      ['Solve one quick retrieval item.', 'Choose a method for the next item.', 'Reject one tempting wrong method.', 'Output: method-choice note.'],
      `Use this opener before multi-step practice. Exact lesson-plan objective: ${structure.objective}. Ask why a formula that worked yesterday may not fit a new condition.`,
      'HD precise method-choice check with hourly, commission, and rejection cards for payroll computations.',
      'method-choice-check',
      'situation',
    ),
    3: evidenceSlide(
      'What Pay Option Should We Recommend?',
      ['Vote for an option first.', 'List the evidence needed.', 'List one practical criterion.', 'Output: decision evidence note.'],
      `Use this opener before comparison work. Exact lesson-plan objective: ${structure.objective}. Ask what evidence is missing before a recommendation is fair.`,
      'HD precise decision prompt comparing two simulated pay options with evidence and criteria notes.',
      'decision-prompt',
      'situation',
    ),
    4: evidenceSlide(
      'What Makes a Pay Brief Portfolio-Ready?',
      ['Name the payroll problem.', 'List the source or simulated data.', 'Choose and calculate with the representation.', 'Output: portfolio readiness plan.'],
      `Use this opener before production. Exact lesson-plan objective: ${structure.objective}. Ask what a reader needs to trust and use the pay computation brief.`,
      'HD precise portfolio readiness checklist for pay computation brief with source data, formula, product, criteria, and privacy note.',
      'portfolio-readiness-check',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Quantities, Units, and Meaning',
      ['A payroll answer needs a unit.', 'Gross income is before deductions.', 'Net income is take-home pay.', 'Reasonableness checks protect decisions.'],
      'Bridge from familiar money computations to payroll meaning. Ask learners which numbers describe earnings, deductions, and decisions.',
      'HD precise payroll math overview showing input quantities, gross income, deductions, net income, and decision meaning.',
      'quantities-units-meaning-goal',
      'overview',
    ),
    evidenceSlide(
      'Diagnostic Payroll Mark-Up',
      ['1. Mark each given quantity.', '2. Circle the unknown quantity.', '3. Write the unit beside each number.', '4. Classify your first response as confident, unsure, or guessing.'],
      'This is the readiness task. Look for learners who skip units, confuse gross and net income, or miss the decision being made.',
      'HD precise diagnostic payroll mark-up with simulated pay slip values, unknown quantity, units, and confidence check.',
      'diagnostic-payroll-mark-up',
      'situation',
    ),
    evidenceSlide(
      'Salary and Hourly Offer Worked Example',
      ['1. Define the variables.', '2. Convert annual salary to weekly pay.', '3. Calculate regular and overtime pay.', '4. Compare the results with units.', '5. Interpret the decision.'],
      'This is the worked example. Model the annual salary conversion, hourly computation, overtime multiplier, unit labels, and interpretation sentence.',
      'HD precise worked example comparing annual salary and hourly offer with overtime, formula lines, and calculator verification.',
      'salary-hourly-worked-example',
      'model',
    ),
    evidenceSlide(
      'Guided Payroll Pair Practice',
      ['One learner explains the method aloud.', 'One learner checks units and labels.', 'Both verify the formula choice.', 'Both decide if the result is realistic.'],
      'This is the guided practice task. Require both partners to explain one step and check one possible error before moving on.',
      'HD precise paired payroll practice visual with simulated pay slip, unit checklist, formula check, and realism check.',
      'guided-payroll-pair-practice',
      'practice',
    ),
    evidenceSlide(
      'Two-Column Solution',
      ['1. Compute each payroll step on the left.', '2. Explain what the step means on the right.', '3. Add one source-data note or assumption.', '4. Write the decision implication.'],
      'This is the main representation task. Output is a computation-and-interpretation solution that can be checked later in a portfolio.',
      'HD precise two-column payroll solution with computation column, interpretation column, source-data note, and decision implication.',
      'two-column-solution',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Two-Column Solution',
      ['Variables and units are shown.', 'Formula matches the context.', 'Gross and net income are separated.', 'Source or assumption is noted.', 'Reasonableness sentence is included.'],
      'Make criteria explicit before error analysis. Learners should see that a correct number without meaning is not enough.',
      'HD precise two-column solution output checklist with variables, units, formula, gross-net distinction, source note, and reasonableness.',
      'two-column-solution-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Gross and Net Income Error Repair',
      ['Find the first incorrect step.', 'Explain why the sequence matters.', 'Rewrite the correct gross-to-net path.', 'Solve the short exit item.', 'Include one reasonableness sentence.'],
      'Use this misconception repair before the exit item. Ask why subtracting deductions before adding earnings changes the decision.',
      'HD precise gross and net income error repair showing flawed sequence and corrected gross-to-net sequence.',
      'gross-net-income-error-repair',
      'misconception',
    ),
    evidenceSlide(
      'Reasonableness Conference',
      ['Point to the unit.', 'Compare net income with gross income.', 'Check if overtime was multiplied correctly.', 'Explain what the answer means for planning.'],
      'Use this debrief to connect calculation to interpretation. Ask: What evidence would make you revise your first answer?',
      'HD precise payroll reasonableness conference visual with unit check, gross-versus-net check, overtime multiplier, and planning sentence.',
      'reasonableness-conference',
      'discussion',
    ),
    evidenceSlide(
      'Payroll Meaning Exit',
      ['Solve one short payroll item.', 'Show the formula or method used.', 'Write the unit in the final answer.', 'Begin your justification with: The answer is reasonable because...'],
      'Use this independent check. Look for correct method, accurate computation, unit use, clear interpretation, and reasonableness justification.',
      'HD precise payroll meaning exit card with formula line, unit box, final answer box, and reasonableness sentence frame.',
      'payroll-meaning-exit',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Method Choice and Verification',
      ['Read the context before choosing a formula.', 'Reject methods that ignore a condition.', 'Use technology as verification.', 'Explain the decision impact.'],
      'Bridge from guided computation to multi-step decisions. Ask learners what information changes the formula or sequence.',
      'HD precise method choice and verification overview with formula cards, spreadsheet check, calculator, and decision note.',
      'method-choice-verification-goal',
      'overview',
    ),
    evidenceSlide(
      'Method-Choice Check',
      ['1. Solve one retrieval item.', '2. Choose the formula for a second item.', '3. Reject one common wrong method.', '4. Explain the context clue.'],
      'This is the connect-and-diagnose task. Confirm learners can choose a method instead of copying the previous formula.',
      'HD precise method-choice check with hourly, commission, gross-net, and wrong-method cards.',
      'method-choice-check',
      'situation',
    ),
    evidenceSlide(
      'Gross-to-Net Sequence Model',
      ['1. Add base pay, overtime, allowance, and commission.', '2. Name the gross income.', '3. Subtract deductions after gross income.', '4. Name the net income.'],
      'This is the worked sequence model. Emphasize the order: earnings and benefits first, deductions second, net income last.',
      'HD precise gross-to-net payroll sequence showing base pay, overtime, allowance, gross income, deductions, and net income.',
      'gross-to-net-sequence-model',
      'model',
    ),
    evidenceSlide(
      'Math Decision Board',
      ['1. Record known data and unknowns.', '2. Choose the formula or representation.', '3. Compute with units.', '4. Interpret the result.', '5. Note the source or assumption.'],
      'This is the main group task. Output is a completed decision board plus one checkpoint where the answer could go wrong.',
      'HD precise Math Decision Board for payroll with known data, unknown, formula, computation, interpretation, and source note.',
      'math-decision-board',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Decision Board',
      ['Known data is not mixed with unknowns.', 'Formula matches the payroll condition.', 'Units are visible in the computation.', 'Source or simulated data is labeled.', 'Decision impact is explained.'],
      'Make output criteria explicit before technology verification. Learners should know what makes the board defensible.',
      'HD precise decision board output checklist with known data, formula, units, source label, and interpretation fields.',
      'decision-board-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Spreadsheet Verification',
      ['Enter the same data into a spreadsheet or calculator.', 'Compare the technology result with your hand-check.', 'Explain any rounding difference.', 'Record both results.'],
      'Use technology as verification, not as a black box. Learners must compare the computed output with estimation or inverse reasoning.',
      'HD precise spreadsheet verification visual with payroll table, calculator result, hand-check note, and rounding explanation.',
      'spreadsheet-verification',
      'practice',
    ),
    evidenceSlide(
      'Sample Answer Check',
      ['Compare two sample answers.', 'Check the computation sequence.', 'Check the unit and representation.', 'Choose the answer that should guide a decision.'],
      'This is the error-check task. Ask learners why a plausible answer can still be unsafe for a real pay decision.',
      'HD precise sample answer comparison with accurate payroll answer and plausible wrong answer.',
      'sample-answer-check',
      'discussion',
    ),
    evidenceSlide(
      'Technology Is Not a Black Box',
      ['Name the formula behind the output.', 'Check one value by estimation.', 'Check one unit or rounding choice.', 'Explain why the output can be trusted.'],
      'Use this debrief to surface hidden issues: assumptions, formula choice, graph interpretation, or rounding.',
      'HD precise technology verification visual with spreadsheet formula cell, calculator output, estimate check, and trust explanation.',
      'technology-not-black-box',
      'misconception',
    ),
    evidenceSlide(
      'Net Weekly Income Exit',
      ['Compute net weekly income.', 'Include hourly pay, overtime, allowance, and one deduction.', 'Show the representation used.', 'Explain why the method fits the problem.'],
      'Use this independent check. Look for defensible method choice, accurate computation, result check, and decision impact.',
      'HD precise net weekly income exit card with hourly pay, overtime, allowance, deduction, representation, and method note.',
      'net-weekly-income-exit',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Compare, Evaluate, Defend',
      ['A recommendation needs a claim.', 'The claim needs computation evidence.', 'Practical criteria affect usefulness.', 'Ethical source use protects privacy.'],
      'Bridge from computing an answer to defending a recommendation. Ask learners what makes an answer useful, fair, efficient, or safe.',
      'HD precise recommendation evidence overview with claim, computation evidence, practical criteria, source note, and privacy reminder.',
      'compare-evaluate-defend-goal',
      'overview',
    ),
    evidenceSlide(
      'Decision Prompt',
      ['1. Vote for Option A or Option B.', '2. List the mathematical evidence needed.', '3. List one practical criterion.', '4. State what source data must be cited.'],
      'This is the connect-and-diagnose task. Keep the first vote provisional until learners compare evidence and criteria.',
      'HD precise decision prompt comparing two pay options with evidence needs, practical criteria, and source-data note.',
      'decision-prompt',
      'situation',
    ),
    evidenceSlide(
      'Comparison Model',
      ['1. Check assumptions.', '2. Check units and rates.', '3. Compare formula structures.', '4. Identify which evidence supports the recommendation.'],
      'This is the worked comparison. Model how to compare two solution paths rather than only two final numbers.',
      'HD precise comparison model table for payroll options showing assumptions, units, rates, formula structure, and decision evidence.',
      'comparison-model',
      'model',
    ),
    evidenceSlide(
      'Criteria Matrix',
      ['1. Compare mathematical correctness.', '2. Compare cost or net-income result.', '3. Compare feasibility or fairness.', '4. Rate evidence quality.', '5. Write the recommendation claim.'],
      'This is the main comparison task. Output is a criteria matrix with a recommendation that cites mathematical evidence and practical criteria.',
      'HD precise criteria matrix for payroll recommendation with mathematical correctness, net income, feasibility, fairness, and evidence quality.',
      'criteria-matrix',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Criteria Matrix',
      ['Each option has computed evidence.', 'Criteria are visible and relevant.', 'Recommendation follows from the matrix.', 'Assumptions are named.', 'Source or simulated data is cited.'],
      'Make output criteria explicit before drafting. Learners should connect every recommendation sentence to evidence.',
      'HD precise criteria matrix output checklist with computed evidence, criteria, assumptions, source note, and recommendation claim.',
      'criteria-matrix-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Recommendation Draft',
      ['Write one claim sentence.', 'Add computation evidence.', 'Interpret what the number means.', 'Name one assumption or limitation.', 'Attach a table, formula line, or spreadsheet output.'],
      'This is the representation task. Learners draft a short recommendation using claim, evidence, and interpretation.',
      'HD precise recommendation draft with claim panel, computation evidence panel, source note, and table/formula attachment marker.',
      'recommendation-draft',
      'practice',
    ),
    evidenceSlide(
      'Peer Feedback and Revision',
      ['Identify one unclear assumption.', 'Identify one computation or unit risk.', 'Mark one weak justification sentence.', 'Revise one paragraph with stronger evidence.'],
      'This is the peer feedback task. Require feedback to name a specific assumption, computation risk, and sentence revision.',
      'HD precise peer feedback and revision visual with checklist for assumption, computation risk, weak sentence, source issue, and revision log.',
      'peer-feedback-revision',
      'discussion',
    ),
    evidenceSlide(
      'Recommendation Conference',
      ['Point to the data behind your claim.', 'Point to the formula or table behind your result.', 'Explain the practical criterion used.', 'Name what could change the recommendation.'],
      'Use this debrief to move learners beyond preference. Ask which evidence changed or strengthened their first vote.',
      'HD precise recommendation conference visual with data cell, formula line, practical criterion, and what-if condition.',
      'recommendation-conference',
      'generalization',
    ),
    evidenceSlide(
      'Evidence Highlight Exit',
      ['Revise one recommendation paragraph.', 'Highlight the exact data used.', 'Highlight the formula or table feature used.', 'Submit the final recommendation sentence.'],
      'Use this independent check. Look for revised reasoning, highlighted evidence, and a recommendation supported by mathematics and criteria.',
      'HD precise evidence highlight exit card with revised paragraph, data highlight, formula highlight, and final recommendation sentence.',
      'evidence-highlight-exit',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Accurate, Clear, Ethical Brief',
      ['A strong brief names the problem.', 'Computation evidence must be visible.', 'Assumptions and sources must be clear.', 'The recommendation must fit the audience.'],
      'Bridge from recommendation writing to portfolio production. Ask what a family member, classmate, supervisor, or community client would need to trust the brief.',
      'HD precise portfolio brief overview with problem statement, computation evidence, source note, privacy note, and audience recommendation.',
      'accurate-clear-ethical-brief-goal',
      'overview',
    ),
    evidenceSlide(
      'Portfolio Readiness Check',
      ['1. List the problem.', '2. List source data or simulated data.', '3. Choose formula, table, graph, or diagram.', '4. Add one citation or privacy note.'],
      'This is the connect-and-diagnose task. Approve the problem, data, representation, and ethical note before production.',
      'HD precise portfolio readiness check table with problem, source data, formula or representation, product, and ethical note.',
      'portfolio-readiness-check',
      'situation',
    ),
    evidenceSlide(
      'Weak and Strong Output Review',
      ['1. Compare the weak and strong output.', '2. Name what makes the strong output useful.', '3. Identify one missing assumption.', '4. Identify one missing check.'],
      'This is the worked quality model. Learners identify how strong output names the problem, shows computation, checks reasonableness, and gives a usable recommendation.',
      'HD precise weak and strong pay computation output comparison with missing units, assumptions, reasonableness, and clear recommendation.',
      'weak-strong-output-review',
      'model',
    ),
    evidenceSlide(
      'Pay Computation Brief',
      ['1. State the realistic payroll problem.', '2. Calculate with at least one formula, table, graph, or diagram.', '3. Add a technology or hand-check note.', '4. Write a recommendation for a real audience.'],
      'This is the main portfolio task. Output is a pay computation brief with visible computation, source-data note, reasonableness check, and audience-ready recommendation.',
      'HD precise pay computation brief template with problem, data, computation, verification, recommendation, and ethical note sections.',
      'pay-computation-brief',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Pay Computation Brief',
      ['Problem and audience are clear.', 'Source or simulated data is labeled.', 'Computation is accurate and unit-labeled.', 'Verification note is included.', 'Recommendation uses evidence.'],
      'Make criteria explicit before independent portfolio work. Learners should know what makes the brief ready for review.',
      'HD precise pay computation brief output checklist with problem, audience, source data, computation, verification, and recommendation criteria.',
      'pay-computation-brief-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Independent Portfolio Work',
      ['Complete the brief independently.', 'Include one formula, table, graph, or diagram.', 'Include one technology or hand-check note.', 'Include one source-data or privacy note.', 'Write for a real audience.'],
      'This is the production work period. Struggling learners may use a structured template; advanced learners can add a what-if condition.',
      'HD precise independent portfolio work visual with spreadsheet payroll table, brief checklist, verification note, and recommendation panel.',
      'independent-portfolio-work',
      'practice',
    ),
    evidenceSlide(
      'Rubric Peer Review',
      ['Check mathematical accuracy.', 'Check units and assumptions.', 'Check source data and privacy.', 'Check clarity for the audience.', 'Suggest one revision.'],
      'This is the peer review task. Partners use the rubric to check accuracy, units, assumptions, source data, privacy, and clarity.',
      'HD precise rubric peer review visual with accuracy, units, assumptions, source privacy, clarity, and revision columns.',
      'rubric-peer-review',
      'discussion',
    ),
    evidenceSlide(
      'Privacy and Source Check',
      ['Use simulated or teacher-approved data.', 'Do not use real classmates personal income.', 'Cite any adapted source data.', 'Declare digital assistance when used.'],
      'Use this ethical check before submission. Ask learners how privacy-safe data and citation make the portfolio brief more responsible.',
      'HD precise privacy and source check visual with simulated data label, citation strip, privacy reminder, and digital assistance note.',
      'privacy-source-check',
      'misconception',
    ),
    evidenceSlide(
      'Portfolio Reflection Exit',
      ['What evidence supports my answer?', 'What assumption could change the result?', 'What revision improved my brief?', 'How could this math help in a real decision?'],
      'Use this independent reflection. Look for evidence-based reflection, assumption awareness, revision record, and transfer to career or community decisions.',
      'HD precise portfolio reflection exit card with evidence, assumption, revision, and real-decision transfer prompts.',
      'portfolio-reflection-exit',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Payroll Meaning Path",
      ['Mark the scenario data.', 'Study salary and hourly pay.', 'Solve with a partner check.', 'Calculate and explain a two-column solution.', 'Repair a gross-net error.'],
      'Use this as the pacing guide. Keep learners defining quantities and units before using payroll formulas.',
      'HD precise activity path for payroll mark-up, salary-hourly worked example, pair practice, two-column solution, and gross-net repair.',
      'today-s-payroll-meaning-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Multi-Step Method Path",
      ['Choose a fitting method.', 'Model gross-to-net sequence.', 'Complete the decision board.', 'Verify with technology.', 'Evaluate sample answers.'],
      'Use this as the pacing guide. Learners must explain why the chosen formula or representation fits the context.',
      'HD precise activity path for method-choice check, gross-net sequence, Math Decision Board, spreadsheet verification, and sample answer check.',
      'today-s-multi-step-method-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Recommendation Evidence Path",
      ['Vote on a recommendation.', 'Study a comparison model.', 'Compare options with a criteria matrix.', 'Draft the recommendation.', 'Revise with peer feedback.'],
      'Use this as the pacing guide. Learners move from preference to evidence-based recommendation.',
      'HD precise activity path for decision prompt, comparison model, criteria matrix, recommendation draft, and peer feedback revision.',
      'today-s-recommendation-evidence-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Portfolio Brief Path",
      ['Plan the portfolio output.', 'Compare weak and strong output.', 'Build the pay computation brief.', 'Review with the rubric.', 'Reflect on evidence and assumptions.'],
      'Use this as the pacing guide. The brief should combine accurate computation, verification, source ethics, and audience-ready explanation.',
      'HD precise activity path for portfolio readiness, weak-strong output review, pay computation brief, rubric peer review, and reflection exit.',
      'today-s-portfolio-brief-path',
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
  ...mathWagesIncomeBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const mathWagesIncomeSignals = [
  'wage',
  'salary',
  'benefit',
  'deduction',
  'commission',
  'piecework',
  'gross income',
  'net income',
  'overtime',
  'allowance',
  'tax',
  'payroll',
  'first-job income',
  'source data',
  'pay computation brief',
  'portfolio',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableMathWagesIncomeLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasMathContext = /\bmathematics\b/.test(normalized)
    || /\bgeneral mathematics\b/.test(normalized)
    || /\bmath\b/.test(normalized);
  const hasGradeOrTopic = /\bgrade\s*11\b/.test(normalized)
    || normalized.includes('wages, benefits, deductions')
    || normalized.includes('gross income')
    || normalized.includes('net income');
  const score = mathWagesIncomeSignals.reduce((count, signal) => (
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
  ...mathWagesIncomeBlueprint,
  smartObjectives: [...mathWagesIncomeBlueprint.smartObjectives],
  studentFacingObjectives: [...mathWagesIncomeBlueprint.studentFacingObjectives],
  days: mathWagesIncomeBlueprint.days.map((day) => ({ ...day })),
});

const mathMainActivityByDayNumber: Record<number, string> = {
  1: 'Two-Column Solution',
  2: 'Math Decision Board',
  3: 'Criteria Matrix',
  4: 'Pay Computation Brief',
};

export const validateMathWagesIncomeK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: mathWagesIncomeBlueprint.subject,
    gradeLevel: mathWagesIncomeBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mathMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 110,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getMathWagesIncomeK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getMathWagesIncomeK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateMathWagesIncomeK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Math wages income reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getMathWagesIncomeK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
