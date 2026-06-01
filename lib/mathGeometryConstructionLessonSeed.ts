import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const MATH_GEOMETRY_CONSTRUCTION_TOPIC = 'Geometric Objects, Notation, and Line Construction';
const MATH_GEOMETRY_CONSTRUCTION_COMPETENCY = 'Illustrate and describe points, lines, rays, line segments, angles, and planes using geometric notations. Construct perpendicular and parallel lines.';

const MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES = [
  'By the end of Session 1, learners identify points, lines, rays, line segments, angles, and planes, illustrate them using correct geometric notations, and explain what each notation communicates in a diagram.',
  'By the end of Session 2, learners identify the given line and point, construct a perpendicular line through a point on or off a line, and justify the construction using equal-distance and right-angle reasoning.',
  'By the end of Session 3, learners identify a given line and external point, construct a line parallel to the given line, and justify the construction using copied-angle or perpendicular-line reasoning.',
  'By the end of Session 4, learners identify required geometric objects, construct perpendicular or parallel lines, and defend the accuracy of a labeled construction report.',
];

const mathGeometryConstructionBlueprint: LessonBlueprint = {
  mainTitle: 'Geometric Objects, Notation, and Line Construction',
  planUnitLabel: 'Session',
  subject: 'Mathematics',
  gradeLevel: 'Grade 9',
  quarter: 'First Term',
  learningCompetency: MATH_GEOMETRY_CONSTRUCTION_COMPETENCY,
  smartObjectives: [...MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES],
  studentFacingObjectives: [...MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Geometry Objects and Notation Evidence',
      focus: 'Learners connect diagram evidence, object names, notation, and verbal meanings before construction work.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Perpendicular Construction Evidence',
      focus: 'Learners construct perpendicular lines and justify accuracy using equal-distance arcs and right-angle evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Parallel Construction Evidence',
      focus: 'Learners construct parallel lines and justify accuracy using copied-angle or perpendicular-line reasoning.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Construction Report and Defense',
      focus: 'Learners synthesize notation and construction by drawing, labeling, checking, and justifying a construction report.',
      generationStatus: 'pending',
    },
  ],
};

const mathMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Mathematics',
  topic: MATH_GEOMETRY_CONSTRUCTION_TOPIC,
  gradeLevel: 'Grade 9',
  gradeBand: '7-10',
  learningCompetency: MATH_GEOMETRY_CONSTRUCTION_COMPETENCY,
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
    mathGeometryConstructionBlueprint.mainTitle,
    ['Subject: Mathematics', 'Grade Level: Grade 9', 'Term: First Term', 'Week focus: notation and construction evidence'],
    'Introduce the week as a precision arc: read diagram evidence, use correct notation, construct perpendicular and parallel lines, then defend a labeled construction report.',
    'HD precise geometry workspace with notation cards, points, lines, rays, segments, angle marks, compass arcs, perpendicular and parallel construction evidence.',
    'math-geometry-construction',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Read diagram evidence.', 'Write correct geometric notation.', 'Construct perpendicular and parallel lines.', 'Defend construction accuracy with visible marks.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${mathGeometryConstructionBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD precise geometry roadmap showing notation sort, perpendicular equal-arc construction, copied-angle parallel construction, and construction report checklist.',
    'math-geometry-construction-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Geometers',
    ['Point to evidence before naming.', 'Leave construction marks visible.', 'Label every final object.', 'Justify with marks, not appearance.'],
    'Set the classroom norm. Emphasize that neat freehand drawings are not enough; geometric work needs visible evidence and correct notation.',
    'HD precise geometry workspace with compass, straightedge, labeled diagrams, visible arcs, right-angle mark, and justification frame.',
    'math-geometry-construction-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES[0],
    studentGoals: ['Identify geometric objects', 'Match notation to diagram evidence', 'Explain what notation communicates'],
    question: 'What does each geometric symbol tell us?',
    evidence: 'Sorted cards, annotated model diagram, notation match sheet, mini geometry dictionary, and exit diagram',
    output: 'Sorted card list, annotated model diagram, notation match sheet, mini geometry dictionary, and notation error exit diagram',
  },
  2: {
    objective: MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES[1],
    studentGoals: ['Identify the given line and point', 'Construct perpendicular lines', 'Justify using equal-distance and right-angle evidence'],
    question: 'What evidence proves perpendicular?',
    evidence: 'Perpendicular evidence note, equal-arc trace, guided construction, off-line construction, and repair exit',
    output: 'Evidence check note, annotated construction trace, guided construction sheet, off-line construction, repaired construction, and exit construction',
  },
  3: {
    objective: MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES[2],
    studentGoals: ['Identify the given line and external point', 'Construct a parallel line', 'Justify using copied-angle or perpendicular reasoning'],
    question: 'What proves lines are parallel?',
    evidence: 'Parallel evidence sort, copied-angle trace, guided parallel construction, method comparison note, and repair exit',
    output: 'Parallel evidence note, annotated copied-angle trace, guided parallel construction, method comparison note, repaired example, and exit construction',
  },
  4: {
    objective: MATH_GEOMETRY_CONSTRUCTION_OBJECTIVES[3],
    studentGoals: ['Choose the required construction method', 'Construct and label final objects', 'Defend accuracy with visible evidence'],
    question: 'What evidence makes a construction convincing?',
    evidence: 'Readiness grid, report walkthrough, construction plan, construction report, peer audit, and transfer response',
    output: 'Readiness grid, annotated report model, construction plan, completed construction report, peer audit note, and transfer response',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'What Does Each Geometry Symbol Tell Us?',
      ['Inspect the diagram card.', 'Name the visible evidence.', 'Choose the object name.', 'Output: sorted card list.'],
      `Use this opener before notation instruction. Exact lesson-plan objective: ${structure.objective}. Ask: What object is shown, what visual clue helped, and what notation might match?`,
      'HD precise geometry symbol sort visual with point, line, ray, segment, angle, and plane cards.',
      'geometry-symbol-sort',
      'situation',
    ),
    2: evidenceSlide(
      'What Evidence Proves Perpendicular?',
      ['Inspect three drawn crosses.', 'Classify proved or possible.', 'Name the missing evidence.', 'Output: evidence check note.'],
      `Use this opener before construction. Exact lesson-plan objective: ${structure.objective}. Ask: What makes a right angle, what is visible, and what evidence is missing?`,
      'HD precise perpendicular evidence check visual with proved perpendicular, visually possible, and not perpendicular sketches.',
      'perpendicular-evidence-check',
      'situation',
    ),
    3: evidenceSlide(
      'What Proves Lines Are Parallel?',
      ['Inspect four line-pair sketches.', 'Classify by evidence.', 'Name what proof is needed.', 'Output: parallel evidence note.'],
      `Use this opener before copied-angle construction. Exact lesson-plan objective: ${structure.objective}. Ask: What proves parallelism beyond looking the same direction?`,
      'HD precise parallel evidence sort visual with parallel evidence, not enough evidence, and not parallel line-pair sketches.',
      'parallel-evidence-sort',
      'situation',
    ),
    4: evidenceSlide(
      'What Evidence Makes a Construction Convincing?',
      ['Rate your construction readiness.', 'Choose one support card.', 'Name the evidence you need.', 'Output: readiness grid.'],
      `Use this opener before the report task. Exact lesson-plan objective: ${structure.objective}. Ask: Which skill is strongest, which needs support, and what evidence will show readiness?`,
      'HD precise construction readiness grid visual with notation, compass control, perpendicular, parallel, and justification support cards.',
      'construction-readiness-grid',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Object, Symbol, Meaning',
      ['Diagram evidence comes first.', 'Notation names the exact object.', 'A wrong symbol changes meaning.', 'Explanations must cite the visible clue.'],
      'Bridge from familiar drawings to mathematical notation. Ask learners which diagram features are evidence: endpoints, arrows, vertices, and plane labels.',
      'HD precise geometry overview visual with notation evidence, endpoints, arrows, vertices, and line versus segment comparison.',
      'notation-evidence-goal',
      'overview',
    ),
    evidenceSlide(
      'Geometry Symbol Sort',
      ['1. Inspect six diagram cards.', '2. Classify each object.', '3. Mark one unsure card.', '4. Predict the notation that might match.'],
      'This is the connect-and-diagnose task. Use unsure cards to identify confusion between line, ray, segment, angle, and plane.',
      'HD precise geometry symbol sort visual with point, line, ray, segment, angle, and plane examples.',
      'geometry-symbol-sort',
      'situation',
    ),
    evidenceSlide(
      'Diagram Evidence Mark-Up',
      ['1. Circle endpoints.', '2. Trace arrows.', '3. Mark angle vertices.', '4. Box plane labels.', '5. Record the matching notation.'],
      'This is the worked model. Teacher models one diagram while learners mark evidence before naming or writing notation.',
      'HD precise diagram evidence mark-up visual with endpoints, arrows, vertices, plane labels, and notation notes table.',
      'diagram-evidence-mark-up',
      'model',
    ),
    evidenceSlide(
      'Notation Match Lab',
      ['1. Annotate each diagram.', '2. Write the correct notation.', '3. Compare a tempting wrong notation.', '4. Explain why the wrong notation fails.'],
      'This is the main paired activity. Output is a notation match sheet where each answer cites endpoint, arrow, vertex, or plane evidence.',
      'HD precise notation match lab visual comparing correct ray notation against a tempting line notation error.',
      'notation-match-lab',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Notation Match Sheet',
      ['Object name is correct.', 'Notation matches the diagram.', 'Evidence clue is cited.', 'One tempting notation is rejected.', 'Explanation uses geometry language.'],
      'Make criteria explicit before dictionary work. Learners must justify notation rather than only copy symbols.',
      'HD precise notation match sheet output visual with object, evidence, notation, and error-rejection fields.',
      'notation-match-sheet-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Diagram Checks',
      ['Evidence finder points to marks.', 'Notation writer records symbols.', 'Skeptic tests a wrong notation.', 'Explainer states the meaning.', 'Reviewer checks labels.'],
      'Recommended pacing: 5 minutes sort, 10 minutes mark-up, 15 minutes notation lab, 10 minutes dictionary, 10 minutes exit diagram.',
      'HD precise geometry card station with notation cards, diagram evidence marks, and team role labels.',
      'team-roles-diagram-checks',
      'activity',
    ),
    evidenceSlide(
      'Geometry Dictionary Build',
      ['Draw one valid example.', 'Draw one non-example.', 'Label both carefully.', 'Write a short meaning note.'],
      'This is the representation task. Ask: What makes the valid example work, and what makes the non-example fail?',
      'HD precise geometry dictionary build visual with line, ray, and segment examples and non-examples.',
      'geometry-dictionary-build',
      'discussion',
    ),
    evidenceSlide(
      'Ray, Segment, and Line Are Not Interchangeable',
      ['A ray has one endpoint.', 'A segment has two endpoints.', 'A line extends both ways.', 'Notation must preserve that meaning.'],
      'Use this misconception repair before the exit diagram. Ask learners to point to the exact evidence that separates the objects.',
      'HD precise line ray segment comparison visual with endpoints, arrows, and notation meaning notes.',
      'ray-segment-line-not-interchangeable',
      'misconception',
    ),
    evidenceSlide(
      'Notation Error Exit',
      ['Correct two flawed notations.', 'Label one new diagram.', 'Use six correct notations.', 'Explain one repair with evidence.'],
      'Use this independent check. Look for object name, notation, and one explanation sentence tied to visible diagram evidence.',
      'HD precise notation error exit visual with flawed notation, repair fields, and evidence prompt.',
      'notation-error-exit',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Perpendicular Construction',
      ['A right angle must be proved.', 'Equal arcs create reliable points.', 'Visible marks support accuracy.', 'A justification explains why it works.'],
      'Bridge from notation to construction. Ask why drawing by eye is weaker than leaving equal-arc evidence visible.',
      'HD precise perpendicular construction overview with equal arcs, given line, given point, final perpendicular, and right-angle mark.',
      'perpendicular-construction-goal',
      'overview',
    ),
    evidenceSlide(
      'Perpendicular Evidence Check',
      ['1. Inspect three drawn crosses.', '2. Classify each as proved or possible.', '3. Name missing evidence.', '4. Explain why appearance is not proof.'],
      'This is the connect-and-diagnose task. Confirm learners distinguish a visually neat cross from a proven perpendicular.',
      'HD precise perpendicular evidence check visual with proved perpendicular, looks possible, and not perpendicular sketches.',
      'perpendicular-evidence-check',
      'situation',
    ),
    evidenceSlide(
      'Equal-Arc Construction Trace',
      ['1. Identify the given line and point.', '2. Trace equal arcs.', '3. Mark the intersection points.', '4. Draw the final line.', '5. Label the right angle.'],
      'This is the worked example. Teacher demonstrates constructing a perpendicular through a point on a line while learners trace and label why equal arcs matter.',
      'HD precise equal-arc construction trace visual with given line, point P, equal arcs, construction points, final perpendicular, and right-angle mark.',
      'equal-arc-construction-trace',
      'model',
    ),
    evidenceSlide(
      'Perpendicular Step Check',
      ['1. Construct equal arcs from the point.', '2. Mark arc intersections.', '3. Draw through the required points.', '4. Label the right angle.', '5. Explain why the line is perpendicular.'],
      'This is the main guided construction. Partners verify each checkpoint before moving to the next step.',
      'HD precise perpendicular step check visual with construction workspace and checkpoint list.',
      'perpendicular-step-check',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Guided Construction Sheet',
      ['Given line and point are labeled.', 'Equal arcs are visible.', 'Intersection points are marked.', 'Final line is drawn accurately.', 'Right angle is labeled.'],
      'Make criteria explicit before the off-line construction. Learners should not erase construction marks.',
      'HD precise guided construction sheet output visual with visible equal arcs, final perpendicular line, and right-angle label.',
      'guided-construction-sheet-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Compass Safety',
      ['Compass user controls radius.', 'Straightedge user draws final line.', 'Checkpoint reader verifies steps.', 'Labeler marks evidence.', 'Safety lead keeps compass flat.'],
      'Recommended pacing: 5 minutes evidence check, 10 minutes trace, 15 minutes step check, 10 minutes off-line point, 10 minutes repair exit.',
      'HD precise compass and straightedge construction station with equal arcs, tool safety card, and role labels.',
      'team-roles-compass-safety',
      'activity',
    ),
    evidenceSlide(
      'Off-Line Point Construction',
      ['Locate the external point.', 'Use arcs to find construction points.', 'Draw through the correct points.', 'Write a two-sentence justification.'],
      'This is the transfer construction. Ask: How is this point different, what arcs locate the line, and why is the result perpendicular?',
      'HD precise off-line point construction visual with line l, external point P, equal-distance arcs, final perpendicular, and justification notes.',
      'off-line-point-construction',
      'discussion',
    ),
    evidenceSlide(
      'Not Drawn by Sight',
      ['Freehand can look correct.', 'Equal-radius marks show control.', 'Right-angle labels need evidence.', 'Construction marks make the claim reliable.'],
      'Use this misconception repair before the exit construction. Ask: Which visible mark makes your construction stronger than a freehand drawing?',
      'HD precise comparison visual showing freehand-looking cross versus construction with equal arcs and right-angle mark.',
      'not-drawn-by-sight',
      'misconception',
    ),
    evidenceSlide(
      'Construction Repair Exit',
      ['Identify one failed step.', 'Repair the construction.', 'Complete one short perpendicular construction.', 'Write why it is reliable.'],
      'Use this independent check. Look for correct repair, visible arcs, right-angle mark, and a reliability statement.',
      'HD precise construction repair exit visual with flawed perpendicular construction and repaired construction with right-angle evidence.',
      'construction-repair-exit',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Parallel Construction',
      ['Parallel lines need evidence.', 'Copied angles preserve direction.', 'Two perpendiculars can also justify parallelism.', 'A final line must be checked.'],
      'Bridge from perpendicular reasoning to parallel construction. Ask what evidence proves the lines remain the same distance apart or preserve angle relationships.',
      'HD precise parallel construction overview with copied-angle trace, parallel line, transversal, and equal-angle marks.',
      'parallel-construction-goal',
      'overview',
    ),
    evidenceSlide(
      'Parallel Evidence Sort',
      ['1. Inspect line-pair sketches.', '2. Classify parallel, not parallel, or not enough evidence.', '3. Name the proof needed.', '4. Explain one decision.'],
      'This is the connect-and-diagnose task. Confirm learners do not rely only on visual sameness.',
      'HD precise parallel evidence sort visual with evidence-based parallel, not enough evidence, and not parallel sketches.',
      'parallel-evidence-sort',
      'situation',
    ),
    evidenceSlide(
      'Copied-Angle Construction Trace',
      ['1. Identify the given line and external point.', '2. Draw the transversal.', '3. Copy the arc radius.', '4. Transfer the chord.', '5. Draw the new line.'],
      'This is the worked example. Teacher constructs a parallel line through a point by copying a corresponding angle while learners annotate each mark.',
      'HD precise copied-angle construction trace visual with transversal, copied arc, transferred chord, external point, and new parallel line.',
      'copied-angle-construction-trace',
      'model',
    ),
    evidenceSlide(
      'Parallel Step Check',
      ['1. Construct the transversal.', '2. Copy the angle marks.', '3. Transfer the chord accurately.', '4. Draw the final line through the point.', '5. Label equal corresponding angles.'],
      'This is the main guided parallel construction. Partners verify arc radius, chord transfer, and final line placement.',
      'HD precise parallel step check visual with construction workspace and copied-angle checkpoints.',
      'parallel-step-check',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Guided Parallel Construction',
      ['Given line and point are labeled.', 'Transversal is visible.', 'Copied arcs are visible.', 'Final line passes through the point.', 'Equal angles are labeled.'],
      'Make criteria explicit before method comparison. Learners should point to the evidence for parallelism.',
      'HD precise guided parallel construction output visual with line, point, copied arcs, final parallel line, and equal angle labels.',
      'guided-parallel-construction-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Arc Transfer Checks',
      ['Compass user keeps radius.', 'Chord checker verifies transfer.', 'Straightedge user draws the final line.', 'Labeler marks corresponding angles.', 'Explainer states the guarantee.'],
      'Recommended pacing: 5 minutes evidence sort, 10 minutes trace, 15 minutes step check, 10 minutes method compare, 10 minutes repair exit.',
      'HD precise parallel construction station with copied-angle marks, compass, straightedge, and team role labels.',
      'team-roles-arc-transfer-checks',
      'activity',
    ),
    evidenceSlide(
      'Two-Method Parallel Compare',
      ['Compare copied-angle construction.', 'Compare two-perpendicular construction.', 'Name what proves parallel.', 'Explain what would make each method fail.'],
      'This is the method comparison task. Ask: Which method did you use, what relationship proves parallel, and what step must be controlled?',
      'HD precise two-method parallel compare visual showing copied-angle method and two-perpendicular method side by side.',
      'two-method-parallel-compare',
      'discussion',
    ),
    evidenceSlide(
      'Same Direction Is Not Enough',
      ['Lines can look parallel but fail.', 'Copied angles provide evidence.', 'Perpendicular relationships provide evidence.', 'Justification must name the relationship.'],
      'Use this misconception repair before the exit construction. Ask: What evidence proves the final line, not just its appearance?',
      'HD precise parallel evidence warning visual contrasting visual guess with copied-angle evidence.',
      'same-direction-is-not-enough',
      'misconception',
    ),
    evidenceSlide(
      'Parallel Repair Exit',
      ['Identify one construction error.', 'Repair the angle copy or line placement.', 'Complete one independent parallel construction.', 'Write the evidence for parallelism.'],
      'Use this independent check. Look for corrected construction marks, final line through the point, and a clear written justification.',
      'HD precise parallel repair exit visual with flawed copied-angle construction and repaired parallel construction.',
      'parallel-repair-exit',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Construction Report',
      ['A report starts with givens.', 'Final objects need labels.', 'Construction marks stay visible.', 'A defense names why the result works.'],
      'Bridge from separate construction skills to a complete report. Ask what evidence makes a construction convincing to another learner.',
      'HD precise construction report overview with givens, visible marks, labels, and justification frame.',
      'construction-report-goal',
      'overview',
    ),
    evidenceSlide(
      'Construction Readiness Grid',
      ['1. Rate notation readiness.', '2. Rate compass control.', '3. Rate perpendicular and parallel steps.', '4. Choose one support card.'],
      'This is the connect-and-diagnose task. Group learners by needed support before the performance task.',
      'HD precise construction readiness grid visual with self-check table and support cards.',
      'construction-readiness-grid',
      'situation',
    ),
    evidenceSlide(
      'Construction Report Walkthrough',
      ['1. Identify the given information.', '2. Label visible construction marks.', '3. Name the final object.', '4. Read the accuracy reason.'],
      'This is the worked report model. Learners label given information, construction marks, final object, notation labels, and accuracy reason.',
      'HD precise construction report walkthrough visual with sample report, perpendicular construction, visible arcs, labels, and report checklist.',
      'construction-report-walkthrough',
      'model',
    ),
    evidenceSlide(
      'Report Planning Conference',
      ['1. Decide perpendicular or parallel.', '2. List the required labels.', '3. Choose the construction method.', '4. State the justification route.'],
      'This is the planning checkpoint. Teacher approves method choice before learners use tools.',
      'HD precise report planning conference visual with construction plan fields and method decision cards.',
      'report-planning-conference',
      'activity',
    ),
    evidenceSlide(
      'Geometry Construction Report',
      ['1. Construct the required line relationship.', '2. Keep arcs and marks visible.', '3. Label all geometric objects.', '4. Write a concise justification.', '5. Revise one weak part.'],
      'This is the main performance task. Output is a completed construction report with visible arcs, correct notation, and justification tied to evidence.',
      'HD precise geometry construction report visual with construction panel, visible marks, final line, labels, and justification frame.',
      'geometry-construction-report',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Construction Report',
      ['Given information is clear.', 'Construction marks are visible.', 'Final object is labeled.', 'Notation is correct.', 'Justification cites evidence.'],
      'Make criteria explicit before peer review. Learners should show why the construction satisfies the required line relationship.',
      'HD precise construction report output visual with givens, construction marks, final labels, notation, and justification checklist.',
      'construction-report-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Report Checks',
      ['Method checker confirms the task.', 'Tool user constructs accurately.', 'Labeler writes notation.', 'Auditor checks marks.', 'Defender prepares the reason.'],
      'Recommended pacing: 5 minutes readiness grid, 10 minutes walkthrough, 10 minutes planning, 17 minutes report build, 8 minutes peer audit and transfer.',
      'HD precise construction report team station with compass, straightedge, notation anchor, report template, and role labels.',
      'team-roles-report-checks',
      'activity',
    ),
    evidenceSlide(
      'Peer Audit and Transfer Exit',
      ['Check one notation label.', 'Check one visible construction mark.', 'Check one justification sentence.', 'Suggest one revision.', 'Answer the transfer prompt.'],
      'This is the peer-review and independent transfer task. Learners revise based on evidence, then answer why construction evidence is stronger than freehand drawing.',
      'HD precise peer audit and transfer exit visual with checklist and transfer prompt about construction evidence versus freehand drawing.',
      'peer-audit-and-transfer-exit',
      'discussion',
    ),
    evidenceSlide(
      'Neat Is Not the Same as Proven',
      ['Neat lines can still be wrong.', 'Missing marks weaken the report.', 'Unclear notation changes meaning.', 'A strong defense cites construction evidence.'],
      'Use this final misconception repair. Ask: What revision made the report more mathematically convincing?',
      'HD precise construction report warning visual comparing a neat unlabeled drawing with a labeled construction report with visible marks.',
      'neat-is-not-the-same-as-proven',
      'misconception',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Notation Evidence Path",
      ['Sort geometry symbols.', 'Mark diagram evidence.', 'Match notation to diagrams.', 'Build a mini dictionary.', 'Repair notation errors.'],
      'Use this as the pacing guide. Keep learners pointing to visible evidence before writing notation.',
      'HD precise activity path visual with geometry symbol sort, diagram markup, notation match lab, dictionary build, and notation error exit.',
      'today-s-notation-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Perpendicular Evidence Path",
      ['Classify right-angle evidence.', 'Trace equal arcs.', 'Construct with checkpoints.', 'Try an off-line point.', 'Repair a flawed construction.'],
      'Use this as the pacing guide. The core idea is that equal arcs and right-angle marks are evidence, not decoration.',
      'HD precise activity path visual with perpendicular evidence check, equal-arc trace, perpendicular step check, off-line point construction, and repair exit.',
      'today-s-perpendicular-evidence-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Parallel Evidence Path",
      ['Sort parallel evidence.', 'Trace copied angles.', 'Construct with checkpoints.', 'Compare two methods.', 'Repair a flawed parallel.'],
      'Use this as the pacing guide. Learners should name the angle or perpendicular relationship that guarantees parallelism.',
      'HD precise activity path visual with parallel evidence sort, copied-angle trace, parallel step check, two-method compare, and repair exit.',
      'today-s-parallel-evidence-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Construction Report Path",
      ['Choose a support card.', 'Study a report model.', 'Plan the method and labels.', 'Build the construction report.', 'Audit and revise.'],
      'Use this as the pacing guide. The performance task requires drawing, labels, visible marks, and a justification.',
      'HD precise activity path visual with readiness grid, report walkthrough, report planning, construction report, peer audit, and transfer exit.',
      'today-s-construction-report-path',
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
  ...mathGeometryConstructionBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const mathGeometryConstructionSignals = [
  'geometric objects',
  'geometric notations',
  'points',
  'lines',
  'rays',
  'line segments',
  'angles',
  'planes',
  'construct perpendicular',
  'construct parallel',
  'perpendicular line',
  'parallel line',
  'compass',
  'straightedge',
  'equal arcs',
  'copied angle',
  'construction report',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableMathGeometryConstructionLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasMathContext = /\bmathematics\b/.test(normalized) || /\bmath\b/.test(normalized);
  const hasGradeOrTopic = /\bgrade\s*9\b/.test(normalized)
    || normalized.includes('geometric objects')
    || normalized.includes('geometric notations')
    || normalized.includes('construct perpendicular and parallel lines');
  const score = mathGeometryConstructionSignals.reduce((count, signal) => (
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
  ...mathGeometryConstructionBlueprint,
  smartObjectives: [...mathGeometryConstructionBlueprint.smartObjectives],
  studentFacingObjectives: [...mathGeometryConstructionBlueprint.studentFacingObjectives],
  days: mathGeometryConstructionBlueprint.days.map((day) => ({ ...day })),
});

const mathMainActivityByDayNumber: Record<number, string> = {
  1: 'Notation Match Lab',
  2: 'Perpendicular Step Check',
  3: 'Parallel Step Check',
  4: 'Geometry Construction Report',
};

export const validateMathGeometryConstructionK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: mathGeometryConstructionBlueprint.subject,
    gradeLevel: mathGeometryConstructionBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mathMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 94,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getMathGeometryConstructionK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getMathGeometryConstructionK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateMathGeometryConstructionK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Math geometry construction reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getMathGeometryConstructionK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
