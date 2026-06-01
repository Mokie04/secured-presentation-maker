import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const MATH_STATISTICS_EXPRESSIONS_TOPIC = 'Measures of Central Tendency, Conclusions, and Algebraic Expressions';
const MATH_STATISTICS_EXPRESSIONS_COMPETENCY = 'Determine measures of central tendency of ungrouped data. Draw conclusions from statistical data using the measures of central tendency. Model real-life situations using algebraic expressions.';

const MATH_STATISTICS_EXPRESSIONS_OBJECTIVES = [
  'By the end of Session 1, learners determine the mean, median, and mode of ungrouped data, compare the measures, and explain what each measure suggests about a data set.',
  'By the end of Session 2, learners identify the question being asked by a data set, choose an appropriate measure of central tendency, and justify a conclusion using computed evidence.',
  'By the end of Session 3, learners identify changing and fixed quantities, model real-life situations using algebraic expressions, and justify how variables, constants, operations, and units match the context.',
  'By the end of Session 4, learners determine measures of central tendency, defend a conclusion from data, and model a related real-life pattern using an algebraic expression.',
];

const mathStatisticsExpressionsBlueprint: LessonBlueprint = {
  mainTitle: 'Measures of Central Tendency, Conclusions, and Algebraic Expressions',
  planUnitLabel: 'Session',
  subject: 'Mathematics',
  gradeLevel: 'Grade 8',
  quarter: 'First Term',
  learningCompetency: MATH_STATISTICS_EXPRESSIONS_COMPETENCY,
  smartObjectives: [...MATH_STATISTICS_EXPRESSIONS_OBJECTIVES],
  studentFacingObjectives: [...MATH_STATISTICS_EXPRESSIONS_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Mean, Median, Mode, and Typical Values',
      focus: 'Learners compute mean, median, and mode of ungrouped data, then explain what each measure suggests.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Evidence-Based Statistical Conclusions',
      focus: 'Learners choose an appropriate measure of central tendency and defend a conclusion using computed evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Modeling Contexts With Algebraic Expressions',
      focus: 'Learners identify changing and fixed quantities, then write and justify algebraic expressions from real contexts.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Statistics and Algebra Mini-Report',
      focus: 'Learners combine a data-based conclusion with an algebraic expression model for a related situation.',
      generationStatus: 'pending',
    },
  ],
};

const mathMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Mathematics',
  topic: MATH_STATISTICS_EXPRESSIONS_TOPIC,
  gradeLevel: 'Grade 8',
  gradeBand: '7-10',
  learningCompetency: MATH_STATISTICS_EXPRESSIONS_COMPETENCY,
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
    mathStatisticsExpressionsBlueprint.mainTitle,
    ['Subject: Mathematics', 'Grade Level: Grade 8', 'Term: First Term', 'Week focus: data evidence and expression models'],
    'Introduce the week as a reasoning arc: summarize ungrouped data, use computed evidence to defend conclusions, then model real situations with algebraic expressions.',
    'HD precise classroom math visual with quiz-score cards, mean median mode table, conclusion card, and algebraic expression model.',
    'math-statistics-expressions',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Compute mean, median, and mode.', 'Choose evidence for a conclusion.', 'Model contexts with expressions.', 'Defend both data and algebra choices.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${mathStatisticsExpressionsBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD precise classroom math visual showing data cards, outlier comparison, expression model, and mini-report checklist.',
    'math-statistics-expressions-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Data Thinkers',
    ['Read the question before computing.', 'Organize the data before deciding.', 'Explain what the number means.', 'Define every variable in context.'],
    'Set the classroom norm. Learners must connect calculations to meaning and connect variables to real quantities before writing expressions.',
    'HD precise data and algebra workspace with ordered data strip, computation table, conclusion frame, and variable-definition card.',
    'math-statistics-expressions-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: MATH_STATISTICS_EXPRESSIONS_OBJECTIVES[0],
    studentGoals: ['Organize ungrouped data', 'Compute mean, median, and mode', 'Explain what each measure suggests'],
    question: 'What makes a score typical?',
    evidence: 'Quiz-score lists, ordered data strip, computation table, outlier comparison, and interpretation sentence',
    output: 'Prediction note, ordered data strip, computation table, measure-choice claim, and three-measure exit response',
  },
  2: {
    objective: MATH_STATISTICS_EXPRESSIONS_OBJECTIVES[1],
    studentGoals: ['Read the data question', 'Choose a defensible measure', 'Justify a conclusion with computed evidence'],
    question: 'Can a correct average mislead?',
    evidence: 'Outlier data set, context-purpose table, conclusion evidence card, critique card, and supported conclusion',
    output: 'Measure-choice note, context-purpose table, conclusion evidence card, corrected claim, and supported conclusion exit',
  },
  3: {
    objective: MATH_STATISTICS_EXPRESSIONS_OBJECTIVES[2],
    studentGoals: ['Identify changing and fixed quantities', 'Write algebraic expressions', 'Justify variables, operations, constants, and units'],
    question: 'What should the letter represent?',
    evidence: 'Marked context strip, annotated expression model, table-rule-expression match, error repair, and exit expression',
    output: 'Marked context strip, annotated model, representation table, corrected expression note, and context-to-expression exit',
  },
  4: {
    objective: MATH_STATISTICS_EXPRESSIONS_OBJECTIVES[3],
    studentGoals: ['Choose the correct mathematical tool', 'Defend one data conclusion', 'Model a related pattern using an expression'],
    question: 'Which tool fits the situation?',
    evidence: 'Tool-choice sort, study-minutes data table, daily target model, mini-report, peer marks, and mixed tool exit',
    output: 'Tool-choice note, data summary table, algebraic expression model, mini-report with peer marks, and mixed tool exit task',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'What Makes a Score Typical?',
      ['Inspect two quiz-score lists.', 'Mark your first typical value.', 'Ask what calculation would be fair.', 'Output: prediction note.'],
      `Use this opener before computation. Exact lesson-plan objective: ${structure.objective}. Ask: What looks typical, and what evidence would make the comparison fair?`,
      'HD precise typical score prediction visual with two quiz-score lists, first prediction lines, and evidence question prompts.',
      'typical-score-prediction',
      'situation',
    ),
    2: evidenceSlide(
      'Can a Correct Average Mislead?',
      ['Look for an unusual value.', 'Name the data question.', 'Choose a measure to trust.', 'Output: measure-choice note.'],
      `Use this opener before the context table. Exact lesson-plan objective: ${structure.objective}. Ask: Which value is unusual, and what does typical mean here?`,
      'HD precise average trust test visual with allowance data, highlighted outlier, and mean median mode comparison prompts.',
      'average-trust-test',
      'situation',
    ),
    3: evidenceSlide(
      'What Should the Letter Represent?',
      ['Underline what changes.', 'Circle what stays fixed.', 'Name the unit.', 'Output: marked context strip.'],
      `Use this opener before symbols appear. Exact lesson-plan objective: ${structure.objective}. Ask: What changes, what stays fixed, and what unit is being counted?`,
      'HD precise quantity hunt visual with fare, notebook, and savings contexts marked for changing and fixed quantities.',
      'quantity-hunt',
      'situation',
    ),
    4: evidenceSlide(
      'What Tool Fits the Situation?',
      ['Decide if the prompt uses data.', 'Decide if it uses a changing rule.', 'Choose statistics or algebra.', 'Output: tool-choice note.'],
      `Use this opener before the mini-report task. Exact lesson-plan objective: ${structure.objective}. Ask: Is the task asking about a data set or a changing relationship?`,
      'HD precise statistics-or-algebra sort visual with summarize data column and model relationship column.',
      'statistics-algebra-sort',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Mean, Median, Mode',
      ['Mean balances all values.', 'Median uses the ordered middle.', 'Mode uses repeated values.', 'Interpretation turns numbers into meaning.'],
      'Bridge from prediction to computation. Ask learners what each measure pays attention to before they compute the worked set.',
      'HD precise overview visual with quiz-score data, mean median mode table, and interpretation sentence frame.',
      'mean-median-mode-goal',
      'overview',
    ),
    evidenceSlide(
      'Typical Score Prediction',
      ['1. Inspect Class A and Class B scores.', '2. Mark the value that looks typical.', '3. Circle any unusual value.', '4. Write one evidence question.'],
      'This is the connect-and-diagnose task. Keep learners from computing immediately; they should notice data features first.',
      'HD precise typical score prediction visual with two quiz-score lists and evidence question lines.',
      'typical-score-prediction',
      'situation',
    ),
    evidenceSlide(
      'Ordered Data Strip',
      ['1. Copy the data values.', '2. Arrange them from least to greatest.', '3. Mark repeated values.', '4. Mark the middle position.'],
      'This prepares learners for median and mode. Teacher checks ordering before learners compute any measure.',
      'HD precise ordered data strip visual with unordered values, ordered strip, repeated values, and middle position marker.',
      'ordered-data-strip',
      'activity',
    ),
    evidenceSlide(
      'Mean-Median-Mode Worked Set',
      ['1. Calculate the mean with every value.', '2. Record the ordered middle for median.', '3. Count repeats for mode.', '4. Compare the three measures.', '5. Explain what each measure means.'],
      'This is the main guided practice task. Teacher models one set, then learners complete a second set and annotate the meaning of each measure.',
      'HD precise mean median mode worked set visual with data cards, formula line, median note, mode note, and meaning table.',
      'mean-median-mode-worked-set',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Computation Table',
      ['Data is ordered correctly.', 'Mean setup uses every value.', 'Median position is marked.', 'Mode decision cites repeated values.', 'Each measure has a meaning note.'],
      'Make the output criteria explicit before interpretation. Learners should show both computation and meaning, not just final numbers.',
      'HD precise computation table visual with mean median mode columns and meaning notes beside a data set.',
      'computation-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Calculation Checks',
      ['Organizer orders the data.', 'Adder checks the total.', 'Middle finder checks the median.', 'Repeat checker checks the mode.', 'Explainer writes the meaning.'],
      'Recommended pacing: 5 minutes prediction, 10 minutes ordered strip, 15 minutes worked set, 10 minutes outlier match, 10 minutes exit response.',
      'HD precise classroom computation station with data cards, ordered strip, calculator, computation table, and role cards.',
      'team-roles-calculation-checks',
      'activity',
    ),
    evidenceSlide(
      'Outlier Measure Match',
      ['Compare mean, median, and mode.', 'Find which measure changed most.', 'Choose the best typical value.', 'Support the choice with two values.'],
      'This is the synthesis and interpretation task. Ask: Which measure stayed closer to the group of data, and why does the outlier matter?',
      'HD precise outlier measure match visual with data set, highlighted outlier, number line, mean median mode values, and claim prompt.',
      'outlier-measure-match',
      'discussion',
    ),
    evidenceSlide(
      'What Each Measure Really Says',
      ['Mean describes a balance point.', 'Median protects the middle position.', 'Mode reports what appears most.', 'The best measure depends on the question.'],
      'Use this debrief to connect procedures to interpretation. Ask learners to explain when each measure would be useful or weak.',
      'HD precise mean median mode interpretation visual with balance point, middle marker, repeated-value count, and question-first reminder.',
      'what-each-measure-says',
      'discussion',
    ),
    evidenceSlide(
      'Three Measures Exit',
      ['Compute all three measures.', 'Check if each answer is reasonable.', 'Choose one measure to interpret.', 'Write one meaning sentence.'],
      'Use this independent check. Review errors by type: ordering, arithmetic, median position, mode decision, or interpretation.',
      'HD precise three measures exit visual with five-value data set, blank computation table, and interpretation sentence frame.',
      'three-measures-exit',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Supported Conclusions',
      ['A conclusion answers a question.', 'A measure is evidence only when it fits.', 'Outliers can change the story.', 'Honest claims mention limits.'],
      'Bridge from computing measures to choosing evidence. Ask learners why the mean is not automatically the best measure.',
      'HD precise evidence conclusion visual with outlier data, measure choices, claim frame, and limitation warning.',
      'supported-conclusions-goal',
      'overview',
    ),
    evidenceSlide(
      'Average Trust Test',
      ['1. Inspect the data set.', '2. Mark the unusual value.', '3. Name the question being asked.', '4. Choose the measure you trust first.'],
      'This is the connect-and-diagnose task. Learners should identify the outlier and the meaning of typical before computing.',
      'HD precise average trust test visual with allowance data, highlighted outlier, and mean median mode trust prompt.',
      'average-trust-test',
      'situation',
    ),
    evidenceSlide(
      'Question Before Measure',
      ['1. Read each context card.', '2. Underline the question.', '3. Name the data feature that matters.', '4. Choose mean, median, or mode with a reason.'],
      'This builds the habit of reading purpose before selecting a measure. Ask: Is the context asking for typical, common, or balanced value?',
      'HD precise question before measure visual with allowance, travel time, and test score context cards and purpose table.',
      'question-before-measure',
      'activity',
    ),
    evidenceSlide(
      'Evidence-Based Conclusion Set',
      ['1. Compute the useful measures.', '2. Choose the strongest evidence.', '3. Explain why one measure is weaker.', '4. Write a claim with because.', '5. Add one limitation.'],
      'This is the main group task. Output is a conclusion evidence card that includes claim, measure, value, reason, and limitation.',
      'HD precise evidence-based conclusion card visual with data values, computed measures, and claim measure value because limitation fields.',
      'evidence-based-conclusion-set',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Conclusion Evidence Card',
      ['Claim answers the question.', 'Measure is computed accurately.', 'Value is written with context.', 'Because statement explains the choice.', 'Limitation warns about weak evidence.'],
      'Make the output criteria explicit before critique. Learners must include both the computed measure and the reason it fits the question.',
      'HD precise conclusion evidence card visual with completed structure for claim, measure, value, because, and limitation.',
      'conclusion-evidence-card-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Evidence Checks',
      ['Reader states the question.', 'Calculator checks the measure.', 'Evidence chooser selects the value.', 'Skeptic asks what could mislead.', 'Writer revises the claim.'],
      'Recommended pacing: 5 minutes average trust test, 10 minutes context-purpose table, 15 minutes conclusion set, 10 minutes clinic, 10 minutes exit.',
      'HD precise statistics group station with context cards, calculator, conclusion card, outlier marker, and role chips.',
      'team-roles-evidence-checks',
      'activity',
    ),
    evidenceSlide(
      'Misleading Average Clinic',
      ['Find what is misleading.', 'Identify the ignored data feature.', 'Choose a better measure if needed.', 'Revise the claim with evidence.'],
      'This is the claim critique task. Ask: What evidence is missing, and how can the claim become more honest?',
      'HD precise misleading average clinic visual with flawed average claim, highlighted outlier, and repair checklist.',
      'misleading-average-clinic',
      'discussion',
    ),
    evidenceSlide(
      'Honest Data Conclusion Conference',
      ['State the question again.', 'Point to the measure used.', 'Explain why it fits.', 'Name one thing readers should remember.'],
      'Use this debrief before independent work. Learners should hear that accurate computation can still support a weak claim if the measure does not fit.',
      'HD precise honest data conclusion visual with claim card, measure value, evidence arrow, and limitation note.',
      'honest-data-conclusion-conference',
      'model',
    ),
    evidenceSlide(
      'Supported Conclusion Exit',
      ['Compute one needed measure.', 'Write one supported conclusion.', 'Use the measure and value.', 'Add one because statement.'],
      'Use this independent check. Look for claim, measure, value, and because statement; note whether learners mention the outlier when relevant.',
      'HD precise supported conclusion exit visual with small data table and claim measure value because sentence frame.',
      'supported-conclusion-exit',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Context to Expression',
      ['A variable represents a changing quantity.', 'A constant represents a fixed quantity.', 'Operations must match the story.', 'Units help test the expression.'],
      'Bridge from reading contexts to symbolic expressions. Ask learners why defining the variable must happen before writing the expression.',
      'HD precise algebra expression overview with context strip, variable card, constant card, operation label, and unit check.',
      'context-to-expression-goal',
      'overview',
    ),
    evidenceSlide(
      'Quantity Hunt',
      ['1. Read each short situation.', '2. Underline the changing quantity.', '3. Circle the fixed quantity.', '4. Name the unit being counted or measured.'],
      'This is the connect-and-diagnose task. Do not allow symbols yet; learners first identify quantities and units.',
      'HD precise quantity hunt visual with fare, notebook, and savings contexts marked for changing quantities, fixed quantities, and units.',
      'quantity-hunt',
      'situation',
    ),
    evidenceSlide(
      'Notebook Cost Expression',
      ['Name what n represents.', 'Match 35 to each notebook.', 'Match 20 to the fixed fee.', 'Test the expression with n = 3.'],
      'This is the guided model. Teacher models total cost of n notebooks at 35 pesos each plus 20 pesos delivery fee.',
      'HD precise notebook cost expression visual with 35n plus 20, variable definition, constant label, unit, and substitution check.',
      'notebook-cost-expression',
      'model',
    ),
    evidenceSlide(
      'Table-Rule-Expression Match',
      ['1. Record the input-output table.', '2. Write the verbal rule.', '3. Construct the algebraic expression.', '4. Test one row using the expression.', '5. Explain any revision.'],
      'This is the main paired practice task. Output is a representation table showing the same relationship as table, rule, and expression.',
      'HD precise table rule expression match visual with input-output table, verbal rule card, expression card, and row check.',
      'table-rule-expression-match',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Representation Table',
      ['Table values follow the same rule.', 'Variable is defined in words.', 'Expression matches the context.', 'One row is tested by substitution.', 'Units are included in the explanation.'],
      'Make the output criteria explicit before error analysis. Learners should check that all representations describe the same relationship.',
      'HD precise representation table visual with table, rule, expression, substitution check, and unit reminder.',
      'representation-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Meaning Checks',
      ['Reader names the context.', 'Quantity finder marks change and fixed amounts.', 'Expression writer builds the model.', 'Tester substitutes one value.', 'Explainer checks units.'],
      'Recommended pacing: 5 minutes quantity hunt, 12 minutes guided model, 13 minutes representation practice, 10 minutes repair, 10 minutes exit.',
      'HD precise algebra group station with context cards, representation table, expression card, unit labels, and role chips.',
      'team-roles-meaning-checks',
      'activity',
    ),
    evidenceSlide(
      'Expression Match Repair',
      ['Define the variable first.', 'Find which number repeats.', 'Find which amount is fixed.', 'Choose the expression that matches the story.', 'Revise the mismatch.'],
      'This is the error-analysis task. Ask: What story would the wrong expression match, and why?',
      'HD precise expression match repair visual comparing 5k plus 20 and 5 plus 20k for the same fare story.',
      'expression-match-repair',
      'discussion',
    ),
    evidenceSlide(
      'Variable Definition Conference',
      ['Read the variable sentence aloud.', 'Point to the repeated amount.', 'Point to the fixed amount.', 'Explain why the operation fits.'],
      'Use this debrief before the independent check. Learners should explain the role of every symbol, not only state the expression.',
      'HD precise variable definition conference visual with expression model, variable sentence, repeated amount label, and fixed amount label.',
      'variable-definition-conference',
      'model',
    ),
    evidenceSlide(
      'Context-to-Expression Exit',
      ['Write one expression for a new context.', 'Define the variable in a sentence.', 'Name the operation used.', 'Test the expression with one value.'],
      'Use this independent check. Look for correct operation, clear variable definition, context units, and a valid substitution test.',
      'HD precise context-to-expression exit visual with new context card, expression blank, variable sentence, and test value line.',
      'context-to-expression-exit',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Statistics and Algebra Together',
      ['Statistics summarizes a data set.', 'Algebra models a changing rule.', 'A report can use both tools.', 'Each claim needs evidence.'],
      'Bridge from Sessions 1 to 3. Ask learners to separate a data-summary question from a changing-relationship question.',
      'HD precise statistics and algebra overview with data summary table, conclusion card, expression model, and report checklist.',
      'statistics-algebra-goal',
      'overview',
    ),
    evidenceSlide(
      'Statistics-or-Algebra Sort',
      ['1. Read each prompt.', '2. Decide if it uses a data set.', '3. Decide if it uses a changing rule.', '4. Choose the correct tool and explain why.'],
      'This is the connect-and-diagnose task. Clarify confusing vocabulary before the mini-report work begins.',
      'HD precise statistics-or-algebra sort visual with summarize data column, model relationship column, and tool-choice note.',
      'statistics-or-algebra-sort',
      'situation',
    ),
    evidenceSlide(
      'Study-Minutes Data Investigation',
      ['1. Order the study-minute data.', '2. Compute the needed measures.', '3. Choose the best measure for one conclusion.', '4. Name one visible limitation.'],
      'This is the guided statistics task. Teacher verifies ordered data and one computed measure before groups write conclusions.',
      'HD precise study-minutes data investigation visual with data values, outlier, computation table, and conclusion prompts.',
      'study-minutes-data-investigation',
      'activity',
    ),
    evidenceSlide(
      'Daily Target Model',
      ['Define d as number of days.', 'Use the fixed daily target.', 'Write the expression.', 'Test the expression with d = 5.'],
      'This is the algebra link. Groups model total study minutes over d days at a fixed daily target and test the expression.',
      'HD precise daily target model visual with context card, expression 30d, variable definition, unit, and substitution check.',
      'daily-target-model',
      'model',
    ),
    evidenceSlide(
      'Data-and-Expression Brief',
      ['1. Record the data summary.', '2. Explain one conclusion with a measure.', '3. Construct the related expression.', '4. Define the variable.', '5. Add one warning or limitation.'],
      'This is the main synthesis task. Output is a mini-report with data summary, conclusion, expression, variable definition, and limitation.',
      'HD precise data-and-expression brief visual with mini-report template and peer-review checklist.',
      'data-and-expression-brief',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Mini-Report',
      ['Statistical claim uses a measure.', 'Measure value is written correctly.', 'Expression matches the context.', 'Variable is defined clearly.', 'Limitation is honest.'],
      'Make the output criteria explicit before peer review. The report must show both statistical evidence and algebraic meaning.',
      'HD precise mini-report output visual with data summary, supported conclusion, expression model, variable definition, and limitation lines.',
      'mini-report-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Peer Review and Revision',
      ['Check one statistical claim.', 'Check one computed value.', 'Check one expression model.', 'Check the variable definition.', 'Suggest one revision.'],
      'This is the peer-review task. Learners should revise mathematical clarity, not only grammar or neatness.',
      'HD precise peer review marks visual with mini-report checklist, measure check, expression check, and revision mark.',
      'peer-review-and-revision',
      'discussion',
    ),
    evidenceSlide(
      'Average Warning Discussion',
      ['Averages can hide unusual values.', 'Expressions can hide unclear variables.', 'Readers need evidence and definitions.', 'Honest work names its limits.'],
      'Use this debrief to connect data honesty with algebraic precision. Ask: What would make a reader trust your report?',
      'HD precise average warning discussion visual with misleading average card, expression model, and limitation warning.',
      'average-warning-discussion',
      'discussion',
    ),
    evidenceSlide(
      'Mixed Tool Exit',
      ['Answer one data conclusion item.', 'Answer one expression item.', 'Name which tool each item uses.', 'Give evidence for both answers.'],
      'Use this independent check. Look for tool choice, computed evidence, expression structure, and variable definition.',
      'HD precise mixed tool exit visual with one data table prompt, one expression context prompt, and evidence lines.',
      'mixed-tool-exit',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Three-Measure Evidence Path",
      ['Predict a typical score.', 'Order the data.', 'Compute mean, median, and mode.', 'Match measures to an outlier case.', 'Write an interpretation exit.'],
      'Use this as the pacing guide. Keep learners moving from first impression to organized data to computed interpretation.',
      'HD precise activity path visual with typical score prediction, ordered data strip, worked set, outlier match, and exit response.',
      'today-s-three-measure-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Supported Conclusion Path",
      ['Test trust in an average.', 'Read the question before the measure.', 'Build a conclusion evidence card.', 'Repair a misleading claim.', 'Write a supported exit conclusion.'],
      'Use this as the pacing guide. Make sure every conclusion names the question, measure, value, reason, and limitation.',
      'HD precise activity path visual with average trust test, question-before-measure table, evidence card, clinic, and exit conclusion.',
      'today-s-supported-conclusion-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Expression Modeling Path",
      ['Mark changing and fixed quantities.', 'Study a notebook cost model.', 'Match table, rule, and expression.', 'Repair a mismatched expression.', 'Write an exit expression.'],
      'Use this as the pacing guide. Require a variable definition before accepting any expression.',
      'HD precise activity path visual with quantity hunt, notebook cost expression, table-rule-expression match, repair, and exit expression.',
      'today-s-expression-modeling-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Mixed Tool Evidence Path",
      ['Sort statistics and algebra prompts.', 'Summarize study-minute data.', 'Model daily study target.', 'Write a synthesis brief.', 'Complete a mixed tool exit.'],
      'Use this as the pacing guide. Keep the two tools distinct: statistics summarizes data and algebra models a changing rule.',
      'HD precise activity path visual with statistics-or-algebra sort, study data table, daily target expression, mini-report, and exit task.',
      'today-s-mixed-tool-evidence-path',
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
  ...mathStatisticsExpressionsBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const mathStatisticsExpressionsSignals = [
  'measures of central tendency',
  'mean',
  'median',
  'mode',
  'ungrouped data',
  'statistical data',
  'draw conclusions',
  'computed evidence',
  'outlier',
  'algebraic expressions',
  'real-life situations',
  'variable',
  'constant',
  'changing quantities',
  'fixed quantities',
  'table-rule-expression',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableMathStatisticsExpressionsLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasMathContext = /\bmathematics\b/.test(normalized) || /\bmath\b/.test(normalized);
  const hasGradeOrTopic = /\bgrade\s*8\b/.test(normalized)
    || normalized.includes('measures of central tendency')
    || normalized.includes('algebraic expressions');
  const score = mathStatisticsExpressionsSignals.reduce((count, signal) => (
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
  ...mathStatisticsExpressionsBlueprint,
  smartObjectives: [...mathStatisticsExpressionsBlueprint.smartObjectives],
  studentFacingObjectives: [...mathStatisticsExpressionsBlueprint.studentFacingObjectives],
  days: mathStatisticsExpressionsBlueprint.days.map((day) => ({ ...day })),
});

const mathMainActivityByDayNumber: Record<number, string> = {
  1: 'Mean-Median-Mode Worked Set',
  2: 'Evidence-Based Conclusion Set',
  3: 'Table-Rule-Expression Match',
  4: 'Data-and-Expression Brief',
};

export const validateMathStatisticsExpressionsK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: mathStatisticsExpressionsBlueprint.subject,
    gradeLevel: mathStatisticsExpressionsBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mathMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 92,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getMathStatisticsExpressionsK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getMathStatisticsExpressionsK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateMathStatisticsExpressionsK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Math statistics and expressions reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getMathStatisticsExpressionsK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
