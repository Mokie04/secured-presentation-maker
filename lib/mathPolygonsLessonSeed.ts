import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const MATH_POLYGONS_TOPIC = 'Constructing and Describing Polygons';
const MATH_POLYGONS_COMPETENCY = 'Draw and describe regular and irregular polygons with 5, 6, 8, or 10 sides, based on measurements of sides and angles, using a ruler and protractor. Draw triangles, quadrilaterals, and regular polygons (5, 6, 8, or 10 sides) with given angle measures.';

const MATH_POLYGONS_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify valid polygons with 5, 6, 8, or 10 sides, measure their side lengths and angles, and justify whether they are regular or irregular using measurement evidence.',
  'By the end of Session 2, learners identify the given angle information, construct triangles and quadrilaterals from those measures, and verify or revise their drawings using angle labels and reasonableness checks.',
  'By the end of Session 3, learners use given side and angle measures to construct regular polygons with 5, 6, 8, or 10 sides, compare repeated measurements, and justify whether the result is regular.',
  'By the end of Session 4, learners plan, construct, measure, and classify a small polygon set, then defend each classification using side and angle evidence from their own drawings.',
];

const mathPolygonsBlueprint: LessonBlueprint = {
  mainTitle: 'Constructing and Describing Polygons',
  planUnitLabel: 'Session',
  subject: 'Mathematics',
  gradeLevel: 'Grade 7',
  quarter: 'First Term',
  learningCompetency: MATH_POLYGONS_COMPETENCY,
  smartObjectives: [...MATH_POLYGONS_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...MATH_POLYGONS_LEARNING_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Polygon Evidence and Regularity',
      focus: 'Learners sort valid polygons, measure side and angle evidence, and classify regular or irregular polygons.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Constructing From Angle Measures',
      focus: 'Learners use protractor routines to construct and verify triangles and quadrilaterals from given angles.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Constructing Regular Polygons',
      focus: 'Learners plan, construct, measure, and justify regular polygons with 5, 6, 8, or 10 sides.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Polygon Set Performance Task',
      focus: 'Learners construct a small polygon set and defend classifications using side and angle evidence.',
      generationStatus: 'pending',
    },
  ],
};

const mathMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Mathematics',
  topic: MATH_POLYGONS_TOPIC,
  gradeLevel: 'Grade 7',
  gradeBand: '7-10',
  learningCompetency: MATH_POLYGONS_COMPETENCY,
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
    mathPolygonsBlueprint.mainTitle,
    ['Subject: Mathematics', 'Grade Level: Grade 7', 'Term: First Term', 'Week focus: polygon construction evidence'],
    'Introduce the week as a measurement-evidence arc: identify polygons, construct from angles, build regular polygons, and defend a final polygon set.',
    'HD precise classroom math visual with polygon cards, ruler, protractor, side and angle measurement table, and construction workspace.',
    'math-polygons',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Sort valid polygons.', 'Measure sides and angles.', 'Construct from given measures.', 'Defend classifications with evidence.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${mathPolygonsBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD precise classroom math visual showing polygon sort cards, protractor routine, regular polygon planning grid, and evidence defense sheet.',
    'math-polygons-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Mathematicians',
    ['Name the property you tested.', 'Measure before classifying.', 'Revise drawings after checking.', 'Defend claims with side and angle evidence.'],
    'Set the classroom norm. Emphasize that a neat drawing is not enough; the classification must be supported by side and angle measurements.',
    'HD precise classroom math visual with ruler, protractor, checklist, measurement audit table, and polygon construction tools.',
    'math-polygons-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: MATH_POLYGONS_LEARNING_OBJECTIVES[0],
    studentGoals: ['Test closed figure, straight sides, and side count', 'Measure sides and angles', 'Classify regular or irregular using evidence'],
    question: 'What evidence makes a shape a polygon?',
    evidence: 'Polygon cards, side counts, ruler measurements, protractor measurements, and regularity checklist',
    output: 'Two-column sort mat, measurement table, checklist, guided pentagon construction, and exit defense',
  },
  2: {
    objective: MATH_POLYGONS_LEARNING_OBJECTIVES[1],
    studentGoals: ['Read protractor angle data correctly', 'Construct triangles and quadrilaterals', 'Verify and revise drawings'],
    question: 'How can angle data build a figure?',
    evidence: 'Tool-check strip, worked angle routine, constructed drawings, verification table, and error repair note',
    output: 'Tool-check strip, annotated routine notes, two labeled drawings, corrected sketch, and independent quadrilateral',
  },
  3: {
    objective: MATH_POLYGONS_LEARNING_OBJECTIVES[2],
    studentGoals: ['Plan repeated side and angle measures', 'Construct regular polygons', 'Justify regularity with both conditions'],
    question: 'What makes a polygon regular?',
    evidence: 'Near-regular challenge, planning grid, guided hexagon, measurement audit, and proof slip',
    output: 'Claim-evidence note, planning grid, labeled regular polygon, group construction audit, and proof slip',
  },
  4: {
    objective: MATH_POLYGONS_LEARNING_OBJECTIVES[3],
    studentGoals: ['Plan a polygon set from constraints', 'Measure and verify each drawing', 'Defend classifications with evidence'],
    question: 'How can a drawing prove its classification?',
    evidence: 'Blueprint, labeled drawings, verification table, peer audit, revision, and exit defense',
    output: 'Polygon set blueprint, constructed polygon set, verification table, peer-audit marks, revision, and evidence defense',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'What Evidence Makes a Shape a Polygon?',
      ['Look for closed figures.', 'Check for straight sides.', 'Count the sides.', 'Output: sort mat and measurement defense.'],
      `Use this opener before the sort. Exact lesson-plan objective: ${structure.objective}. Ask: Which property qualifies the figure, and what evidence would reject it?`,
      'HD precise polygon sort visual with valid and invalid shape cards, closed figure examples, open figures, curved figures, and side-count evidence.',
      'polygon-evidence',
      'situation',
    ),
    2: evidenceSlide(
      'How Can Angle Data Build a Figure?',
      ['Find the center point.', 'Choose the correct scale.', 'Draw from the given measure.', 'Output: verified construction.'],
      `Use this opener before the tool check. Exact lesson-plan objective: ${structure.objective}. Ask: Which scale should be used, and how do you know the angle is reasonable?`,
      'HD precise protractor readiness visual with baseline, center point, scale, angle ray, and tool-check strip.',
      'angle-construction',
      'situation',
    ),
    3: evidenceSlide(
      'What Makes a Polygon Regular?',
      ['Equal-looking is not enough.', 'Check repeated side lengths.', 'Check repeated angle measures.', 'Output: regularity proof slip.'],
      `Use this opener before the near-regular challenge. Exact lesson-plan objective: ${structure.objective}. Ask: What evidence changes your first impression?`,
      'HD precise regularity comparison visual with regular and irregular polygons, side evidence, angle evidence, and measurement checklist.',
      'regular-polygon-evidence',
      'situation',
    ),
    4: evidenceSlide(
      'How Can a Drawing Prove Its Classification?',
      ['Plan the constraints first.', 'Construct each figure.', 'Measure and verify.', 'Output: defended polygon set.'],
      `Use this opener before the performance task. Exact lesson-plan objective: ${structure.objective}. Ask: Which labels would make another learner agree with your classification?`,
      'HD precise polygon set blueprint visual with three construction panels, measurement labels, verification table, and defense card.',
      'polygon-set-defense',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Polygon and Regularity',
      ['Closed figure is required.', 'Sides must be straight.', 'Side count must match the name.', 'Regularity needs equal sides and equal angles.'],
      'Bridge from familiar shape names to mathematical tests. Ask learners to name one property that can be seen and one property that must be measured.',
      'HD precise overview visual with polygon samples, ruler, protractor, and measurement evidence table.',
      'polygon-evidence',
      'overview',
    ),
    evidenceSlide(
      'Polygon or Not?',
      ['1. Inspect six shape cards.', '2. Mark closed or not closed.', '3. Mark straight or curved sides.', '4. Sort into polygon or not polygon.'],
      'This is the connect-and-diagnose task. Scan for open or curved figures placed incorrectly. Ask: What evidence would reject the figure?',
      'HD precise polygon sort visual with closed straight-sided polygons and rejected open or curved figures.',
      'polygon-or-not',
      'situation',
    ),
    evidenceSlide(
      'Side-and-Angle Evidence Lab',
      ['1. Count sides on each sample.', '2. Measure selected side lengths.', '3. Measure selected angles.', '4. Record evidence in the table.', '5. Make a first classification.'],
      'This slide starts the main activity. Pairs measure a pentagon and hexagon with ruler and protractor. Output: measurement table with first classification.',
      'HD precise side-and-angle evidence lab visual with pentagon, hexagon, ruler, protractor, and blank measurement table.',
      'side-angle-evidence-lab',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Measurement Table',
      ['Side count is complete.', 'Side lengths have units.', 'Angles are measured carefully.', 'Classification cites measurement evidence.'],
      'Make the output criteria explicit before regularity discussion. Learners should not classify from appearance alone.',
      'HD precise measurement table visual with side count, side length, angle measurement, and classification evidence.',
      'measurement-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Team Roles and Tool Safety',
      ['Counter: checks side count.', 'Ruler reader: checks side length.', 'Angle reader: checks protractor alignment.', 'Recorder: writes evidence.', 'Verifier: asks what proves it.'],
      'Recommended pacing: 5 minutes sort, 11 minutes evidence lab, 10 minutes regularity board, 14 minutes guided pentagon, 10 minutes exit defense.',
      'HD precise classroom math tool station with ruler, protractor, polygon samples, role cards, and measurement table.',
      'polygon-measurement-roles',
      'activity',
    ),
    evidenceSlide(
      'Regularity Rule Board',
      ['Highlight equal measures.', 'Highlight unequal measures.', 'Build the regularity checklist.', 'Question: why is looks equal not enough?'],
      'This is the make-meaning task. Ask: Which measurements must be equal? Why do both side lengths and angles matter?',
      'HD precise regularity rule visual comparing regular and irregular polygons with side and angle evidence.',
      'regularity-rule-board',
      'discussion',
    ),
    evidenceSlide(
      'Worked Example: Pentagon Trace',
      ['Mark the first vertex.', 'Align the ruler.', 'Measure and draw the side.', 'Place the protractor center.', 'Label and verify.'],
      'This is the guided construction task. Model mark, align, measure, draw, label, and verify while learners complete one guided pentagon.',
      'HD precise pentagon construction visual with vertex dots, ruler, protractor, labels, and verification list.',
      'worked-example-pentagon-trace',
      'model',
    ),
    evidenceSlide(
      'Looks Equal Is Not Proof',
      ['Appearance can mislead.', 'Side lengths must be checked.', 'Angles must be checked.', 'Use measurements in the claim.'],
      'Use this misconception repair before the exit defense. Ask: Which measurement would make the classification stronger?',
      'HD precise regular and irregular polygon comparison visual with measurement checklist and evidence chips.',
      'looks-equal-not-proof',
      'misconception',
    ),
    evidenceSlide(
      'Two-Polygon Exit Defense',
      ['Classify two new polygons.', 'Use at least two measurements.', 'Write one evidence sentence for each.', 'Mark one thing to recheck.'],
      'Use this independent check. Sort responses into ready, minor measurement error, and needs reteach.',
      'HD precise exit defense visual with two polygon samples, measurement table, and claim-evidence sentence frame.',
      'two-polygon-exit-defense',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Construct From Angles',
      ['Angle data gives direction.', 'Tool placement controls accuracy.', 'Labels preserve the given measures.', 'Verification decides revision.'],
      'Bridge from measurement to construction. Ask learners why a correct protractor placement can matter more than a neat line.',
      'HD precise angle construction visual with protractor, baseline, angle rays, verification table, and construction routine cards.',
      'angle-construction',
      'overview',
    ),
    evidenceSlide(
      'Angle Data Readiness',
      ['1. Label the baseline.', '2. Mark the center point.', '3. Choose inner or outer scale.', '4. Measure two sample angles.'],
      'This is the connect-and-diagnose task. Confirm scale choice on one item before moving to construction.',
      'HD precise protractor readiness visual with baseline, center point, scale, and tool-check table.',
      'angle-data-readiness',
      'situation',
    ),
    evidenceSlide(
      'Build From Two Angles',
      ['1. Mark the first point.', '2. Align the protractor baseline.', '3. Measure the given angle.', '4. Draw and label the ray.', '5. Verify before the next ray.'],
      'This slide starts the modeled construction routine. Teacher constructs a triangle from given angle measures while learners annotate the process.',
      'HD precise angle construction routine visual with protractor, two rays, angle arc, and mark-align-measure-draw-label-verify cards.',
      'build-from-two-angles',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Routine Notes',
      ['Center point is identified.', 'Baseline is aligned.', 'Scale choice is reasonable.', 'Angle labels match the drawing.'],
      'Make the routine criteria explicit before pairs construct figures. Learners should point to where the protractor center belongs.',
      'HD precise protractor routine visual with annotated baseline, center point, angle scale, and routine checklist.',
      'routine-notes-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Triangle-Quadrilateral Builder',
      ['1. Read the angle task card.', '2. Draw the starting baseline.', '3. Construct each given angle.', '4. Label and measure to verify.', '5. Revise one weak angle.'],
      'This is the main paired construction task. Output: two labeled drawings plus a verification table.',
      'HD precise triangle and quadrilateral construction visual with ruler, protractor, labeled drawings, and verification table.',
      'triangle-quadrilateral-builder',
      'activity',
    ),
    evidenceSlide(
      'Wrong Scale Repair Shop',
      ['Find where the mistake began.', 'Name wrong scale or alignment.', 'Revise the sketch.', 'Write one prevention tip.'],
      'This is the error-analysis task. Ask: Where did the mistake begin? Why does the corrected angle make more sense?',
      'HD precise wrong-scale repair visual comparing flawed and corrected protractor angle constructions.',
      'wrong-scale-repair-shop',
      'discussion',
    ),
    evidenceSlide(
      'Construction Accuracy Conference',
      ['Compare labels to the task card.', 'Check one measured angle.', 'Ask if the scale choice makes sense.', 'Revise before finalizing.'],
      'Use this guided conference before independent work. Learners should explain their construction evidence aloud.',
      'HD precise verification table visual with triangle, quadrilateral, protractor, and partner-check cards.',
      'construction-accuracy-conference',
      'model',
    ),
    evidenceSlide(
      'Protractor Habits That Prevent Errors',
      ['Center point first.', 'Baseline must stay still.', 'Choose one scale and explain why.', 'Check reasonableness before drawing.'],
      'Use this misconception repair before the independent quadrilateral. Ask: Which habit prevents the error you saw?',
      'HD precise protractor habit visual with center point, baseline, scale, and angle reasonableness check.',
      'protractor-habits',
      'misconception',
    ),
    evidenceSlide(
      'Solo Quadrilateral Check',
      ['Construct one quadrilateral.', 'Label all given angles.', 'Measure one angle after drawing.', 'Write a verification sentence.'],
      'Use this independent check. Review angle labels and one measured angle before collection.',
      'HD precise independent quadrilateral construction visual with angle labels, protractor, ruler, and verification sentence frame.',
      'solo-quadrilateral-check',
      'assessment',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Regular Polygons',
      ['Repeated sides must match.', 'Repeated angles must match.', 'The side count must be correct.', 'A regularity claim needs evidence.'],
      'Bridge from Session 1 regularity and Session 2 construction. Ask learners which two measurements must match before a polygon is regular.',
      'HD precise regular polygon planning visual with pentagon, hexagon, octagon, decagon, ruler, protractor, and planning grid.',
      'regular-polygon-evidence',
      'overview',
    ),
    evidenceSlide(
      'Almost-Regular Challenge',
      ['Inspect the near-regular polygon.', 'Choose one suspicious measure.', 'Measure before deciding.', 'Write a claim-evidence note.'],
      'This is the connect-and-diagnose task. Ask: What looks equal? What must be measured? What evidence changes your first impression?',
      'HD precise near-regular polygon challenge visual with a regular-looking irregular polygon and measurement prompt.',
      'almost-regular-challenge',
      'situation',
    ),
    evidenceSlide(
      'Regular Polygon Planning Grid',
      ['1. Choose 5, 6, 8, or 10 sides.', '2. Record the given side length.', '3. Record the given angle measure.', '4. Mark the repeated pattern.', '5. Plan before drawing.'],
      'This slide starts the planning activity. Teacher checks that each learner has the correct side count and repeated measures.',
      'HD precise regular polygon planning grid visual with pentagon, hexagon, octagon, decagon, side length, angle measure, and repeated pattern columns.',
      'regular-polygon-planning-grid',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Planning Grid',
      ['Side count matches the card.', 'Repeated side length is listed.', 'Repeated angle measure is listed.', 'Verification step is planned.'],
      'Make the output criteria explicit before construction. Planning should prevent learners from drawing decorative shapes first.',
      'HD precise regular polygon planning visual with repeated side and angle checklist beside blank grid.',
      'planning-grid-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Worked Example: Hexagon Build',
      ['Start at one vertex.', 'Measure the side.', 'Place the angle carefully.', 'Draw the next side.', 'Verify repeated measures.'],
      'This is the guided construction task. Pause at each vertex to align, measure, draw, label, and verify.',
      'HD precise regular hexagon construction visual with vertices, ruler, protractor, labels, and verification table.',
      'worked-example-hexagon-build',
      'model',
    ),
    evidenceSlide(
      'Polygon Studio',
      ['Construct the assigned polygon.', 'Measure all required sides.', 'Measure all required angles.', 'Mark one section for correction.', 'Use the checklist before submitting.'],
      'This is the main practice task. Groups construct one assigned regular polygon and audit the measurements before submitting.',
      'HD precise polygon studio visual with pentagon, octagon, decagon samples, ruler, protractor, and measurement audit table.',
      'polygon-studio',
      'activity',
    ),
    evidenceSlide(
      'Regularity Evidence Talk',
      ['Compare repeated side measures.', 'Compare repeated angle measures.', 'Name the least accurate measurement.', 'Question: what revision improves regularity?'],
      'This is the make-meaning task. Ask: Which measurement is least accurate? How does your evidence support the classification?',
      'HD precise regularity evidence visual with side and angle comparison table, regular polygon, ruler, and protractor.',
      'regularity-evidence-talk',
      'discussion',
    ),
    evidenceSlide(
      'Equal-Looking Sides Are Not Enough',
      ['Equal sides alone do not prove regularity.', 'Equal angles must also be checked.', 'Tool error can hide in neat drawings.', 'Use both conditions in the proof.'],
      'Use this misconception repair before the proof slip. Ask: Which condition fails if sides look equal but angles are not equal?',
      'HD precise regularity rule visual comparing side evidence and angle evidence for regular and irregular polygons.',
      'equal-looking-sides-not-enough',
      'misconception',
    ),
    evidenceSlide(
      'Regularity Proof Slip',
      ['State regular or irregular.', 'Use side evidence.', 'Use angle evidence.', 'Name one condition that passes or fails.'],
      'Use this independent check. Look for both side and angle conditions, not just a visual judgment.',
      'HD precise proof slip visual with polygon sample, side and angle evidence table, and claim-evidence frame.',
      'regularity-proof-slip',
      'assessment',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Polygon Set Defense',
      ['Blueprint before drawing.', 'Labels must match constraints.', 'Verification must use measurements.', 'Defense must explain why evidence is enough.'],
      'Bridge from previous sessions by calibrating one sample polygon. Ask which evidence is visible and which evidence is missing.',
      'HD precise polygon set blueprint visual with regular polygon, irregular polygon, triangle or quadrilateral panel, and verification table.',
      'polygon-set-defense',
      'overview',
    ),
    evidenceSlide(
      'Checklist Calibration',
      ['Review one sample polygon.', 'Check the visible labels.', 'Name one missing measure.', 'Decide if the claim is supported.'],
      'This is the connect-and-diagnose task. Confirm the class standard for acceptable evidence before the performance task.',
      'HD precise checklist calibration visual with sample polygon, missing label prompt, and evidence checklist.',
      'checklist-calibration',
      'situation',
    ),
    evidenceSlide(
      'Polygon Set Blueprint',
      ['1. Plan one regular polygon.', '2. Plan one irregular polygon.', '3. Plan one triangle or quadrilateral.', '4. List required side or angle measures.', '5. Get approval before drawing.'],
      'This slide starts the performance task. Teacher approves side count and angle requirements before construction.',
      'HD precise polygon set blueprint visual with three planning panels, constraints, side-count choices, and angle-measure planning table.',
      'polygon-set-blueprint',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Approved Blueprint',
      ['Each figure has constraints.', 'Side count is clear.', 'Angle requirements are listed.', 'Evidence plan matches the classification.'],
      'Make the blueprint criteria explicit. Learners should separate decorative drawing from mathematical construction.',
      'HD precise blueprint output visual with constraint boxes, side count, angle requirements, and approval checklist.',
      'approved-blueprint-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Evidence Drawing Studio',
      ['Draw each planned figure.', 'Label required side lengths.', 'Label required angle measures.', 'Complete the verification table.', 'Revise one mathematical detail.'],
      'This is the main construction task. Prioritize conferences for learners whose protractor alignment is weak.',
      'HD precise evidence drawing studio visual with regular polygon, irregular polygon, triangle, verification table, ruler, and protractor.',
      'evidence-drawing-studio',
      'activity',
    ),
    evidenceSlide(
      'Measurement Audit Exchange',
      ['Verify two side lengths.', 'Verify two angle measures.', 'Check one classification explanation.', 'Suggest one revision.'],
      'This is the peer review task. Learners must revise one mathematical detail, not only neatness.',
      'HD precise measurement audit visual with polygon drawing, ruler, protractor, audit checklist, and revision marks.',
      'measurement-audit-exchange',
      'discussion',
    ),
    evidenceSlide(
      'Defense Sentence Builder',
      ['Claim: this polygon is ___.', 'Evidence: the side measures show ___.', 'Evidence: the angle measures show ___.', 'Reason: that is enough because ___.'],
      'This guided model prepares the exit defense. Ask learners to connect the exact measurements to the classification word.',
      'HD precise defense sentence visual with polygon, side evidence, angle evidence, and claim-reason frame.',
      'defense-sentence-builder',
      'model',
    ),
    evidenceSlide(
      'Decorative Drawing Is Not Evidence',
      ['A neat shape can still be wrong.', 'Missing labels weaken the claim.', 'Unchecked angles create doubt.', 'Measurement evidence makes the work defensible.'],
      'Use this misconception repair before the final defense. Ask: Where does the evidence agree with the claim, and where does it conflict?',
      'HD precise comparison visual showing neat unlabeled polygon versus measured labeled polygon with checklist.',
      'decorative-drawing-not-evidence',
      'misconception',
    ),
    evidenceSlide(
      'Evidence Defense Exit',
      ['Choose one figure.', 'State the classification.', 'Cite two measurements.', 'Explain why those measures are enough.'],
      'Use this independent check. Look for a claim, two pieces of measurement evidence, and a reasoned explanation.',
      'HD precise evidence defense exit visual with selected polygon, measurement labels, verification table, and exit defense prompt.',
      'evidence-defense-exit',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Polygon Evidence Path",
      ['Sort polygon cards.', 'Measure sides and angles.', 'Build the regularity checklist.', 'Trace one guided pentagon.', 'Defend two classifications.'],
      'Use this as the pacing guide. Keep learners from classifying by appearance before testing properties and measurements.',
      'HD precise activity path visual with polygon sort, side-angle lab, regularity board, guided pentagon, and exit defense.',
      'today-s-polygon-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Angle Construction Path",
      ['Check protractor readiness.', 'Model the construction routine.', 'Build triangle and quadrilateral.', 'Repair a wrong-scale error.', 'Construct one solo quadrilateral.'],
      'Use this as the pacing guide. The routine is mark, align, measure, draw, label, and verify.',
      'HD precise activity path visual with protractor readiness, angle routine, triangle-quadrilateral builder, repair shop, and solo check.',
      'today-s-angle-construction-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Regular Polygon Path",
      ['Test an almost-regular figure.', 'Complete the planning grid.', 'Build a guided hexagon.', 'Audit a group polygon.', 'Write a regularity proof.'],
      'Use this as the pacing guide. Learners must use both side and angle evidence to justify regularity.',
      'HD precise activity path visual with near-regular polygon, planning grid, hexagon build, polygon studio, and proof slip.',
      'today-s-regular-polygon-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Polygon Set Defense Path",
      ['Calibrate the checklist.', 'Plan three figures.', 'Construct and verify.', 'Exchange measurement audits.', 'Defend one classification.'],
      'Use this as the pacing guide. The final product must show constraints, measurements, verification, revision, and defense.',
      'HD precise activity path visual with checklist calibration, polygon set blueprint, evidence drawing studio, measurement audit, and defense exit.',
      'today-s-polygon-set-defense-path',
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
  ...mathPolygonsBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const mathPolygonSignals = [
  'constructing and describing polygons',
  'regular and irregular polygons',
  'polygons with 5, 6, 8, or 10 sides',
  'side lengths',
  'angle measures',
  'ruler',
  'protractor',
  'triangle',
  'quadrilateral',
  'pentagon',
  'hexagon',
  'octagon',
  'decagon',
  'regularity',
  'measurement evidence',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableMathPolygonsLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasMathContext = /\bmathematics\b/.test(normalized) || /\bmath\b/.test(normalized) || /\bgrade\s*7\b/.test(normalized);
  const score = mathPolygonSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);
  return hasMathContext && score >= 5;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...mathPolygonsBlueprint,
  smartObjectives: [...mathPolygonsBlueprint.smartObjectives],
  studentFacingObjectives: [...mathPolygonsBlueprint.studentFacingObjectives],
  days: mathPolygonsBlueprint.days.map((day) => ({ ...day })),
});

const mathMainActivityByDayNumber: Record<number, string> = {
  1: 'Side-and-Angle Evidence Lab',
  2: 'Triangle-Quadrilateral Builder',
  3: 'Polygon Studio',
  4: 'Evidence Drawing Studio',
};

export const validateMathPolygonsK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: mathPolygonsBlueprint.subject,
    gradeLevel: mathPolygonsBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mathMainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 86,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getMathPolygonsK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getMathPolygonsK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateMathPolygonsK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('Math polygons reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getMathPolygonsK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
