import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const FORCE_MOTION_TOPIC = 'Inertia, Net Force, and Acceleration Foundations';
const FORCE_MOTION_COMPETENCY = 'Identify inertia as the tendency for an object to stay at rest or in motion unless acted on by an unbalanced net force. Demonstrate in practical situations and describe acceleration as a change in speed and/or direction as a result of a net force. Investigate the relationship among force, acceleration, and mass.';

const FORCE_MOTION_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify inertia in a safe demonstration, calculate net force from signed force directions, and explain why balanced or unbalanced net force determines whether motion changes.',
  'By the end of Session 2, learners classify acceleration as a change in speed, direction, or both, then justify how an unbalanced net force causes each motion change in everyday and classroom-safe examples.',
  'By the end of Session 3, learners investigate force and acceleration at constant mass by comparing pull-strength evidence, organizing data in a table, and concluding that greater net force produces greater acceleration.',
  'By the end of Session 4, learners use F = ma to solve constant-mass acceleration cases, identify acceleration direction from net force, and justify the answer with a force diagram and relationship statement.',
];

const forceMotionBlueprint: LessonBlueprint = {
  mainTitle: 'Inertia, Net Force, and Acceleration Foundations',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 9',
  quarter: 'First Term',
  learningCompetency: FORCE_MOTION_COMPETENCY,
  smartObjectives: [...FORCE_MOTION_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...FORCE_MOTION_LEARNING_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Inertia and Net Force Evidence',
      focus: 'Learners use safe demonstrations to identify inertia, calculate signed net force, and explain balanced or unbalanced force evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Acceleration as Velocity Change',
      focus: 'Learners classify acceleration as speed change, direction change, or both, then connect each case to unbalanced net force.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Force and Acceleration at Constant Mass',
      focus: 'Learners run or analyze a fair pull-strength trial and use data to conclude that greater net force produces greater acceleration at constant mass.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Using F = ma with Direction',
      focus: 'Learners solve constant-mass acceleration cases and justify answers with force diagrams, units, direction, and relationship statements.',
      generationStatus: 'pending',
    },
  ],
};

const forceMotionMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Science',
  topic: FORCE_MOTION_TOPIC,
  gradeLevel: 'Grade 9',
  gradeBand: '7-10',
  learningCompetency: FORCE_MOTION_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'photorealistic',
): ImageSemanticMetadata => ({
  ...forceMotionMetadata,
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
    forceMotionBlueprint.mainTitle,
    ['Subject: Science', 'Grade Level: Grade 9', 'Term: First Term'],
    'Introduce the week as one coherent sequence: inertia and net force evidence, acceleration as velocity change, force-acceleration fair testing, and F = ma reasoning with direction.',
    'A high-resolution realistic classroom physics setup showing a toy cart, force arrows on cards, a spring scale, a meter stick, mass blocks, and a student data table on a lab table, accurate Grade 9 force-and-motion materials, no readable text.',
    'overview',
    'overview',
  ),
  slide(
    'Learning Roadmap',
    [
      'Use evidence to explain inertia and net force',
      'Classify acceleration by speed and direction changes',
      'Test force and acceleration fairly at constant mass',
      'Use F = ma with units, direction, and a force diagram',
    ],
    `Use this as the student-facing roadmap. Exact lesson-plan objectives: ${forceMotionBlueprint.studentFacingObjectives.join(' | ')}`,
    '',
  ),
  slide(
    'How We Will Work Like Physicists',
    ['Predict before the evidence', 'Keep variables controlled', 'Use arrows and signs carefully', 'Connect every number to a motion claim'],
    'Set the inquiry norm for the week. Learners should not memorize formulas before they can connect evidence, force diagrams, and motion change.',
    '',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: FORCE_MOTION_LEARNING_OBJECTIVES[0],
    studentGoals: ['Identify inertia from safe evidence', 'Calculate signed net force', 'Explain balanced or unbalanced force evidence'],
    question: 'When does motion change, and when does an object keep doing what it was doing?',
    evidence: 'Seatbelt prediction sort, coin-card-cup or paper-pull demo, net-force line, evidence board',
    output: 'Observation-net-force table, signed force diagram, and inertia CER exit slip',
  },
  2: {
    objective: FORCE_MOTION_LEARNING_OBJECTIVES[1],
    studentGoals: ['Classify acceleration by speed or direction change', 'Identify the unbalanced force clue', 'Explain velocity change with evidence'],
    question: 'How can an object accelerate even when it is not only speeding up?',
    evidence: 'Acceleration triage cards, motion-change evidence table, velocity-change map',
    output: 'Motion-change table, acceleration cause-effect strip, and direction-change exit explanation',
  },
  3: {
    objective: FORCE_MOTION_LEARNING_OBJECTIVES[2],
    studentGoals: ['Keep mass constant in a fair test', 'Compare weak and stronger pulls', 'Use data to state the force-acceleration relationship'],
    question: 'At the same mass, what evidence shows that a greater net force produces greater acceleration?',
    evidence: 'Fair-push decision slip, pull-strength data trial, class trend board',
    output: 'Force-acceleration data table, two-panel relationship model, and fair-test transfer exit slip',
  },
  4: {
    objective: FORCE_MOTION_LEARNING_OBJECTIVES[3],
    studentGoals: ['Match F, m, and a to meaning and units', 'Solve acceleration with direction', 'Justify the answer with a force diagram'],
    question: 'How do we use F = ma without losing the meaning of the motion?',
    evidence: 'Formula meaning slip, worked acceleration cases, answer-reasonableness conference',
    output: 'Two worked solutions, annotated force-to-acceleration model, and constant-mass mastery slip',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const day = forceMotionBlueprint.days.find((candidate) => candidate.dayNumber === dayNumber);
  const structure = sessionStructure[dayNumber];

  if (dayNumber === 1) {
    return slide(
      'What Will Make Motion Change?',
      [
        'Look first: what keeps moving or stays at rest?',
        'Find the force evidence before explaining.',
        'Predict before the demo.',
        'Output: table, signed diagram, CER.',
      ],
      `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
      'A high-resolution realistic classroom physics scene showing a seatbelt model cart, coin-card-cup setup, force-arrow cards, and a blank student evidence table arranged on a lab table, accurate Grade 9 inertia and net-force materials, no readable text.',
      'force-net-inertia',
      'situation',
      'photorealistic',
      [
        { id: 'same-motion', text: 'same motion?', x: 31, y: 35, fontSize: 20 },
        { id: 'force-evidence', text: 'force evidence', x: 72, y: 52, fontSize: 20 },
      ],
      'evidence',
    );
  }

  return slide(
    day?.title || 'Lesson Focus',
    [...structure.studentGoals, `Question: ${structure.question}`, `Output: ${structure.output}`],
    `Use this student-facing opener before the first task. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What will count as proof that we met the objective today?`,
    '',
  );
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Evidence Goal: Inertia and Net Force',
      [
        'Object: what keeps its motion?',
        'Force evidence: balanced or unbalanced?',
        'Net force: zero or not zero?',
        'Proof: table, signed diagram, CER.',
      ],
      'Begin with attendance and wellbeing, then bridge with a transport or sports situation where an object kept moving or stayed at rest. Ask: What was moving? What stayed the same? What evidence would show a change in motion?',
      'A high-resolution realistic classroom physics evidence board showing a book at rest with balanced arrows, a toy cart with a spring scale and unbalanced arrow, and blank student proof cards, accurate net-force classroom materials, no readable text.',
      'force-net-inertia',
      'overview',
      'photorealistic',
      [
        { id: 'balanced', text: 'balanced', x: 24, y: 56, fontSize: 20 },
        { id: 'unbalanced', text: 'unbalanced', x: 71, y: 50, fontSize: 20 },
      ],
      'evidence',
    ),
    evidenceSlide(
      'Seatbelt Prediction Sort',
      ['1. Read each situation card.', '2. Choose: motion changes or stays the same.', '3. Circle the force clue.', '4. Explain what stayed unchanged.'],
      'This is the connect-and-diagnose task from the lesson plan. Use passenger lurching forward, book at rest on a table, and coin-card-cup or paper-pull setup. Output: prediction sort slip. Ask: What is moving? What stays the same? What evidence would show a change in motion?',
      'A high-resolution realistic classroom physics image showing three safe prediction cards on a table: a passenger-seatbelt situation, a book resting on a table, and a coin-card-cup demonstration setup, with blank answer slips and force-arrow cards nearby, no readable text.',
      'force-net-inertia',
      'situation',
    ),
    slide(
      'Inertia Demo and Net-Force Line',
      [
        '1. Predict what happens to the coin.',
        '2. Observe before and after the quick pull.',
        '3. Set right as positive and left as negative.',
        '4. Compute the signed net force.',
        '5. Explain whether motion changed or stayed.',
      ],
      'This slide starts the main activity. Teacher performs a small, dry, safe coin-card-cup or paper-pull demonstration, away from learners faces. Output: observation-net-force table from Q1-LAS 01 and Q1-LAS 02. Ask: What changed, what stayed the same, and what force evidence supports that answer?',
      'A high-resolution realistic classroom physics demonstration: a coin on an index card over a cup beside a paper-pull strip, a horizontal net-force line with arrows, and a blank observation table on a lab table, accurate safe materials, no readable text.',
      'force-net-inertia',
      'activity',
      'photorealistic',
      [
        { id: 'quick-pull', text: 'quick pull', x: 77, y: 39, fontSize: 20 },
        { id: 'coin-stays', text: 'coin tends to stay', x: 34, y: 33, fontSize: 20 },
      ],
      'evidence',
    ),
    evidenceSlide(
      'Output Check: Net-Force Table',
      ['Before: record what is moving or at rest.', 'After: record what changed or stayed.', 'Math: signed net-force result.', 'Claim: motion changed or stayed because ___.'],
      'Make output criteria explicit before learners work independently. Output: one before/after observation, one signed net-force result, and one evidence claim. Ask: Which part proves inertia, and which part proves balanced or unbalanced net force?',
      'A high-resolution realistic classroom image of a clean observation-net-force table template beside force-arrow cards, a coin-card-cup setup, and a signed number line with opposing arrows, no readable text.',
      'force-net-inertia',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety',
      ['Observer: record evidence only.', 'Force tracker: set signs and arrows.', 'Calculator: check the net force.', 'Speaker: defend the group claim.', 'Safety first: stay seated; no throwing.'],
      'Recommended pacing: 5 minutes prediction sort, 15 minutes demonstration and net-force line, 10 minutes evidence board, 12 minutes force diagram clinic, 8 minutes CER exit. Ask: Which role protects evidence quality, and which role checks the force reasoning?',
      'A high-resolution realistic classroom physics activity setup with role cards, timer, coin-card-cup materials, force-arrow cards, signed number line, and exit slips arranged neatly on a lab table, no readable text.',
      'force-net-inertia-roles',
      'activity',
    ),
    slide(
      'Balanced or Unbalanced Evidence Board',
      ['Post one table row.', 'Compare opposite force arrows.', 'Decide if net force is zero.', 'Classify: balanced or unbalanced.', 'Explain: did motion change? why?'],
      'This is the make-meaning task. Groups compare cases from rest, motion, and the force calculation. Output: class evidence board with three accurate claims. Ask: Which forces are opposite? What is the net force? When did motion change? Why is inertia not a pushing force?',
      'A high-resolution realistic classroom board with three force-and-motion evidence cards: book at rest with balanced arrows, cart changing motion with unbalanced arrows, and a signed net-force calculation card, student sticky notes around the cards, no readable text.',
      'force-net-inertia',
      'discussion',
      'photorealistic',
      [
        { id: 'balanced-label', text: 'balanced', x: 23, y: 57, fontSize: 20 },
        { id: 'unbalanced-label', text: 'unbalanced', x: 68, y: 53, fontSize: 20 },
        { id: 'net-force-label', text: 'net force', x: 86, y: 50, fontSize: 20 },
      ],
      'evidence',
    ),
    slide(
      'Force Diagram Caption Clinic',
      ['Draw force arrows in correct directions.', 'Add positive and negative signs.', 'Compute net force and direction.', 'Check if the diagram matches the motion.', 'Caption: motion changed or stayed because ___.'],
      'This is the guided modeling task. Pairs convert the Q1-LAS net-force solution into a clean force diagram with arrows, signs, net-force value, direction, and a caption. Output: signed force diagram with caption.',
      'A high-resolution realistic classroom image showing a pair-work force diagram worksheet with a cart, left and right force arrows, sign markers, net-force box, caption space, ruler, and pencils, no readable text.',
      'force-net-inertia',
      'model',
      'photorealistic',
      [
        { id: 'opposite-forces', text: 'opposite forces', x: 29, y: 53, fontSize: 20 },
        { id: 'net-force', text: 'net force', x: 75, y: 48, fontSize: 20 },
      ],
      'evidence',
    ),
    evidenceSlide(
      'Inertia Is Not a Pushing Force',
      ['Inertia is a tendency, not a force.', 'Balanced net force: no motion change.', 'Unbalanced net force: motion changes.', 'Use force evidence before naming the idea.'],
      'Use this misconception repair before the exit slip. Ask: If inertia is not a force, what force evidence explains the change? What stayed the same when the net force was balanced?',
      'A high-resolution realistic classroom comparison image with two cards: one object at rest with balanced arrows and one moving cart with an unbalanced arrow, with a misconception repair marker beside the cards, no readable text.',
      'force-net-inertia',
      'misconception',
    ),
    evidenceSlide(
      'CER Exit: Inertia and Net Force',
      ['Claim: balanced or unbalanced.', 'Evidence: demo plus force diagram.', 'Reasoning: inertia plus net force.', 'Finish: motion changed or stayed because ___.'],
      'Use the transfer case about a passenger lurching forward or an object on a moving cart. Learners must state a claim, cite demonstration or force-diagram evidence, and explain using inertia and net force. Output: individual CER exit slip.',
      'A high-resolution realistic classroom image of a CER exit slip beside a small cart and force diagram cards, with claim-evidence-reasoning boxes visible as blank shapes, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  2: [
    slide(
      'Learning Target: Acceleration Evidence',
      ['Decide whether velocity changed', 'Name speed change, direction change, or both', 'Connect each change to an unbalanced net force'],
      'Bridge from Session 1 by asking learners to recall one case where unbalanced net force changed motion. Ask: Did speed change, direction change, or both?',
      '',
    ),
    evidenceSlide(
      'Acceleration or Not Triage',
      ['Classify each card as acceleration or no acceleration', 'Circle the force clue', 'Underline speed change, direction change, or both', 'Defend one card with evidence'],
      'This is the connect-and-diagnose task from the lesson plan. Use cards for runner speeding up, ball slowing after a push, bicycle turning, and book resting. Output: triage card. Ask: What changed? Did speed change? Did direction change? What force caused the change?',
      'A high-resolution realistic classroom physics table showing four motion triage cards: runner speeding up, ball slowing, bicycle turning, and book resting, with force-arrow tokens and blank triage slips nearby, no readable text.',
      'acceleration-velocity-change',
      'situation',
    ),
    evidenceSlide(
      'Motion Change Evidence Table',
      ['Describe the before-motion', 'Identify the unbalanced-force direction', 'Classify the result as speeding up, slowing down, or turning', 'Use the same evidence rule for every row'],
      'This slide starts the main activity. Groups use teacher-safe cards or one controlled rolling-ball lane. Learners complete three rows and must name the force causing acceleration, not only the visible motion. Output: three-row motion-change table.',
      'A high-resolution realistic classroom physics setup with a controlled rolling-ball lane, motion cards, force-arrow cards, and a three-row evidence table on a lab table, no readable text.',
      'acceleration-velocity-change',
      'activity',
    ),
    evidenceSlide(
      'Expected Output: Motion-Change Table',
      ['Three cases completed', 'Each row names before-motion', 'Each row names the unbalanced force direction', 'Each row classifies acceleration type', 'Each row uses evidence, not guessing'],
      'Make the output criteria explicit before learners complete the table. The product must support the objective: learners classify acceleration and justify it with unbalanced net force evidence.',
      'A high-resolution realistic classroom image of a blank three-row motion-change evidence table beside speed-change, direction-change, and both-change icon cards with force arrows, no readable text.',
      'acceleration-velocity-change',
      'success-criteria',
    ),
    evidenceSlide(
      'Roles, Timing, and Safety: Motion Evidence',
      ['Motion reader describes the card or lane', 'Force finder points to the force clue', 'Classifier names the acceleration type', 'Evidence speaker defends one row', 'Keep balls inside the marked lane'],
      'Recommended pacing: 5 minutes triage, 15 minutes evidence table, 10 minutes velocity-change map, 12 minutes cause-effect strip, 8 minutes direction-change exit.',
      'A high-resolution realistic classroom image of a marked rolling-ball lane with foam bumper, role cards, force-arrow tokens, timer, and blank exit slips on a lab table, no readable text.',
      'acceleration-roles',
      'activity',
    ),
    evidenceSlide(
      'Velocity-Change Map',
      ['Place each example in speed change, direction change, or both', 'Defend the column with a force cause', 'Move a card if the evidence improves', 'Remember: turning can be acceleration'],
      'This is the make-meaning task. The class builds a board with three columns: speed changes, direction changes, and speed-and-direction both change. Output: class velocity-change map. Ask: Which examples changed speed? Which changed direction? Why can a turning object accelerate even if speed seems steady?',
      'A high-resolution realistic classroom board with three columns of motion examples: speeding up, slowing down, turning, and both-changing cards, with net-force arrows beside each column, no readable text.',
      'acceleration-velocity-change',
      'discussion',
    ),
    evidenceSlide(
      'Acceleration Cause-and-Effect Strip',
      ['Name the object', 'Show the initial motion', 'Draw the unbalanced net-force arrow', 'Name the motion change', 'Classify the acceleration type'],
      'This is the guided modeling task. Pairs choose one case and build a strip with object, initial motion, unbalanced force, motion change, and acceleration type. Output: labeled acceleration strip.',
      'A high-resolution realistic classroom image of a five-panel cause-and-effect strip template with a toy car, ball, and bicycle-turning card, force-arrow markers, and blank caption spaces, no readable text.',
      'acceleration-velocity-change',
      'model',
    ),
    evidenceSlide(
      'Turning Can Still Be Acceleration',
      ['Acceleration means velocity changed', 'Velocity includes direction', 'A sideways net force can change direction', 'The speed may look nearly constant'],
      'Use this misconception repair. Ask: What changed if the bicycle or ball turned? Where did the unbalanced force point? Why is “not speeding up” not the same as “not accelerating”?',
      'A high-resolution realistic classroom physics image showing a ball following a curved path on a marked table lane with tangent motion arrows and a sideways net-force arrow, clean accurate diagram overlays, no readable text.',
      'acceleration-velocity-change',
      'misconception',
    ),
    evidenceSlide(
      'Direction-Change Exit Case',
      ['Choose: accelerating or not accelerating', 'Identify the unbalanced force', 'Explain the velocity change', 'Use speed or direction language'],
      'Use a bicycle or ball turning at nearly constant speed. Learners answer whether it is accelerating, identify the unbalanced force, and explain the velocity change. Output: individual explanation slip.',
      'A high-resolution realistic classroom image of an exit slip beside a curved-path ball diagram, a small toy bicycle model, and force-arrow cards, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  3: [
    slide(
      'Learning Target: Force and Acceleration',
      ['Test force fairly', 'Keep mass constant', 'Use evidence to compare weak and stronger pulls'],
      'Bridge from Session 2 by asking which variable must stay the same if we want to test force and acceleration fairly.',
      '',
    ),
    evidenceSlide(
      'Fair Push Question',
      ['Inspect two proposed setups', 'Identify the changed variable', 'Identify what stays the same', 'Predict which setup gives greater acceleration'],
      'This is the connect-and-diagnose task. Learners inspect two proposed tests, one fair and one unfair. Output: fair-test decision slip. Ask: What is being changed? What is being measured? Why would changing mass and force at the same time weaken the evidence?',
      'A high-resolution realistic classroom physics comparison showing two toy-cart test setups side by side: one fair test with same mass and different pull strength, one unfair test changing both mass and pull strength, no readable text.',
      'force-acceleration-fair-test',
      'situation',
    ),
    evidenceSlide(
      'Pull Strength Data Trial',
      ['Use the same cart or object', 'Apply a weak pull and a stronger pull', 'Record distance reached or time-marker evidence', 'Keep mass constant', 'Write why the comparison is fair'],
      'This slide starts the main activity. Groups use a toy cart, box lid, bottle-cap slider, or teacher-provided data if materials are limited. Output: force-acceleration data table. Check gentle pulls only and avoid stretched rubber bands near faces.',
      'A high-resolution realistic classroom physics lab setup with the same toy cart on a meter track, a spring scale showing weak and stronger pull positions, mass blocks unchanged on the cart, and a blank data table nearby, no readable text.',
      'force-acceleration-fair-test',
      'activity',
    ),
    evidenceSlide(
      'Expected Output: Force-Acceleration Data Table',
      ['Weak-pull row completed', 'Stronger-pull row completed', 'Mass condition is marked the same', 'Acceleration evidence is recorded', 'Conclusion compares force and acceleration'],
      'Make output criteria explicit. Connect the product to the objective: learners organize data and conclude that greater net force produces greater acceleration at constant mass.',
      'A high-resolution realistic classroom image of a two-row force-acceleration data table beside a toy cart, unchanged mass blocks, weak and strong pull arrow cards, and a meter stick, no readable text.',
      'force-acceleration-fair-test',
      'success-criteria',
    ),
    evidenceSlide(
      'Roles, Timing, and Safety: Pull Trial',
      ['Puller uses gentle pulls only', 'Mass checker confirms the same mass', 'Data recorder marks distance or time evidence', 'Trend speaker states the pattern', 'Keep materials on desks or marked lanes'],
      'Recommended pacing: 5 minutes fair-push decision, 15 minutes pull-strength data trial, 10 minutes trend board, 12 minutes relationship model, 8 minutes fair-test transfer exit.',
      'A high-resolution realistic classroom image of a cart-track station with role cards, timer, spring scale, meter stick, mass blocks, masking-tape lane, and exit slips, no readable text.',
      'force-acceleration-roles',
      'activity',
    ),
    evidenceSlide(
      'Trend Talk Board',
      ['Report one evidence pattern', 'Compare weak pull and stronger pull', 'Check that mass stayed constant', 'Use data before making a claim'],
      'This is the make-meaning task. Groups report one evidence pattern and compare whether stronger pull gave a larger motion change. Output: class force-acceleration trend board. Ask: Which trial had greater pull? What evidence shows greater acceleration? What stayed the same?',
      'A high-resolution realistic classroom board with two evidence panels: weak pull on same-mass cart and stronger pull on same-mass cart, distance markers and larger acceleration arrow on the stronger-pull panel, no readable text.',
      'force-acceleration-fair-test',
      'discussion',
    ),
    evidenceSlide(
      'Constant-Mass Relationship Model',
      ['Draw the same mass in both panels', 'Show weak pull and stronger pull arrows', 'Label the acceleration evidence', 'Complete: At constant mass, greater net force causes ___'],
      'This is the guided modeling task. Learners create a two-panel model showing same mass with weak pull and stronger pull. Output: two-panel force-acceleration model. The model must not change mass between panels.',
      'A high-resolution realistic classroom image of a two-panel force-acceleration model worksheet: same cart mass in both panels, weak pull arrow on one panel, stronger pull arrow on the other, larger acceleration arrow on the stronger-pull panel, no readable text.',
      'force-acceleration-fair-test',
      'model',
    ),
    evidenceSlide(
      'Fair Test Mischeck',
      ['Changing force is allowed', 'Changing mass is not allowed in this test', 'Changing both weakens the conclusion', 'A fair conclusion names what stayed the same'],
      'Use this misconception repair before the exit task. Ask: Why is “the cart moved farther because someone tried harder” not enough? What must be controlled to make the claim scientific?',
      'A high-resolution realistic classroom comparison image showing a crossed-out unfair cart setup where both mass and pull strength change, beside a checked fair setup where mass stays the same and pull changes, no readable text.',
      'force-acceleration-fair-test',
      'misconception',
    ),
    evidenceSlide(
      'Fair-Test Transfer Exit',
      ['Identify the independent variable', 'State the evidence of acceleration', 'Write the force-acceleration relationship', 'Name the constant mass condition'],
      'Use a new case where one cart is pulled weakly and strongly while mass stays the same. Learners identify the independent variable, state evidence of acceleration, and write the relationship. Output: individual exit slip.',
      'A high-resolution realistic classroom image of a transfer exit slip beside a same-mass cart comparison card, weak and strong pull arrows, and distance markers, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
  4: [
    slide(
      'Learning Target: F = ma With Meaning',
      ['Match symbols to quantities and units', 'Compute acceleration with direction', 'Justify the answer with a force diagram'],
      'Bridge from Session 3 by reviewing the class trend: same mass, stronger net force, greater acceleration. Tell learners that today the calculation must still match the force diagram.',
      '',
    ),
    evidenceSlide(
      'Formula Meaning Warm-Up',
      ['Match F, m, and a to the quantity', 'State the SI unit for each symbol', 'Predict which direction acceleration points', 'Connect direction to net force before calculating'],
      'This is the connect-and-diagnose task. Learners match F, m, and a to force, mass, and acceleration, then connect each symbol to the Session 3 data table. Output: formula meaning slip. Ask: What does each symbol represent? Which quantity stayed constant yesterday? Why should direction be checked before calculating?',
      'A high-resolution realistic classroom physics warm-up image with three formula-symbol cards, unit cards, a net-force arrow card, a same-mass cart card, and blank matching slip on a desk, no readable text.',
      'fma-acceleration-direction',
      'situation',
    ),
    evidenceSlide(
      'Worked Acceleration Case Set',
      ['Write the formula', 'Substitute values with units', 'Compute acceleration', 'Add the acceleration direction', 'Check whether the answer is reasonable'],
      'This slide starts the main activity. Learners solve two Q1-LAS 06 or Q1-LAS 07 style cases with given net force and mass. Output: two worked solutions. Check the first solution before learners complete the second case independently.',
      'A high-resolution realistic classroom image of a worked acceleration case set: blank formula boxes, a toy cart force diagram, mass block card, calculator, and unit checklist on a lab table, no readable text.',
      'fma-acceleration-direction',
      'activity',
    ),
    evidenceSlide(
      'Expected Output: Two Worked Solutions',
      ['Formula is written correctly', 'Substitution includes units', 'Answer includes acceleration unit', 'Direction matches the net force', 'Force diagram supports the number'],
      'Make output criteria explicit before independent work. The product must include computation and concept, not just an answer.',
      'A high-resolution realistic classroom image of two blank worked-solution frames beside a cart force diagram, formula card, unit checklist, and direction arrow card, no readable text.',
      'fma-acceleration-direction',
      'success-criteria',
    ),
    evidenceSlide(
      'Roles, Timing, and Accuracy Checks',
      ['Formula checker verifies setup', 'Unit checker tracks N, kg, and m/s^2', 'Diagram checker matches direction', 'Reasonableness speaker explains the trend', 'Calculator supports thinking; it does not replace the model'],
      'Recommended pacing: 5 minutes formula meaning warm-up, 15 minutes worked case set, 10 minutes answer conference, 12 minutes force-to-acceleration model, 8 minutes mastery slip.',
      'A high-resolution realistic classroom physics station with role cards, calculator, unit checklist, formula card, force diagram template, and mastery slips arranged on a lab table, no readable text.',
      'fma-roles',
      'activity',
    ),
    evidenceSlide(
      'Answer-Reasonableness Conference',
      ['Compare the answers', 'Check net force and mass', 'Check the direction', 'Use the Session 3 trend to reject impossible answers'],
      'This is the make-meaning task. The class compares answers and asks whether each result matches the force-acceleration trend from Session 3. Ask: What is the net force? What is the mass? What acceleration did you calculate? Why should a larger net force at the same mass give a larger acceleration?',
      'A high-resolution realistic classroom board showing two worked acceleration examples with matching force diagrams, unit check marks, and a trend arrow from smaller to larger acceleration, no readable text.',
      'fma-acceleration-direction',
      'discussion',
    ),
    evidenceSlide(
      'Force-to-Acceleration Worked Model',
      ['Choose one problem', 'Draw force arrows and net-force direction', 'Substitute into F = ma', 'Compute acceleration with units', 'Write a relationship caption'],
      'This is the guided modeling task. Pairs create a complete model with force arrows, net-force direction, formula substitution, acceleration answer, and relationship caption. Output: annotated worked model.',
      'A high-resolution realistic classroom image of a complete force-to-acceleration model template with cart arrows, net-force direction arrow, formula-substitution frame, acceleration answer box, and caption area, no readable text.',
      'fma-acceleration-direction',
      'model',
    ),
    evidenceSlide(
      'Direction Before the Number',
      ['Acceleration points with the net force', 'A correct number can still have missing meaning', 'Units and direction catch common mistakes', 'The diagram should agree with the answer'],
      'Use this misconception repair before the mastery slip. Ask: What would be incomplete about an answer with no direction? Which arrow proves the direction?',
      'A high-resolution realistic classroom image comparing two acceleration answers: one with only a number and one supported by a cart force diagram, direction arrow, and unit checklist, no readable text.',
      'fma-acceleration-direction',
      'misconception',
    ),
    evidenceSlide(
      'Constant-Mass Mastery Slip',
      ['Solve one new case', 'Draw the net-force arrow', 'Add units and direction', 'Justify: if the same mass receives twice the net force, what happens to acceleration?'],
      'Use this independent check. The response must include correct units, direction, and the direct relationship at constant mass. Output: individual mastery slip.',
      'A high-resolution realistic classroom image of a mastery slip beside a same-mass two-force comparison card, net-force arrow, formula card, and calculator, no readable text.',
      'assessment',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    slide(
      "Today's Investigation Path",
      ['Predict from the setup.', 'Observe the motion evidence.', 'Calculate signed net force.', 'Discuss balanced vs unbalanced.', 'Defend the claim with CER.'],
      'Use this as the pacing guide. The session should move from prediction to evidence, then to signed net-force representation and an individual CER.',
      'A high-resolution realistic classroom physics activity path showing role cards, coin-card-cup materials, force-arrow cards, signed number line, and CER exit slips arranged left-to-right on a lab table, no readable text.',
      'force-net-inertia-roles',
      'activity',
      'photorealistic',
      undefined,
      'evidence',
    ),
  ],
  2: [
    slide(
      'Learning Sequence: Acceleration Evidence',
      ['Acceleration triage', 'Motion-change evidence table', 'Expected output check', 'Velocity-change map', 'Cause-effect strip', 'Direction-change exit'],
      'Use this as the pacing guide. The session must expand acceleration beyond speeding up to include slowing down and turning.',
      '',
    ),
  ],
  3: [
    slide(
      'Learning Sequence: Force-Acceleration Fair Test',
      ['Fair push question', 'Pull-strength data trial', 'Expected output check', 'Trend talk board', 'Constant-mass model', 'Fair-test transfer exit'],
      'Use this as the pacing guide. Keep the same-mass condition visible before interpreting the force-acceleration trend.',
      '',
    ),
  ],
  4: [
    slide(
      'Learning Sequence: F = ma With Direction',
      ['Formula meaning warm-up', 'Worked acceleration cases', 'Expected output check', 'Answer-reasonableness conference', 'Force-to-acceleration model', 'Constant-mass mastery slip'],
      'Use this as the pacing guide. Computation should stay tied to force diagrams, units, direction, and the Session 3 trend.',
      '',
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
  ...forceMotionBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const forceMotionSignals = [
  'inertia',
  'net force',
  'balanced force',
  'unbalanced force',
  'acceleration',
  'force diagram',
  'f = ma',
  'force and acceleration',
  'constant mass',
  'signed force',
  'seatbelt',
  'paper-pull',
  'coin-card-cup',
  'motion change',
  'velocity change',
  'pull strength',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableForceMotionLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;

  const hasScienceContext = /\bscience\b/.test(normalized) || /\bgrade\s*9\b/.test(normalized);
  const score = forceMotionSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);

  return hasScienceContext && score >= 4;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...forceMotionBlueprint,
  smartObjectives: [...forceMotionBlueprint.smartObjectives],
  studentFacingObjectives: [...forceMotionBlueprint.studentFacingObjectives],
  days: forceMotionBlueprint.days.map((day) => ({ ...day })),
});

const forceMotionMainActivityByDayNumber: Record<number, string> = {
  1: 'Inertia Demo and Net-Force Line',
  2: 'Motion Change Evidence Table',
  3: 'Pull Strength Data Trial',
  4: 'Worked Acceleration Case Set',
};

export const validateForceMotionK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: forceMotionBlueprint.subject,
    gradeLevel: forceMotionBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: forceMotionMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: dayNumber === 1 ? 4 : 3,
    maxPromptsPerSlide: 6,
    maxPromptLength: 72,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: true,
  });
};

export const getForceMotionK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getForceMotionK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  const qualityResult = validateForceMotionK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Force motion reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getForceMotionK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
