import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const GENERAL_SCIENCE_MOTION_TOPIC = 'Physics in Daily Life, Translational Motion, and Rotational Motion';
const GENERAL_SCIENCE_MOTION_COMPETENCY = 'Identify various ways physics enhances quality of life across household activities, health and safety, work productivity, and leisure. Compare and contrast translational and rotational motion in terms of linear and angular quantities. Demonstrate through simple activities the relationship between linear and angular quantities.';

const GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify everyday ways physics improves quality of life, distinguish translational motion from rotational motion in a cart and wheel example, and justify the distinction using visible path and turning evidence.',
  'By the end of Session 2, learners compare linear distance and angular turns, record simple rolling-object data, and explain how translational and rotational quantities describe connected parts of the same motion.',
  'By the end of Session 3, learners compare wheel-size evidence, demonstrate the relationship between linear and angular quantities, use radius or diameter to reason about distance per turn, and evaluate why different wheel sizes change motion outcomes.',
  'By the end of Session 4, learners identify the strongest motion evidence from the week and synthesize how physics enhances quality of life by creating a concise motion explainer that compares translational and rotational motion, uses linear and angular evidence, and recommends a safe or efficient device use.',
];

const generalScienceMotionBlueprint: LessonBlueprint = {
  mainTitle: 'Physics in Daily Life, Translational Motion, and Rotational Motion',
  planUnitLabel: 'Session',
  subject: 'General Science',
  gradeLevel: 'Grade 11',
  quarter: 'First Term',
  learningCompetency: GENERAL_SCIENCE_MOTION_COMPETENCY,
  smartObjectives: [...GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Motion Evidence in Daily Devices',
      focus: 'Learners use cart-and-wheel evidence to distinguish translation, rotation, and quality-of-life benefits.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Distance and Turns',
      focus: 'Learners collect rolling-object data to connect linear distance with angular turns.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Wheel Size and Distance per Turn',
      focus: 'Learners compare wheel-size evidence to explain how radius or diameter changes distance per turn.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Physics-in-Life Motion Explainer',
      focus: 'Learners synthesize weekly evidence into a device explainer with a safe or efficient recommendation.',
      generationStatus: 'pending',
    },
  ],
};

const motionMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'General Science',
  topic: GENERAL_SCIENCE_MOTION_TOPIC,
  gradeLevel: 'Grade 11',
  gradeBand: '11-12',
  learningCompetency: GENERAL_SCIENCE_MOTION_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'photorealistic',
): ImageSemanticMetadata => ({
  ...motionMetadata,
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
    generalScienceMotionBlueprint.mainTitle,
    ['Subject: General Science', 'Grade Level: Grade 11', 'Term: First Term', 'Week focus: motion evidence in daily life'],
    'Introduce the week as one evidence arc: motion in daily devices, distance and turns, wheel-size relationships, then a final device explainer.',
    'A high-resolution realistic classroom physics table with a toy cart, rolling bottle, bicycle wheel card, fan card, wheelchair card, ruler, tape path, and blank evidence table, no readable text.',
    'general-science-motion',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Notice motion in daily devices.', 'Measure distance and turns.', 'Compare wheel size evidence.', 'Build a device motion explainer.'],
    `Use this as the student-facing roadmap. Exact lesson-plan objectives: ${generalScienceMotionBlueprint.studentFacingObjectives.join(' | ')}`,
    'A high-resolution realistic classroom table showing device photo cards, marked wheel, measuring tape, blank roadmap cards, and a portfolio template, no readable text.',
    'general-science-motion-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Physicists',
    ['Observe before naming motion.', 'Measure before claiming a pattern.', 'Use models with limits.', 'Connect evidence to safer device use.'],
    'Set the investigation norm. Learners should treat everyday devices as evidence sources, not as decoration or formula examples only.',
    'A high-resolution realistic classroom physics setup with tape lanes, wheels, ruler, blank model cards, safety cards, and evidence table, no readable text.',
    'general-science-motion-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES[0],
    studentGoals: ['Separate path motion from turning motion', 'Use visible evidence from a cart and wheel', 'Connect motion to safety, work, health, or leisure'],
    question: 'How can one device move in two ways?',
    evidence: 'Motion sort cards, cart path, wheel turns, device-benefit-risk map, and two-motion diagram',
    output: 'Motion-sort card, path-turn-use table, device-benefit-risk map, two-motion diagram, and CER exit slip',
  },
  2: {
    objective: GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES[1],
    studentGoals: ['Measure linear distance', 'Count angular turns', 'Explain how distance and turns describe one motion'],
    question: 'How far does one full turn move an object?',
    evidence: 'One-turn and two-turn rolling trial with measured distance and possible error notes',
    output: 'Prediction note, distance-turn data table, vocabulary-evidence board, turn-to-distance model, and mini-case answer',
  },
  3: {
    objective: GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES[2],
    studentGoals: ['Compare same turns with different wheel sizes', 'Use radius or diameter evidence', 'State a condition or limitation'],
    question: 'Do same turns always mean same distance?',
    evidence: 'Small-wheel and large-wheel one-turn comparison, diameter or size evidence, and slipping notes',
    output: 'Wheel-size comparison table, relationship statement, revised diagram, and design-choice justification',
  },
  4: {
    objective: GENERAL_SCIENCE_MOTION_LEARNING_OBJECTIVES[3],
    studentGoals: ['Choose the strongest weekly evidence', 'Audit a device for translation and rotation', 'Recommend safe or efficient device use'],
    question: 'Which evidence should guide a device recommendation?',
    evidence: 'Evidence-selection slip, device audit, peer conference notes, and final explainer defense',
    output: 'Device audit table, peer conference note, one-page motion explainer, peer rubric, and defense ticket',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: slide(
      'How Can One Device Move in Two Ways?',
      [
        'Look for the whole object path.',
        'Look for the part that turns.',
        'Connect motion to a real benefit.',
        'Output: motion evidence and CER.',
      ],
      `Use this opener before the sort. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: Which evidence proves path motion? Which evidence proves turning?`,
      'A high-resolution realistic classroom physics setup with a cart on a tape path, wheel cards, ruler, blank evidence table, and daily device photo cards, no readable text.',
      'motion-evidence-daily-devices',
      'situation',
      'photorealistic',
      [
        { id: 'path', text: 'path?', x: 47, y: 47, fontSize: 20 },
        { id: 'turn', text: 'turn?', x: 33, y: 63, fontSize: 20 },
      ],
      'evidence',
    ),
    2: slide(
      'How Far Does One Full Turn Move?',
      [
        'Predict before rolling.',
        'Mark start and end points.',
        'Measure the straight path.',
        'Output: distance-turn data.',
      ],
      `Use this opener before the one-turn trial. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What can we measure in a straight path? What can we count in a rotation?`,
      'A high-resolution realistic classroom one-turn rolling trial with marked bottle, start and end tape marks, ruler, blank data table, and pencil, no readable text.',
      'distance-turn-evidence',
      'situation',
      'photorealistic',
      [
        { id: 'distance', text: 'distance', x: 58, y: 48, fontSize: 20 },
        { id: 'turns', text: 'turns', x: 23, y: 29, fontSize: 20 },
      ],
      'evidence',
    ),
    3: slide(
      'What Happens With Same Turns?',
      [
        'Keep the number of turns the same.',
        'Change the wheel size.',
        'Compare the travel distance.',
        'Output: wheel-size evidence.',
      ],
      `Use this opener before the comparison. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: What is the same in the two trials? What changed?`,
      'A high-resolution realistic classroom wheel-size comparison with small wheel and large wheel lanes, one-turn markers, measuring tape, and blank comparison table, no readable text.',
      'wheel-size-comparison',
      'situation',
      'photorealistic',
      [
        { id: 'same-turn', text: 'same turn', x: 25, y: 38, fontSize: 20 },
        { id: 'farther', text: 'farther?', x: 69, y: 43, fontSize: 20 },
      ],
      'evidence',
    ),
    4: slide(
      'What Evidence Should Guide a Device Recommendation?',
      [
        'Choose the strongest evidence.',
        'Audit one approved device.',
        'Connect motion to a benefit.',
        'Output: motion explainer.',
      ],
      `Use this opener before the final device audit. Exact lesson-plan objective: ${structure.objective}. Evidence source: ${structure.evidence}. Ask: Which evidence will you defend first?`,
      'A high-resolution realistic classroom device motion audit station with device photo cards, wheel model, audit table, sticky notes, and portfolio sheet, no readable text.',
      'device-motion-audit',
      'situation',
      'photorealistic',
      [
        { id: 'evidence', text: 'evidence', x: 49, y: 54, fontSize: 20 },
        { id: 'benefit', text: 'benefit', x: 75, y: 32, fontSize: 20 },
      ],
      'evidence',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Motion in Daily Devices',
      ['Path motion moves from place to place.', 'Turning motion happens around an axis.', 'One device can show both.', 'A benefit must connect to evidence.'],
      'Bridge from everyday devices. Ask learners to avoid saying only "it moves" and instead identify which part moves through a path and which part turns.',
      'A high-resolution realistic classroom table with cart, wheel, bicycle card, fan card, wheelchair card, ruler, and blank motion evidence table, no readable text.',
      'motion-evidence-daily-devices',
      'overview',
    ),
    evidenceSlide(
      'Motion Around Us Sort',
      ['1. List two familiar devices.', '2. Mark straight path, turning, or both.', '3. Add one reason for each mark.', '4. Share the most uncertain card.'],
      'This is the connect-and-diagnose task. Ask: What part moves from one place to another? What part turns around an axis? Why does this motion matter?',
      'A high-resolution realistic classroom motion sort station with device photo cards, blank sort cards, sticky notes, pencil, and a small wheel model, no readable text.',
      'motion-sort',
      'situation',
    ),
    evidenceSlide(
      'Cart-and-Wheel Evidence Demo',
      ['1. Trace the cart center path.', '2. Count or estimate wheel turns.', '3. Record one wheel-edge observation.', '4. Add one quality-of-life use.', '5. Mark any uncertainty.'],
      'This slide starts the main activity. Use a cart, toy car, or rolling bottle on a marked lane. Output: three-column evidence table for path, turns, and use.',
      'A high-resolution realistic classroom cart-and-wheel demo with marked lane, cart wheel rim mark, ruler, blank three-column evidence table, and pencil, no readable text.',
      'cart-wheel-evidence-demo',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Path-Turn-Use Table',
      ['Path evidence is visible.', 'Turn evidence is recorded.', 'Use or benefit is named.', 'Uncertain evidence is marked.'],
      'Pause before groups move on. The output must show observed path, observed turning, a real-life use, and any uncertainty in the evidence.',
      'A high-resolution realistic classroom evidence table beside a cart on a tape path, wheel rim mark, ruler, device cards, and pencil, no readable text.',
      'path-turn-use-table',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Cart and Wheel',
      ['Path tracer: mark the lane.', 'Turn counter: watch the rim mark.', 'Recorder: write evidence first.', 'Safety lead: keep rolls slow.', 'Speaker: explain the benefit.'],
      'Recommended pacing: 5 minutes sort, 15 minutes cart-and-wheel demo, 12 minutes quality-of-life map, 12 minutes diagram, 6 minutes CER exit.',
      'A high-resolution realistic classroom cart-and-wheel station with role cards, slow rolling lane, ruler, blank table, and safety cards, no readable text.',
      'cart-wheel-roles',
      'activity',
    ),
    evidenceSlide(
      'Quality-of-Life Physics Map',
      ['Choose household, transport, and health or leisure examples.', 'Name the motion each device uses.', 'Explain the benefit.', 'Name one risk if motion is uncontrolled.'],
      'This is the make-meaning task. Ask: Which examples improve safety or comfort? Which improve work productivity? What would fail if turning were poorly controlled?',
      'A high-resolution realistic classroom device-benefit-risk map with bicycle, fan, wheelchair, handcart, conveyor, washing machine, and blank mapping sheet, no readable text.',
      'quality-of-life-physics-map',
      'discussion',
    ),
    evidenceSlide(
      'Two-Motion Diagram',
      ['Draw the whole-object path.', 'Draw the turning part.', 'Label the axis or axle.', 'Add the real-life benefit.', 'Peer-check the arrows.'],
      'This is the guided modeling task. Learners draw one device with arrows for translational path and rotational motion, then annotate the benefit.',
      'A high-resolution realistic classroom two-motion diagram station with cart, wheel model, blank worksheet, colored pencils, ruler, and arrow stickers, no readable text.',
      'two-motion-diagram',
      'model',
    ),
    evidenceSlide(
      'Translation and Rotation Mischeck',
      ['A wheel can translate and rotate.', 'A fan blade rotates but stays in place.', 'A cart body translates along the path.', 'Use the moving part in your claim.'],
      'Use this misconception repair before the exit. Ask: Which object part are you talking about? What evidence proves that exact motion?',
      'A high-resolution realistic classroom comparison of cart, wheel, fan, and blank claim cards for checking translation and rotation misconceptions, no readable text.',
      'translation-rotation-mischeck',
      'misconception',
    ),
    evidenceSlide(
      'Exit Claim With Evidence',
      ['Claim: physics improves this device by ___.', 'Evidence: I observed ___.', 'Reasoning: this motion helps because ___.', 'Limitation: my evidence does not show ___.'],
      'Use this independent check. The response must identify the device, name both motion types when present, cite one class observation, and explain one benefit.',
      'A high-resolution realistic classroom CER exit slip with cart-and-wheel evidence, device cards, blank claim-evidence-reasoning sheet, and pencil, no readable text.',
      'motion-cer-exit',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Distance and Turns',
      ['Linear distance describes path length.', 'Angular turn describes rotation.', 'One rolling motion can show both.', 'Reliability depends on careful marks.'],
      'Bridge from Session 1 by asking which part of the cart evidence can now be measured. Emphasize that distance and turns describe connected parts of one rolling motion.',
      'A high-resolution realistic classroom one-turn trial setup with marked wheel, tape lane, ruler, blank distance-turn table, and pencil, no readable text.',
      'distance-turn-evidence',
      'overview',
    ),
    evidenceSlide(
      'Distance-or-Turn Prediction',
      ['1. Inspect the marked wheel.', '2. Predict one-turn distance.', '3. Write the unit you expect.', '4. Name what must stay the same.'],
      'This is the connect-and-diagnose task. Ask: What can we measure in a straight path? What can we count in a rotation? Why should one full turn move forward?',
      'A high-resolution realistic classroom prediction station with marked bottle wheel, start tape, ruler, blank prediction note, and pencil, no readable text.',
      'distance-turn-prediction',
      'situation',
    ),
    evidenceSlide(
      'One-Turn Rolling Trial',
      ['1. Mark the start point.', '2. Roll exactly one full turn.', '3. Mark the end point.', '4. Record the measured distance.', '5. Compare with two turns.'],
      'This slide starts the main activity. Pairs or a teacher-front team roll a marked wheel, bottle, or lid for one and two turns. Output: distance-turn data table.',
      'A high-resolution realistic classroom one-turn rolling trial with rim mark, start and end tape marks, ruler, blank data table, and second two-turn mark, no readable text.',
      'one-turn-rolling-trial',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Distance-Turn Table',
      ['Each trial has turns recorded.', 'Each distance has a unit.', 'Start and end marks match the trial.', 'Possible error is named.'],
      'Make the output criteria explicit before the vocabulary board. The table must connect turns, distance, units, and reliability.',
      'A high-resolution realistic classroom distance-turn table beside a marked rolling bottle, ruler, tape marks, and error note cards, no readable text.',
      'distance-turn-data-table',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Rolling Trial',
      ['Roller: release gently.', 'Marker: place tape accurately.', 'Measurer: read the ruler carefully.', 'Recorder: include units.', 'Safety lead: keep the lane clear.'],
      'Recommended pacing: 5 minutes prediction, 15 minutes one-turn trial, 12 minutes vocabulary board, 12 minutes model, 6 minutes mini-case.',
      'A high-resolution realistic classroom rolling trial station with role cards, marked wheel, tape lane, ruler, blank table, and safety reminder cards, no readable text.',
      'rolling-trial-roles',
      'activity',
    ),
    evidenceSlide(
      'Linear-Angular Match Board',
      ['Match distance to path evidence.', 'Match turn to wheel evidence.', 'Use your own data as proof.', 'Question: what changed when turns doubled?'],
      'This is the make-meaning task. Ask each group to explain one term using its measured data, not only a memorized definition.',
      'A high-resolution realistic classroom vocabulary-evidence board with marked wheel, ruler, string, blank cards, and distance-turn table, no readable text.',
      'linear-angular-match-board',
      'discussion',
    ),
    evidenceSlide(
      'Turn-to-Distance Model',
      ['Draw the wheel with a rim mark.', 'Show one full turn.', 'Show the path distance.', 'Write the condition: same wheel size.', 'Add one possible error.'],
      'This is the guided modeling task. Learners draw a wheel, rim mark, one full turn, and a relationship statement with a condition.',
      'A high-resolution realistic classroom turn-to-distance model station with marked wheel, path line, string, ruler, blank model cards, and pencils, no readable text.',
      'turn-to-distance-model',
      'model',
    ),
    evidenceSlide(
      'Data Reliability Check',
      ['Check the start mark.', 'Check the end mark.', 'Check whether the wheel slipped.', 'Check whether the turn count is correct.'],
      'Use this misconception and reliability repair before the mini-case. Ask: What else would you check before trusting a surprising result?',
      'A high-resolution realistic classroom reliability check with rolling lane, tape marks, ruler, wheel mark, possible slip card, and blank error cards, no readable text.',
      'data-reliability-check',
      'misconception',
    ),
    evidenceSlide(
      'Mini-Case Interpretation',
      ['A cart traveled farther than expected.', 'Choose likely cause: size, slip, or error.', 'Use one measured quantity.', 'Use one angular quantity.', 'Add one reliability caution.'],
      'Use this independent check. The response must include one measured quantity, one angular quantity, and one reliability caution.',
      'A high-resolution realistic classroom mini-case slip with wheel, ruler, data table, possible error cards, and pencil, no readable text.',
      'mini-case-interpretation',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Wheel Size and Distance',
      ['Same turns can travel different distances.', 'Wheel size changes distance per turn.', 'Diameter or radius supports the reason.', 'Conditions and limits matter.'],
      'Bridge from Session 2 by asking whether two wheels with the same number of turns must travel the same distance.',
      'A high-resolution realistic classroom wheel-size comparison setup with small and large wheels, parallel lanes, measuring tape, and blank comparison table, no readable text.',
      'wheel-size-comparison',
      'overview',
    ),
    evidenceSlide(
      'Same Turns, Different Wheels Prompt',
      ['1. Compare the two wheel sizes.', '2. Predict which travels farther.', '3. Give a reason before testing.', '4. Name what must stay fair.'],
      'This is the connect-and-diagnose task. Ask: What is the same in the two cases? What is different? Which feature might change distance?',
      'A high-resolution realistic classroom prompt with small lid, large wheel, one-turn lanes, prediction cards, ruler, and blank comparison table, no readable text.',
      'same-turns-different-wheels-prompt',
      'situation',
    ),
    evidenceSlide(
      'Wheel-Size Comparison Trial',
      ['1. Test the small wheel for one turn.', '2. Test the large wheel for one turn.', '3. Measure both distances.', '4. Record wheel size evidence.', '5. Note any slipping.'],
      'This slide starts the main activity. Groups or the teacher-front demonstrator test two wheel sizes for one full turn. Output: wheel-size comparison table.',
      'A high-resolution realistic classroom wheel-size trial with small wheel lane, large wheel lane, one-turn markers, tape measure, and blank table, no readable text.',
      'wheel-size-comparison-trial',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Wheel-Size Table',
      ['Small-wheel distance is recorded.', 'Large-wheel distance is recorded.', 'Size evidence is included.', 'Fair-test condition is stated.', 'Slipping or error is noted.'],
      'Make the output criteria explicit. Learners must connect distance to wheel size before using any formula or estimate.',
      'A high-resolution realistic classroom wheel-size comparison table beside small and large wheels, ruler, and fair-test note cards, no readable text.',
      'wheel-size-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Wheel-Size Trial',
      ['Wheel handler: roll one turn only.', 'Marker: set start and end marks.', 'Measurer: compare distances.', 'Recorder: note size evidence.', 'Safety lead: clear the lane.'],
      'Recommended pacing: 5 minutes prediction, 15 minutes comparison trial, 12 minutes relationship talk, 12 minutes model revision, 6 minutes design choice.',
      'A high-resolution realistic classroom wheel-size trial station with role cards, two wheels, tape lanes, ruler, blank table, and safety cards, no readable text.',
      'wheel-size-roles',
      'activity',
    ),
    evidenceSlide(
      'Circumference Relationship Talk',
      ['Circle the larger one-turn distance.', 'Use radius or diameter in the reason.', 'Complete: larger wheel usually ___.', 'Question: what condition must be true?'],
      'This is the make-meaning task. Ask: Why does rim length matter? What condition must be true? How could slipping weaken the evidence?',
      'A high-resolution realistic classroom circumference model with string around a wheel, straightened string beside ruler, two wheel sizes, and blank relationship cards, no readable text.',
      'circumference-relationship-talk',
      'discussion',
    ),
    evidenceSlide(
      'Motion Relationship Diagram 2.0',
      ['Add radius or diameter.', 'Show one-turn distance.', 'Show number of turns.', 'Add a slipping or error caution.', 'Revise one weak label.'],
      'This is the guided modeling task. Learners revise the Session 2 model by adding wheel size, distance per turn, and a condition or limitation.',
      'A high-resolution realistic classroom relationship diagram revision station with wheel models, string, ruler, blank diagram sheet, checklist cards, and pencils, no readable text.',
      'motion-relationship-diagram-2-0',
      'model',
    ),
    evidenceSlide(
      'Slipping and Measurement Limits',
      ['Same turns is not enough evidence.', 'Wheel size changes the path distance.', 'Slipping can weaken the pattern.', 'Measurement error can change the claim.'],
      'Use this misconception repair before design choice. Ask: Which evidence shows the relationship, and which limit makes the claim less certain?',
      'A high-resolution realistic classroom comparison with two wheel lanes, slip-warning card, ruler, start and end tape marks, and blank correction cards, no readable text.',
      'slipping-measurement-limits',
      'misconception',
    ),
    evidenceSlide(
      'Design Choice Justification',
      ['Choose small or large wheel.', 'Name the device context.', 'Use turns, distance, and wheel size.', 'Add safety, control, surface, or load.', 'State one trade-off.'],
      'Use this independent check. The response must mention turns, distance, wheel size, and one practical concern such as control, safety, surface, or load.',
      'A high-resolution realistic classroom design choice station with handcart or wheelchair wheel card, small and large wheel models, decision card, ruler, and pencil, no readable text.',
      'design-choice-justification',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Motion Explainer',
      ['Strong evidence supports the claim.', 'Device parts must match motion types.', 'A benefit must be real-life.', 'A recommendation must be safe or efficient.'],
      'Bridge by reviewing one strongest evidence point from Sessions 1-3. Ask what evidence connects best to a device recommendation.',
      'A high-resolution realistic classroom device audit setup with device photo cards, wheel model, blank audit table, sticky notes, and final explainer sheet, no readable text.',
      'device-motion-audit',
      'overview',
    ),
    evidenceSlide(
      'Best Evidence Selection',
      ['Choose one sort card or data table.', 'Choose one model or diagram.', 'Name the device it supports.', 'Explain why this evidence is strongest.'],
      'This is the connect-and-diagnose task. Ask: Which evidence is strongest? Which motion does it prove? What quality-of-life benefit will your explainer make clear?',
      'A high-resolution realistic classroom evidence-selection station with motion sort card, distance-turn table, wheel-size diagram, and blank selection slip, no readable text.',
      'best-evidence-selection',
      'situation',
    ),
    evidenceSlide(
      'Device Motion Audit',
      ['1. Choose one teacher-approved device.', '2. Record the moving parts.', '3. Classify translation and rotation.', '4. Explain one benefit.', '5. Add one safety or efficiency issue.'],
      'This slide starts the main activity. Learners inspect a teacher-approved device photo or classroom object. Output: device audit table.',
      'A high-resolution realistic classroom device motion audit station with bicycle, fan, wheelchair, handcart, office chair wheel, conveyor cards, and blank audit table, no readable text.',
      'device-motion-audit-main',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Device Audit Table',
      ['Moving parts are identified.', 'Translation and rotation are both checked.', 'Linear or angular evidence is included.', 'Benefit is clear.', 'Safety or efficiency issue is realistic.'],
      'Make the output criteria explicit. The audit must include evidence, not only a description of the device.',
      'A high-resolution realistic classroom audit table beside device photo cards, marked wheel model, ruler, sticky notes, and pencil, no readable text.',
      'device-audit-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Safety: Device Audit',
      ['Device reader: inspect only approved photos or objects.', 'Motion checker: name moving parts.', 'Evidence keeper: cite data or model.', 'Benefit writer: connect to real life.', 'Safety lead: do not operate devices.'],
      'Recommended pacing: 5 minutes evidence choice, 15 minutes audit, 12 minutes peer conference, 12 minutes explainer build, 6 minutes defense ticket.',
      'A high-resolution realistic classroom device audit role station with photo cards, wheel model, audit sheets, safety cards, and colored pencils, no readable text.',
      'device-audit-roles',
      'activity',
    ),
    evidenceSlide(
      'Evidence-to-Recommendation Conference',
      ['Ask one question about evidence.', 'Ask one question about quantity.', 'Ask one question about safety or efficiency.', 'Revise one weak sentence.'],
      'This is the make-meaning task. Ask: Is the recommendation based on evidence or preference? Which quantity supports it? What limitation should the user remember?',
      'A high-resolution realistic classroom peer conference setup with device card, wheel model, peer note sheets, recommendation card, ruler, and sticky notes, no readable text.',
      'evidence-to-recommendation-conference',
      'discussion',
    ),
    evidenceSlide(
      'Motion Explainer Build',
      ['Box 1: labeled device diagram.', 'Box 2: evidence from the week.', 'Box 3: quality-of-life benefit.', 'Box 4: safe or efficient recommendation.', 'Add one limitation.'],
      'This is the guided output build. Learners create a one-page physics-in-life motion explainer with the four required parts from the lesson plan.',
      'A high-resolution realistic classroom one-page motion explainer template with four blank boxes, device diagram placeholder, evidence card, benefit card, recommendation card, and wheel model, no readable text.',
      'motion-explainer-build',
      'model',
    ),
    evidenceSlide(
      'Rotation and Forward Motion Are Related',
      ['A wheel can turn and move forward.', 'Linear evidence shows path distance.', 'Angular evidence shows turns.', 'The relationship needs conditions.'],
      'Use this misconception repair before the defense ticket. The final submission must correct the idea that rotating and moving forward are unrelated.',
      'A high-resolution realistic classroom correction setup with marked wheel, path line, ruler, turn cards, distance cards, and blank misconception cards, no readable text.',
      'rotation-forward-motion-related',
      'misconception',
    ),
    evidenceSlide(
      'Gallery Defense Ticket',
      ['Defend your strongest evidence.', 'Explain the motion relationship.', 'Name one limitation.', 'State the safety or efficiency decision.', 'Revise one sentence after peer feedback.'],
      'Use this independent check. Final submission must compare translational and rotational motion, use linear or angular evidence, and recommend safe or efficient device use.',
      'A high-resolution realistic classroom gallery defense station with final explainer sheet, peer rubric, defense ticket, device cards, wheel model, and pencils, no readable text.',
      'gallery-defense-ticket',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Motion Evidence Path",
      ['Sort daily devices.', 'Trace the cart path.', 'Count wheel turns.', 'Map benefit and risk.', 'Defend one CER claim.'],
      'Use this as the pacing guide. Keep the session anchored in visible path evidence, turning evidence, and quality-of-life transfer.',
      'A high-resolution realistic classroom activity path with motion sort cards, cart-and-wheel demo, device-benefit map, two-motion diagram, and CER slip, no readable text.',
      'today-s-motion-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Distance-Turn Evidence Path",
      ['Predict one-turn distance.', 'Measure one and two turns.', 'Match vocabulary to data.', 'Model the relationship.', 'Interpret a new case.'],
      'Use this as the pacing guide. Learners should connect distance and turns through evidence, not memorize terms separately.',
      'A high-resolution realistic classroom activity path with prediction note, one-turn rolling lane, data table, vocabulary cards, model sheet, and mini-case slip, no readable text.',
      'today-s-distance-turn-evidence-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Wheel-Size Evidence Path",
      ['Predict same-turn results.', 'Compare two wheel sizes.', 'Discuss circumference evidence.', 'Revise the model.', 'Justify a design choice.'],
      'Use this as the pacing guide. Learners should explain why angular quantity alone is not enough without wheel size or conditions.',
      'A high-resolution realistic classroom activity path with small and large wheels, tape lanes, comparison table, circumference string model, and design-choice card, no readable text.',
      'today-s-wheel-size-evidence-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Device Explainer Path",
      ['Select strongest evidence.', 'Audit one approved device.', 'Conference with a peer.', 'Build the explainer.', 'Defend the recommendation.'],
      'Use this as the pacing guide. The product must require motion comparison, quantity evidence, real benefit, recommendation, and limitation.',
      'A high-resolution realistic classroom activity path with evidence cards, device audit table, peer conference notes, one-page explainer template, and defense ticket, no readable text.',
      'today-s-device-explainer-path',
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
  ...generalScienceMotionBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const motionSignals = [
  'physics in daily life',
  'quality of life',
  'translational motion',
  'rotational motion',
  'linear quantity',
  'angular quantity',
  'linear distance',
  'angular turns',
  'wheel size',
  'radius',
  'diameter',
  'circumference',
  'rolling object',
  'cart',
  'wheel',
  'motion explainer',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableGeneralScienceMotionLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasScienceContext = /\bgeneral science\b/.test(normalized) || /\bgrade\s*11\b/.test(normalized);
  const score = motionSignals.reduce((count, signal) => (
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
  ...generalScienceMotionBlueprint,
  smartObjectives: [...generalScienceMotionBlueprint.smartObjectives],
  studentFacingObjectives: [...generalScienceMotionBlueprint.studentFacingObjectives],
  days: generalScienceMotionBlueprint.days.map((day) => ({ ...day })),
});

const motionMainActivityByDayNumber: Record<number, string> = {
  1: 'Cart-and-Wheel Evidence Demo',
  2: 'One-Turn Rolling Trial',
  3: 'Wheel-Size Comparison Trial',
  4: 'Device Motion Audit',
};

export const validateGeneralScienceMotionK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: generalScienceMotionBlueprint.subject,
    gradeLevel: generalScienceMotionBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: motionMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 82,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: true,
  });
};

export const getGeneralScienceMotionK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getGeneralScienceMotionK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  const qualityResult = validateGeneralScienceMotionK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('General science motion reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getGeneralScienceMotionK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
