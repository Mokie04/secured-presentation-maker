import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const CHEMISTRY_REACTIONS_TOPIC = 'Reaction Indicators, Acids, Bases, and Salts';
const CHEMISTRY_REACTIONS_COMPETENCY = 'Describe indicators of chemical reaction such as color change, precipitate formation, gas/odor release, and temperature change. Identify common acids, bases, and salts using different indicators.';

const CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify observable indicators of chemical reaction using safe household micro-reactions and distinguish reaction evidence from ordinary physical change.',
  'By the end of Session 2, learners use red-cabbage indicator, litmus, or pH paper to classify common safe samples as acidic, basic, or near neutral and justify the classification with color evidence.',
  'By the end of Session 3, learners explain acid-base interaction and salt formation at an introductory level using indicator evidence from controlled neutralization micro-tests.',
  'By the end of Session 4, learners classify teacher-prepared unknown samples as acid, base, neutral, or salt solution using indicator evidence, safety procedure, and a concise CER explanation.',
];

const chemistryReactionsBlueprint: LessonBlueprint = {
  mainTitle: 'Reaction Indicators, Acids, Bases, and Salts',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 10',
  quarter: 'First Term',
  learningCompetency: CHEMISTRY_REACTIONS_COMPETENCY,
  smartObjectives: [...CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Chemical Reaction Evidence',
      focus: 'Learners use safe micro-reaction evidence to distinguish chemical reaction indicators from physical changes.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Acids, Bases, and Indicator Evidence',
      focus: 'Learners classify common safe samples as acidic, basic, or near neutral using indicator color evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Neutralization Evidence',
      focus: 'Learners use drop-by-drop indicator evidence to explain acid-base interaction and introductory salt formation.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Unknown Sample Classification',
      focus: 'Learners classify safe unknown samples using procedure, indicator evidence, confidence, and CER reasoning.',
      generationStatus: 'pending',
    },
  ],
};

const chemistryMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Science',
  topic: CHEMISTRY_REACTIONS_TOPIC,
  gradeLevel: 'Grade 10',
  gradeBand: '7-10',
  learningCompetency: CHEMISTRY_REACTIONS_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'photorealistic',
): ImageSemanticMetadata => ({
  ...chemistryMetadata,
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
  style: ImageSemanticMetadata['style'] = 'photorealistic',
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
): Slide => slide(title, content, speakerNotes, imagePrompt, slideTemplate, visualRole, 'photorealistic', undefined, 'evidence');

const initialSlides: Slide[] = [
  evidenceSlide(
    chemistryReactionsBlueprint.mainTitle,
    ['Subject: Science', 'Grade Level: Grade 10', 'Term: First Term'],
    'Introduce the week as one coherent chemistry evidence arc: reaction indicators, acid-base indicator evidence, neutralization, and safe unknown classification.',
    'A high-resolution realistic classroom chemistry setup with safe household reaction materials, red cabbage indicator, pH strips, droppers, goggles, blank evidence tables, and coded sample cups on a lab table, no readable text.',
    'chemistry-reactions',
    'overview',
  ),
  slide(
    'Learning Roadmap',
    [
      'Use evidence to identify reaction indicators.',
      'Classify acids and bases with indicators.',
      'Explain neutralization from color evidence.',
      'Defend unknown-sample claims with CER.',
    ],
    `Use this as the student-facing roadmap. Exact lesson-plan objectives: ${chemistryReactionsBlueprint.studentFacingObjectives.join(' | ')}`,
    '',
  ),
  slide(
    'How We Will Work Like Chemists',
    ['Record evidence before claims.', 'Use tiny safe quantities.', 'Avoid tasting or careless smelling.', 'State confidence when evidence is limited.'],
    'Set the inquiry norm for the whole sequence. Safety and validity are part of the science, not a separate reminder.',
    '',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES[0],
    studentGoals: ['Separate physical change from reaction evidence', 'Name specific indicators', 'Use cautious evidence language'],
    question: 'How can observable evidence suggest a chemical reaction?',
    evidence: 'Melting ice, sugar dissolving, vinegar plus baking soda, curdling milk, rust, and temperature evidence',
    output: 'Micro-reaction evidence table, reaction evidence card, and evidence exit sort',
  },
  2: {
    objective: CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES[1],
    studentGoals: ['Use indicator color evidence', 'Classify safe samples', 'Reject taste, smell, or brand-name guessing'],
    question: 'How can an indicator help classify acids, bases, and near-neutral samples safely?',
    evidence: 'Red-cabbage indicator, litmus, or pH paper color changes on safe samples',
    output: 'Color-trail data table, unknown sample evidence trail, and indicator safety exit',
  },
  3: {
    objective: CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES[2],
    studentGoals: ['Track drop-by-drop color change', 'Explain changed acid-base properties', 'Avoid saying substances disappear'],
    question: 'What evidence shows acid-base interaction during neutralization?',
    evidence: 'Vinegar indicator color, baking-soda drops, color sequence, and possible gas evidence',
    output: 'Drop-count color sequence table, before-during-after model, and interpretation slip',
  },
  4: {
    objective: CHEMISTRY_REACTIONS_LEARNING_OBJECTIVES[3],
    studentGoals: ['Follow a safe unknown-test procedure', 'Compare indicator color to a key', 'Write a concise evidence-based CER'],
    question: 'How can we classify an unknown sample without guessing?',
    evidence: 'Coded safe samples, indicator color, key match, confidence rating, and procedure notes',
    output: 'Unknown-sample investigation table, CER brief, and individual mastery case',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: slide(
      'How Can Evidence Show a Chemical Reaction?',
      [
        'Look for what changed.',
        'Separate evidence from a guess.',
        'Use more than one clue when possible.',
        'Output: evidence table and exit sort.',
      ],
      `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
      'A high-resolution realistic classroom chemistry station with melting ice, sugar dissolving, vinegar and baking soda bubbles, curdling milk, rust photo, goggles, and a blank evidence table, no readable text.',
      'reaction-indicators',
      'situation',
      'photorealistic',
      [
        { id: 'evidence', text: 'evidence?', x: 32, y: 50, fontSize: 20 },
        { id: 'claim', text: 'claim later', x: 72, y: 54, fontSize: 20 },
      ],
      'evidence',
    ),
    2: slide(
      'How Can an Indicator Replace Guessing?',
      [
        'Predict, but mark it as a guess.',
        'Record the indicator color first.',
        'Match color to the key.',
        'Output: color-trail table and safety exit.',
      ],
      `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
      'A high-resolution realistic classroom chemistry indicator setup with red-cabbage indicator, pH strips, vinegar, citrus, baking soda solution, soap solution, salt water, clean water, and a blank color-trail table, no readable text.',
      'acid-base-indicators',
      'situation',
      'photorealistic',
      [
        { id: 'color', text: 'color evidence', x: 32, y: 47, fontSize: 20 },
        { id: 'safe', text: 'no tasting', x: 73, y: 53, fontSize: 20 },
      ],
      'evidence',
    ),
    3: slide(
      'What Changes Drop by Drop?',
      [
        'Start with acid indicator color.',
        'Add base slowly.',
        'Record each color stage.',
        'Output: sequence table and model.',
      ],
      `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
      'A high-resolution realistic classroom chemistry neutralization micro-test with vinegar indicator cup, baking soda solution dropper, color sequence cups, safety tray, goggles, and blank sequence table, no readable text.',
      'neutralization-evidence',
      'situation',
      'photorealistic',
      [
        { id: 'drops', text: 'drop by drop', x: 34, y: 51, fontSize: 20 },
        { id: 'color-path', text: 'color path', x: 70, y: 43, fontSize: 20 },
      ],
      'evidence',
    ),
    4: slide(
      'How Do Scientists Classify an Unknown Safely?',
      [
        'Record the code before testing.',
        'Use clean droppers or strips.',
        'Compare evidence to the key.',
        'Output: investigation table and CER.',
      ],
      `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
      'A high-resolution realistic classroom chemistry unknown-sample station with coded safe sample cups, red-cabbage indicator, pH strips, separate droppers, color key, confidence scale, and CER sheet, no readable text.',
      'unknown-sample-classification',
      'situation',
      'photorealistic',
      [
        { id: 'code', text: 'sample code', x: 30, y: 49, fontSize: 20 },
        { id: 'key', text: 'key match', x: 72, y: 46, fontSize: 20 },
      ],
      'evidence',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Reaction Indicators',
      ['Change: what is different?', 'Evidence: what can you observe?', 'Claim: chemical, physical, or unsure?', 'Caution: one sign alone may mislead.'],
      'Bridge from everyday changes. Ask learners to name one change without labeling it yet. Ask: Which observations are visible, and which claims need more evidence?',
      'A high-resolution realistic classroom chemistry comparison board with melting ice, sugar dissolving, bubbling cup, curdled milk cup, rust photo, and blank claim cards, no readable text.',
      'reaction-indicators',
      'overview',
    ),
    evidenceSlide(
      'Change Evidence Warm-Up',
      ['1. Mark chemical, physical, or unsure.', '2. Circle the visible evidence.', '3. Write one reason.', '4. Name which case is still uncertain.'],
      'This is the connect-and-diagnose task. Use melting ice, sugar dissolving, and vinegar with baking soda. Ask: What changed? What evidence can you see? Why is one sign alone not enough?',
      'A high-resolution realistic classroom chemistry warm-up with melting ice, sugar dissolving in water, vinegar plus baking soda bubbles, blank classification slips, and goggles, no readable text.',
      'reaction-indicators',
      'situation',
    ),
    evidenceSlide(
      'Micro-Reaction Evidence Table',
      ['1. Record before-and-after observations.', '2. Name the possible indicator.', '3. Decide chemical, physical, or unsure.', '4. Use cautious evidence language.', '5. Check each row before moving on.'],
      'This slide starts the main activity. Use teacher demonstration, low-resource stations, or photo cards for vinegar plus baking soda, milk plus vinegar, rust, or warm/cool pack evidence. Output: evidence table.',
      'A high-resolution realistic classroom chemistry micro-reaction evidence table station with vinegar baking soda bubbles, curdled milk, rust photo card, warm-cool evidence card, and blank table, no readable text.',
      'reaction-indicators',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Reaction Evidence Table',
      ['Each row has before-and-after evidence.', 'Each row names a possible indicator.', 'Each claim is chemical, physical, or unsure.', 'Each reason avoids automatic-proof language.'],
      'Make the output criteria explicit before learners continue. The product must show evidence and caution, not only a label.',
      'A high-resolution realistic classroom photo of a blank reaction evidence table beside bubbling, curdling, rust, and dissolving evidence cards, no readable text.',
      'reaction-indicators',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Micro-Reactions',
      ['Observer: record only visible evidence.', 'Safety monitor: check goggles and tiny amounts.', 'Vocabulary keeper: choose the indicator word.', 'Claim speaker: defend cautious wording.', 'No tasting or unsafe smelling.'],
      'Recommended pacing: 5 minutes warm-up, 15 minutes evidence table, 10 minutes ladder discussion, 12 minutes evidence card, 8 minutes exit sort.',
      'A high-resolution realistic classroom chemistry table with role cards, goggles, droppers, tiny cups, safety tray, blank evidence table, and exit slips, no readable text.',
      'reaction-indicators-roles',
      'activity',
    ),
    evidenceSlide(
      'Evidence Ladder Discussion',
      ['Place evidence from weaker to stronger.', 'Ask which evidence could mislead.', 'Combine clues before deciding.', 'Question: what evidence changed your first answer?'],
      'This is the make-meaning task. Build a class ladder from weak evidence to stronger evidence. Ask: Why is dissolving sugar not enough proof of a new substance?',
      'A high-resolution realistic classroom chemistry evidence ladder with safe example cards for melting, dissolving, bubbling, curdling, temperature change, and rust, no readable text.',
      'reaction-indicators',
      'discussion',
    ),
    evidenceSlide(
      'Reaction Evidence Card',
      ['Name the starting materials.', 'Write the observed evidence.', 'State the claim cautiously.', 'Add one reason to be careful.'],
      'This is the guided modeling task. Teacher models one card, then pairs create a card for one case. Output: one completed reaction evidence card.',
      'A high-resolution realistic classroom chemistry evidence-card station with blank cards, bubbling cup, rust photo, curdled milk sample, pencil, and goggles, no readable text.',
      'reaction-indicators',
      'model',
    ),
    evidenceSlide(
      'Reaction Evidence Caution',
      ['Bubbling can be strong evidence.', 'Dissolving may be physical change.', 'Color change needs context.', 'Use before-and-after evidence.'],
      'Use this misconception repair before the exit sort. Ask: Which sign is being overused? Which example needs more than one clue?',
      'A high-resolution realistic classroom comparison of evidence cards: bubbling reaction, sugar dissolving, color-change card, and before-after observation cards, no readable text.',
      'reaction-indicators',
      'misconception',
    ),
    evidenceSlide(
      'Evidence Exit Sort',
      ['Classify four new examples.', 'Circle the strongest indicator.', 'Explain why one example is uncertain.', 'Finish: evidence suggests ___ because ___.'],
      'Use this independent check. Responses must cite a specific indicator and must not treat all bubbling, dissolving, or color change as automatic proof.',
      'A high-resolution realistic classroom chemistry exit-sort setup with four blank example cards, reaction evidence icons, claim cards, pencil, and small safe samples, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Indicator Classification',
      ['Prediction is not evidence yet.', 'Indicator color comes first.', 'The color key supports the claim.', 'Safety rules protect people and data.'],
      'Bridge from Session 1 by asking which evidence needed a tool instead of smell, taste, or brand-name guessing.',
      'A high-resolution realistic classroom acid-base indicator station with red-cabbage indicator, pH strips, safe sample cups, color key, blank table, and goggles, no readable text.',
      'acid-base-indicators',
      'overview',
    ),
    evidenceSlide(
      'Safe Indicator Prediction',
      ['1. Predict acid, base, or near neutral.', '2. Mark prediction as guess or evidence.', '3. Name the unsafe test to avoid.', '4. Wait for color evidence before claiming.'],
      'This is the connect-and-diagnose task. Use vinegar, calamansi or citrus, baking soda solution, soap solution, salt water, and clean water. Ask: Why is tasting never acceptable evidence?',
      'A high-resolution realistic classroom chemistry prediction station with safe household sample cups, blank prediction slips, no-tasting safety card, indicator key, and goggles, no readable text.',
      'acid-base-indicators',
      'situation',
    ),
    evidenceSlide(
      'Indicator Color Trail',
      ['1. Record the original sample color.', '2. Add indicator or use one clean strip.', '3. Record the indicator color.', '4. Classify using the key.', '5. Add confidence: clear, unsure, or retest.'],
      'This slide starts the main activity. Groups test prepared safe samples with red-cabbage indicator, litmus, or pH strips. Output: color-trail data table.',
      'A high-resolution realistic classroom acid-base color trail setup with six safe sample cups, red-cabbage indicator, pH strips, clean droppers, color key, and blank data table, no readable text.',
      'acid-base-indicators',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Color-Trail Table',
      ['Sample code is recorded.', 'Original color is recorded.', 'Indicator color is recorded.', 'Classification matches the key.', 'Confidence is honest.'],
      'Make the output criteria explicit. The table should prevent learners from copying a classification before recording color evidence.',
      'A high-resolution realistic classroom photo of a blank color-trail table beside red-cabbage indicator, pH strips, sample cups, and color key blocks, no readable text.',
      'acid-base-indicators',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Indicators',
      ['Dropper manager: keep tools clean.', 'Color recorder: write the color first.', 'Key checker: match color to category.', 'Safety monitor: stop tasting or smelling.', 'Speaker: state confidence, not certainty.'],
      'Recommended pacing: 5 minutes prediction, 15 minutes color trail, 10 minutes evidence conference, 12 minutes unknown trail, 8 minutes safety exit.',
      'A high-resolution realistic classroom indicator station with role cards, separate droppers, pH strips, color key, safe sample cups, table sheet, and goggles, no readable text.',
      'acid-base-indicators-roles',
      'activity',
    ),
    evidenceSlide(
      'Color Evidence Conference',
      ['Post one sample result.', 'Compare color with the key.', 'Mark unclear results for retest.', 'Question: why is salt water not automatically acid or base?'],
      'This is the make-meaning task. Build one class sample classification table. Ask: Which result was unclear? How does the indicator beat product name or smell?',
      'A high-resolution realistic classroom board with sample classification cards, color-key blocks, unclear-result marker, and safe sample cups nearby, no readable text.',
      'acid-base-indicators',
      'discussion',
    ),
    evidenceSlide(
      'Unknown Sample Evidence Trail',
      ['Record the sample code.', 'Record the indicator result.', 'Match the key color.', 'Classify with confidence.', 'Explain what would require a retest.'],
      'This is the guided modeling task. Teacher models one coded sample, then pairs classify one unknown teacher-prepared sample. Output: evidence trail.',
      'A high-resolution realistic classroom unknown sample evidence trail with coded cups, indicator color result, key card, confidence scale, clean droppers, and blank worksheet, no readable text.',
      'acid-base-indicators',
      'model',
    ),
    evidenceSlide(
      'Tasting Is Not Evidence',
      ['Taste is unsafe.', 'Smell can be unreliable.', 'Brand name is not data.', 'Indicator color is observable evidence.'],
      'Use this misconception repair before the exit slip. Ask: Which rule protects the learner, and which rule protects the evidence?',
      'A high-resolution realistic classroom safety comparison with goggles, no-tasting icon card, pH strip color evidence, clean droppers, and sample cups, no readable text.',
      'acid-base-indicators',
      'misconception',
    ),
    evidenceSlide(
      'Indicator Safety Exit',
      ['Explain why tasting is not a test.', 'Classify one printed color result.', 'Use color evidence and the key.', 'Write one safety rule.'],
      'Use this independent check. The answer must use observed color evidence and one safety rule.',
      'A high-resolution realistic classroom exit slip with pH strip color blocks, indicator key card, safety goggles, clean dropper, and one coded sample cup, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Neutralization',
      ['Starting color shows acid condition.', 'Drops are added slowly.', 'Color sequence shows property change.', 'Claim must not say substances disappeared.'],
      'Bridge from Session 2 by pointing to the acid/base color key and asking what might happen when base is added slowly to acid.',
      'A high-resolution realistic classroom neutralization setup with vinegar indicator cup, baking soda dropper, color sequence cups, gas evidence cup, and blank sequence table, no readable text.',
      'neutralization-evidence',
      'overview',
    ),
    evidenceSlide(
      'Drop-by-Drop Forecast',
      ['Predict the color path.', 'Explain the first color change.', 'Name why drops are added slowly.', 'Wait for evidence before claiming.'],
      'This is the connect-and-diagnose task. Ask: What color shows the starting acid? What change would show less acidity? Why should we not dump solutions together?',
      'A high-resolution realistic classroom chemistry forecast setup with acid indicator cup, base solution dropper, color-key blocks, safety tray, and blank prediction slips, no readable text.',
      'neutralization-evidence',
      'situation',
    ),
    evidenceSlide(
      'Neutralization Color Sequence',
      ['1. Count each added drop.', '2. Stop and observe after each drop.', '3. Record each color stage.', '4. Note gas evidence if present.', '5. Stop at the teacher check point.'],
      'This slide starts the main activity. Groups perform a micro-neutralization or observe a teacher demonstration. Output: drop-count and color-sequence table.',
      'A high-resolution realistic classroom chemistry neutralization micro-test with dropper, vinegar indicator cup, baking soda solution, color sequence cups, tiny bubbles, and blank table, no readable text.',
      'neutralization-evidence',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Drop-Count Sequence Table',
      ['Drop count is recorded.', 'Color stage is recorded.', 'Gas evidence is noted if present.', 'Claim mentions changed acid/base properties.', 'No row says the substances disappeared.'],
      'Make the output criteria explicit before interpretation. The product must connect color evidence to changed acid-base properties.',
      'A high-resolution realistic classroom photo of a blank drop-count sequence table beside color-stage cups, indicator bottle, base dropper, and safety tray, no readable text.',
      'neutralization-evidence',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Neutralization',
      ['Dropper: add slowly.', 'Counter: count drops aloud.', 'Observer: record color before the next drop.', 'Safety monitor: keep cups on the tray.', 'Speaker: explain one color change.'],
      'Recommended pacing: 5 minutes forecast, 15 minutes sequence table, 10 minutes what-changed discussion, 12 minutes model, 8 minutes interpretation slip.',
      'A high-resolution realistic classroom neutralization station with role cards, timer, safety tray, droppers, tiny cups, color key, and blank sequence table, no readable text.',
      'neutralization-roles',
      'activity',
    ),
    evidenceSlide(
      'What Changed Discussion',
      ['Compare first and final color.', 'Name what changed in acid/base properties.', 'Use gas evidence only if observed.', 'Question: why is near-neutral not nothing?'],
      'This is the make-meaning task. Ask: What did the first color show? What changed after adding base? What claim can we make without overclaiming?',
      'A high-resolution realistic classroom discussion board with before and after color cups, neutralization evidence cards, gas evidence marker, and claim frame, no readable text.',
      'neutralization-evidence',
      'discussion',
    ),
    evidenceSlide(
      'Before-During-After Neutralization Model',
      ['Panel 1: starting acid indicator color.', 'Panel 2: base added drop by drop.', 'Panel 3: final color range.', 'Add gas evidence if present.', 'Caption: the color changed because ___.'],
      'This is the guided modeling task. Learners draw a three-panel model with starting color, drop sequence, final color, and careful salt/water language. Output: labeled neutralization evidence model.',
      'A high-resolution realistic classroom before-during-after neutralization model worksheet with three blank panels, color cups, base dropper, gas evidence cup, and pencils, no readable text.',
      'neutralization-evidence',
      'model',
    ),
    evidenceSlide(
      'Near Neutral Does Not Mean Nothing',
      ['Properties changed during the test.', 'Indicator evidence shows the change.', 'Products may include salt and water.', 'Do not say both substances disappeared.'],
      'Use this misconception repair before the interpretation slip. Ask: Which evidence shows the substances did not simply disappear?',
      'A high-resolution realistic classroom comparison card showing incorrect disappearance idea crossed out beside color-sequence evidence and product-note cards, no readable text.',
      'neutralization-evidence',
      'misconception',
    ),
    evidenceSlide(
      'Neutralization Interpretation Slip',
      ['Read the printed color sequence.', 'Identify what changed.', 'Use indicator evidence.', 'Explain why disappeared is incorrect.'],
      'Use this independent check. The answer must mention changed acid/base properties and evidence from the indicator.',
      'A high-resolution realistic classroom interpretation slip beside color sequence cards, indicator key, tiny cups, and pencil, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Unknown Classification',
      ['Procedure protects evidence.', 'Indicator color supports the claim.', 'Confidence can be clear or limited.', 'CER explains the classification.'],
      'Bridge by reviewing the indicator key and one evidence-before-claim rule. Ask: What should be recorded before anyone claims the identity?',
      'A high-resolution realistic classroom unknown classification station with coded cups, pH strips, red-cabbage indicator, color key, confidence scale, and CER sheet, no readable text.',
      'unknown-sample-classification',
      'overview',
    ),
    evidenceSlide(
      'Evidence Before Claim',
      ['Record the sample code first.', 'Use clean tools for each sample.', 'Compare with the key before claiming.', 'Name one safety rule and one evidence rule.'],
      'This is the connect-and-diagnose task. Teacher models one coded unknown safely. Ask: What procedure rule protects evidence? What safety rule protects the learner?',
      'A high-resolution realistic classroom teacher-modeled unknown sample test with coded cup, clean dropper, indicator color, color key, safety goggles, and blank recording sheet, no readable text.',
      'unknown-sample-classification',
      'situation',
    ),
    evidenceSlide(
      'Unknown Sample Investigation',
      ['1. Record sample code and indicator color.', '2. Match the color to the key.', '3. Classify acid, base, neutral, or salt solution.', '4. Rate confidence.', '5. Name one possible source of error.'],
      'This slide starts the main activity. Groups test two teacher-prepared unknowns using indicators. Output: unknown-sample investigation table.',
      'A high-resolution realistic classroom unknown-sample investigation station with coded safe samples, indicator bottle, pH strips, separate droppers, key card, confidence scale, and blank table, no readable text.',
      'unknown-sample-classification',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Unknown-Sample Table',
      ['Sample code is complete.', 'Indicator color is recorded.', 'Key match supports classification.', 'Confidence or limitation is stated.', 'Possible error is named.'],
      'Make the output criteria explicit. The product must include evidence, key match, classification, and confidence before identities are discussed.',
      'A high-resolution realistic classroom photo of a blank unknown-sample investigation table beside coded cups, pH strips, indicator key, confidence scale, and clean droppers, no readable text.',
      'unknown-sample-classification',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Unknowns',
      ['Code reader: check sample labels.', 'Tool manager: prevent cross-contamination.', 'Color recorder: write evidence first.', 'Key checker: confirm the match.', 'CER speaker: state confidence honestly.'],
      'Recommended pacing: 5 minutes evidence-before-claim, 15 minutes unknown investigation, 10 minutes disagreement clinic, 12 minutes CER brief, 8 minutes mastery case.',
      'A high-resolution realistic classroom unknown-sample station with role cards, coded cups, clean droppers, pH strips, color key, timer, and CER slips, no readable text.',
      'unknown-sample-roles',
      'activity',
    ),
    evidenceSlide(
      'Disagreement Clinic',
      ['Compare group results without rushing.', 'Mark clear matches and uncertain matches.', 'Name possible contamination or reading errors.', 'Question: when should we say likely or unsure?'],
      'This is the make-meaning task. Compare selected group results without immediately revealing all identities. Ask: What could cause disagreement between groups?',
      'A high-resolution realistic classroom disagreement clinic board with coded sample result cards, color-key blocks, uncertainty markers, clean dropper reminder, and confidence scale, no readable text.',
      'unknown-sample-classification',
      'discussion',
    ),
    evidenceSlide(
      'Unknown Sample CER Brief',
      ['Claim: classify the coded sample.', 'Evidence: indicator color and key match.', 'Reasoning: why the evidence supports the class.', 'Procedure note: safety or validity rule.', 'Limitation: confidence or possible error.'],
      'This is the guided modeling task. Learners write one concise CER for one sample. Output: unknown-sample CER brief.',
      'A high-resolution realistic classroom CER brief worksheet with claim evidence reasoning boxes, coded sample color-result card, pH strip, key card, goggles, and pencil, no readable text.',
      'unknown-sample-classification',
      'model',
    ),
    evidenceSlide(
      'Likely or Unsure Is Scientific',
      ['A weak color match lowers confidence.', 'Contamination can change evidence.', 'One test may need retesting.', 'Honest limits make the claim stronger.'],
      'Use this misconception repair before the mastery case. Ask: Which answer is more scientific: forced certainty or evidence-based confidence?',
      'A high-resolution realistic classroom comparison card showing clear color match, unclear color match, clean dropper, contaminated dropper warning, and confidence scale, no readable text.',
      'unknown-sample-classification',
      'misconception',
    ),
    evidenceSlide(
      'Individual Mastery Case',
      ['Classify one printed unknown result.', 'Use indicator color and key match.', 'Write one safety rule.', 'Write one validity rule.', 'Add confidence or limitation.'],
      'Use this independent check. The response must include indicator color, key match, classification, and confidence or limitation.',
      'A high-resolution realistic classroom individual mastery case with printed color-result card, indicator key, CER mini-slip, goggles, clean droppers, and pencil, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Reaction Evidence Path",
      ['Warm up with three changes.', 'Complete the micro-reaction table.', 'Build the evidence ladder.', 'Create one evidence card.', 'Defend the exit sort.'],
      'Use this as the pacing guide. Keep learners from treating every visible change as automatic proof of chemical reaction.',
      'A high-resolution realistic classroom chemistry activity path with warm-up cards, micro-reaction table, evidence ladder cards, reaction evidence card, and exit sort slips on a lab table, no readable text.',
      'reaction-indicators-roles',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Indicator Evidence Path",
      ['Predict safely.', 'Record color evidence.', 'Classify with the key.', 'Test one coded unknown.', 'Defend the safety exit.'],
      'Use this as the pacing guide. Learners must record color evidence before classification.',
      'A high-resolution realistic classroom acid-base activity path with prediction slips, safe samples, red-cabbage indicator, pH strips, color-trail table, unknown sample trail, and exit slip, no readable text.',
      'acid-base-indicators-roles',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Neutralization Evidence Path",
      ['Forecast the color path.', 'Add base drop by drop.', 'Record the sequence.', 'Build the three-panel model.', 'Explain the interpretation slip.'],
      'Use this as the pacing guide. Learners should interpret changed properties, not say substances disappeared.',
      'A high-resolution realistic classroom neutralization activity path with forecast slips, vinegar indicator cup, base dropper, color sequence cups, model worksheet, and interpretation slip, no readable text.',
      'neutralization-roles',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Unknown Evidence Path",
      ['Record before claiming.', 'Test coded samples safely.', 'Complete the investigation table.', 'Discuss disagreement.', 'Write one CER and mastery case.'],
      'Use this as the pacing guide. Procedure, evidence, and confidence must all appear before a final classification.',
      'A high-resolution realistic classroom unknown-sample activity path with coded cups, indicator tools, key card, investigation table, disagreement cards, CER brief, and mastery slip, no readable text.',
      'unknown-sample-roles',
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
  ...chemistryReactionsBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const chemistrySignals = [
  'reaction indicators',
  'chemical reaction',
  'color change',
  'precipitate',
  'gas',
  'odor',
  'temperature change',
  'acids',
  'bases',
  'salts',
  'indicator',
  'red-cabbage',
  'litmus',
  'ph paper',
  'neutralization',
  'unknown sample',
  'vinegar',
  'baking soda',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableChemistryReactionsLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasScienceContext = /\bscience\b/.test(normalized) || /\bgrade\s*10\b/.test(normalized);
  const score = chemistrySignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);
  return hasScienceContext && score >= 5;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...chemistryReactionsBlueprint,
  smartObjectives: [...chemistryReactionsBlueprint.smartObjectives],
  studentFacingObjectives: [...chemistryReactionsBlueprint.studentFacingObjectives],
  days: chemistryReactionsBlueprint.days.map((day) => ({ ...day })),
});

const chemistryMainActivityByDayNumber: Record<number, string> = {
  1: 'Micro-Reaction Evidence Table',
  2: 'Indicator Color Trail',
  3: 'Neutralization Color Sequence',
  4: 'Unknown Sample Investigation',
};

export const validateChemistryReactionsK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: chemistryReactionsBlueprint.subject,
    gradeLevel: chemistryReactionsBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: chemistryMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 78,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: true,
  });
};

export const getChemistryReactionsK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getChemistryReactionsK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  const qualityResult = validateChemistryReactionsK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Chemistry reactions reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getChemistryReactionsK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
