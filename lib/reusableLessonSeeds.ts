import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const PARTICLE_MODEL_TOPIC = 'Particle Model of Matter';
const PARTICLE_MODEL_COMPETENCY = 'Recognize that scientists use models to explain phenomena that cannot be easily seen or detected; describe the Particle Model of Matter; use diagrams and illustrations to describe particle arrangement, spacing, and motion in solids, liquids, and gases; explain changes of state using particle arrangement and energy changes.';

const particleModelBlueprint: LessonBlueprint = {
  mainTitle: 'Particle Model of Matter: Evidence, Motion, States, and Phase Changes',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 7',
  quarter: 'First Term',
  learningCompetency: PARTICLE_MODEL_COMPETENCY,
  smartObjectives: [
    'By the end of Session 1, learners will use at least one observation from dissolving, diffusion, or air compression to support the claim that matter is made of tiny particles.',
    'By the end of Session 2, learners will explain how higher temperature affects particle motion by writing a correct cause-effect chain from investigation evidence.',
    'By the end of Session 3, learners will construct and revise accurate particle diagrams for solids, liquids, and gases using spacing, arrangement, and motion criteria.',
    'By the end of Session 4, learners will defend phase-change explanations by naming the change, describing particle motion and arrangement, and identifying whether energy is absorbed or released.',
  ],
  studentFacingObjectives: [
    'I can use evidence to explain unseen particles.',
    'I can compare particle motion in different conditions.',
    'I can model solids, liquids, and gases accurately.',
    'I can explain phase changes using particle energy.',
  ],
  days: [
    {
      dayNumber: 1,
      title: 'Evidence for Tiny Particles',
      focus: 'Learners use dissolving, diffusion, and air compression evidence to build a particle model of matter.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Temperature and Particle Motion',
      focus: 'Learners compare cold-water and warm-water diffusion, then explain faster motion using evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Particle Diagrams for Solids, Liquids, and Gases',
      focus: 'Learners build and revise scientific particle diagrams for the three common states of matter.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Energy in Changes of State',
      focus: 'Learners explain melting, evaporation, condensation, and freezing using particle arrangement, motion, and energy direction.',
      generationStatus: 'pending',
    },
  ],
};

const baseMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Science',
  topic: PARTICLE_MODEL_TOPIC,
  gradeLevel: 'Grade 7',
  gradeBand: '7-10',
  learningCompetency: PARTICLE_MODEL_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'diagram',
): ImageSemanticMetadata => ({
  ...baseMetadata,
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
): Slide => ({
  title,
  content,
  speakerNotes,
  imagePrompt,
  imageStyle: imagePrompt ? style : 'none',
  ...(imagePrompt ? { imageSemanticMetadata: metadataFor(slideTemplate, visualRole, `${title}. ${content.join(' ')}`, style) } : {}),
  ...(imageOverlays ? { imageOverlays } : {}),
});

const initialSlides: Slide[] = [
  slide(
    particleModelBlueprint.mainTitle,
    ['Subject: Science', 'Grade Level: Grade 7', 'Term: First Term'],
    'Introduce the week as a sequence: evidence first, then particle motion, diagrams, and phase-change explanations.',
    'A professional high-resolution realistic classroom science photo showing a Grade 7 lab table with clear cups of water, sugar, food coloring, ice, a cold bottle with condensation, and a safe needle-free syringe, natural classroom lighting, no words, no labels, no text.',
    'overview',
    'overview',
    'photorealistic',
  ),
  slide(
    'Learning Objectives',
    particleModelBlueprint.studentFacingObjectives,
    'Read each objective aloud. Tell learners that every activity will connect visible evidence to an invisible particle explanation.',
    '',
  ),
  slide(
    'How We Will Learn Like Scientists',
    ['Observe before explaining', 'Separate evidence from inference', 'Draw models for unseen particles', 'Revise when evidence improves'],
    'Use this as the class norm for the whole sequence. Tell learners that wrong first ideas are useful if they can improve them with evidence.',
    '',
  ),
];

const sessionSlides: Record<number, Slide[]> = {
  1: [
    slide(
      "Today's Goal",
      ['Use evidence from three cases', 'Represent different substances clearly', 'Avoid saying matter disappears'],
      'Begin with the brief attendance and wellbeing bridge, then set the success target: learners must connect an observation to a particle-model claim.',
      '',
    ),
    slide(
      'Do Now: Mystery Claim Vote',
      ['Choose the strongest claim', 'Write one observable clue', 'Mark unsure if needed'],
      'Give learners one minute to vote silently: sugar disappeared, color was pushed, or air is empty. Collect two reasons before showing any model.',
      '',
    ),
    slide(
      'Matter Mystery Claims',
      ['Sugar seems to disappear', 'A smell spreads across space', 'Air can be compressed'],
      'Show the three setup cards or demonstrations. Ask learners to write one observation and one possible explanation.',
      'A high-resolution realistic classroom science photo of three safe demo setups on one lab table: sugar dissolving in a clear cup of water, a drop of food coloring spreading in still water, and a sealed needle-free syringe for air compression, natural light, accurate materials, no words, no labels, no text.',
      'particle-evidence',
      'situation',
      'photorealistic',
    ),
    slide(
      'Observe, Infer, or Unsure?',
      ['Observation: directly noticed', 'Inference: explained from evidence', 'Model: represents unseen particles'],
      'Have pairs classify their first answers. Emphasize that the model is not a guess; it must be supported by evidence.',
      'A high-resolution realistic classroom photo of a teacher table with three blank evidence cards using simple non-text visual symbols only: an eye icon card, a connected-dots card, and a particle-cluster card, real paper and classroom lighting, no readable writing, no labels, no text.',
      'particle-evidence',
      'concept',
      'photorealistic',
    ),
    slide(
      'Think-Pair-Share: Best Evidence',
      ['What changed?', 'What stayed the same?', 'What unseen idea fits?', 'What evidence rejects disappearing?'],
      'Pairs must speak in this order: observation first, inference second, model last. Listen for learners using evidence language rather than memorized statements.',
      '',
    ),
    slide(
      'Air Is Matter Too',
      ['The syringe volume changes', 'Air resists full compression', 'Particles move closer together'],
      'Demonstrate the needle-free sealed syringe. Ask which observation proves air is present even when unseen.',
      'A high-resolution realistic classroom science photo showing a teacher hand gently compressing a clear needle-free plastic syringe filled with air beside an uncompressed syringe comparison, safe classroom demo, sharp focus, no needle, no words, no labels, no text.',
      'air-compression',
      'model',
      'photorealistic',
      [
        { id: 'air-before', text: 'Before', x: 25, y: 15, fontSize: 18 },
        { id: 'air-after', text: 'After', x: 75, y: 15, fontSize: 18 },
        { id: 'air-closer', text: 'Particles closer', x: 76, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Sugar Did Not Vanish',
      ['Sugar particles spread through water', 'The mixture still contains matter', 'Evidence comes from the solution'],
      'Guide learners away from “disappeared.” Ask what evidence would show that sugar is still present without tasting.',
      'A high-resolution realistic close-up classroom photo of sugar crystals dissolving in a transparent cup of water on a lab table, some crystals still visible at the bottom and the water slightly disturbed, accurate scale, no spoon, no words, no labels, no text.',
      'dissolving-diffusion',
      'concept',
      'photorealistic',
      [
        { id: 'sugar-crystals', text: 'Sugar crystals', x: 31, y: 77, fontSize: 16 },
        { id: 'sugar-particles', text: 'Particles spread', x: 68, y: 42, fontSize: 16 },
      ],
    ),
    slide(
      'Color Spreads Without Stirring',
      ['Color particles move through water', 'Spreading takes time', 'Still water gives better evidence'],
      'Let learners observe without stirring. Ask what changed and what stayed the same in the cup.',
      'A high-resolution realistic classroom science photo of a single drop of blue food coloring diffusing through still water in a clear beaker, no stirring, visible plume spreading naturally, lab table background, no words, no labels, no text.',
      'dissolving-diffusion',
      'practice',
      'photorealistic',
      [
        { id: 'color-drop', text: 'Initial drop', x: 43, y: 24, fontSize: 16 },
        { id: 'color-trail', text: 'Spreading trail', x: 63, y: 58, fontSize: 16 },
      ],
    ),
    slide(
      'Evidence Board',
      ['Post one evidence sentence', 'Separate observation from inference', 'Revise weak explanations'],
      'Collect group evidence. Rewrite “sugar disappeared” into a particle-model explanation with the class.',
      'A high-resolution realistic classroom photo of a science evidence board with pinned blank sticky notes, printed demo photos, colored yarn links, and small particle-symbol cards, no readable writing, no letters, no labels, no text.',
      'particle-evidence',
      'generalization',
      'photorealistic',
      [
        { id: 'board-observe', text: 'Observation', x: 23, y: 20, fontSize: 16 },
        { id: 'board-infer', text: 'Inference', x: 50, y: 20, fontSize: 16 },
        { id: 'board-model', text: 'Model', x: 76, y: 20, fontSize: 16 },
      ],
    ),
    slide(
      'Build a Particle Model',
      ['Choose one case', 'Use a different symbol for each substance', 'Show spacing or motion', 'Link the model to evidence'],
      'Pairs create the four-box organizer. Check that different pure substances use different symbols and that dissolving does not imply particles changed size or disappeared.',
      'A high-resolution realistic classroom photo of a student worksheet for building a before-and-after particle model after a dissolving demo, with colored dot particles for two substances, colored pencils, a clear cup of water, and a few sugar crystals nearby, no readable writing, no labels, no text.',
      'particle-evidence',
      'application',
      'photorealistic',
      [
        { id: 'model-substance-a', text: 'Substance A', x: 30, y: 22, fontSize: 16 },
        { id: 'model-water', text: 'Water particles', x: 65, y: 72, fontSize: 16 },
        { id: 'model-evidence', text: 'Evidence link', x: 72, y: 20, fontSize: 16 },
      ],
    ),
    slide(
      'Teacher Checkpoint: Model Rules',
      ['Different substances need symbols', 'Particles stay the same size', 'Matter does not disappear', 'Evidence must be named'],
      'Before groups submit, check two models publicly: one accurate feature and one revision. This prevents decorative drawings from passing as scientific models.',
      '',
    ),
    slide(
      'New Case Transfer',
      ['Powdered juice mixing', 'Salt dissolving in soup', 'Smell spreading in a room'],
      'Let pairs choose one new case. Require one evidence link from the stations before drawing their model.',
      'A high-resolution realistic classroom-safe collage photo on a lab table showing powdered drink mix entering a clear glass of water, salt beside a small bowl of soup, and a small covered scent container for smell diffusion, natural lighting, no words, no labels, no text.',
      'dissolving-diffusion',
      'application',
      'photorealistic',
    ),
    slide(
      'Exit Slip',
      ['Pick the stronger model', 'Explain dissolved sugar', 'Use one evidence sentence', 'Find one home mixing example'],
      'Score quickly: 1 point for observation, 1 for particle explanation, 1 for not saying disappeared. The home example prepares the Session 2 evidence callback.',
      'A high-resolution realistic classroom photo of an exit-slip station: a blank paper slip, pencil, small accurate particle diagram card, and clear cup from the dissolving demo on a desk, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  2: [
    slide(
      "Today's Goal",
      ["Return to yesterday's evidence", 'Compare cold and warm water', 'Explain faster particle motion'],
      'Start by revisiting the Session 1 evidence board. Remind learners that today they are testing what temperature changes about particle motion.',
      '',
    ),
    slide(
      "Do Now: Yesterday's Evidence",
      ['Name one observation', 'Name one particle inference', 'Predict what warming changes'],
      'Use two learner examples from Session 1. Ask: If particles already move, what might warmer water change about their motion?',
      '',
    ),
    slide(
      'Cold or Warm Prediction',
      ['Predict which spreads faster', 'Underline the motion idea', 'Keep the same color amount'],
      'Ask learners to commit to a prediction before the test. Listen for “heat adds particles” as a misconception.',
      'A high-resolution realistic classroom science photo of two clear cups of water side by side on a lab table, one with ice nearby to imply cold water and one with gentle steam nearby to imply warm water, identical droppers adding the same small blue food-coloring drop, no words, no labels, no text.',
      'diffusion-temperature',
      'situation',
      'photorealistic',
      [
        { id: 'cold-cup', text: 'Cold', x: 26, y: 18, fontSize: 18 },
        { id: 'warm-cup', text: 'Warm', x: 74, y: 18, fontSize: 18 },
      ],
    ),
    slide(
      'Fair Test Setup',
      ['Same cup size', 'Same water amount', 'Same color drop', 'Same start time', 'No stirring'],
      'Have pairs identify what must stay the same before any drops are added. Teacher handles or approves warm water.',
      'A high-resolution realistic classroom lab photo of a fair-test setup: two identical clear cups with equal amounts of water, two identical droppers with blue food coloring, and a plain stopwatch nearby, no stirring tools, no words, no labels, no text.',
      'diffusion-temperature',
      'practice',
      'photorealistic',
      [
        { id: 'fair-same-cups', text: 'Same setup', x: 50, y: 22, fontSize: 16 },
        { id: 'fair-no-stir', text: 'No stirring', x: 50, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Watch the Spread',
      ['Record the start', 'Observe after 30 seconds', 'Observe after 2 minutes'],
      'Tell learners to observe silently for the first interval. They should describe spread, not just color.',
      'A high-resolution realistic classroom science photo sequence in one image showing blue food coloring spreading through clear water at three moments, with a warmer-water cup visibly spreading farther than a colder-water cup, accurate diffusion plumes, no words, no labels, no text.',
      'diffusion-temperature',
      'practice',
      'photorealistic',
      [
        { id: 'watch-start', text: 'Start', x: 18, y: 16, fontSize: 16 },
        { id: 'watch-mid', text: '30 sec', x: 50, y: 16, fontSize: 16 },
        { id: 'watch-end', text: '2 min', x: 82, y: 16, fontSize: 16 },
      ],
    ),
    slide(
      'Data Talk: What Counts as Faster?',
      ['Compare spread distance', 'Use the same time mark', 'Ignore color darkness alone', 'Explain evidence aloud'],
      'Stop the class before explanation. Have learners compare spread at the same time mark so they do not confuse darkness with speed.',
      '',
    ),
    slide(
      'What Pattern Appeared?',
      ['Warm water spreads faster', 'The color amount stayed same', 'Motion evidence changed'],
      'Build the class pattern from actual observations. If results vary, discuss handling error or temperature differences.',
      'A high-resolution realistic close-up classroom photo comparing two transparent cups after the same blue food-coloring drop: one cold-water cup with a compact plume and one warm-water cup with a wider plume, same amount of color, no words, no labels, no text.',
      'diffusion-temperature',
      'generalization',
      'photorealistic',
    ),
    slide(
      'Particles Move Faster',
      ['Higher temperature increases motion', 'Faster motion spreads particles', 'Heat does not create particles'],
      'Use the class evidence to connect temperature to motion. Explicitly reject the idea that heat adds particles.',
      'A particle-motion diagram showing the same number of particles in two areas, with short motion trails in the cool area and longer motion trails in the warm area, no text or labels.',
      'diffusion-temperature',
      'concept',
      'diagram',
      [
        { id: 'cool-motion', text: 'Slower motion', x: 26, y: 78, fontSize: 16 },
        { id: 'warm-motion', text: 'Faster motion', x: 74, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Cause-Effect Chain',
      ['Higher temperature', 'Particles move faster', 'Color spreads faster', 'Evidence supports the claim'],
      'Have learners read the chain forward, then backward from evidence to claim. Require the word "because" in oral responses.',
      '',
    ),
    slide(
      'Spacing and Attraction',
      ['Particles have spaces', 'Solids attract most strongly', 'Liquids attract moderately', 'Gases attract weakest'],
      'Use hand models while seated. Keep the point qualitative: strongest attraction in solids, weakest in gases.',
      'A clean particle diagram showing close particles with subtle attraction lines and moving particles with curved motion arrows, no text or labels.',
      'particle-states',
      'model',
      'diagram',
    ),
    slide(
      'Warm Drink Transfer',
      ['Sugar dissolves faster when warm', 'Particles move more quickly', 'The amount of sugar is unchanged'],
      'Learners complete the four-box transfer organizer. Require the cause-effect chain before final sharing.',
      'A high-resolution realistic classroom-safe photo of sugar being added to a warm clear drink in a cup, gentle steam visible, spoon resting nearby but not stirring, lab table setting, no words, no labels, no text.',
      'diffusion-temperature',
      'application',
      'photorealistic',
    ),
    slide(
      'Misconception Check',
      ['Heat does not add particles', 'Cold particles still move', 'Particles exist in all states'],
      'Ask learners to correct one wrong statement using evidence from the investigation.',
      'A split science diagram showing the same count of particles in cool and warm water, with different motion trails but no added particles, no text or labels.',
      'diffusion-temperature',
      'assessment',
      'diagram',
    ),
    slide(
      'Motion Mastery Check',
      ['Cold particles still move', 'Warm particles move faster', 'Same color amount stays same', 'Evidence must be named'],
      'Collect the quick check. Sort responses into three piles: heat adds particles, cold particles stop, or missing evidence.',
      'A high-resolution realistic classroom photo of a quick-check station with a blank clipboard, two transparent cups from the warm-and-cold diffusion test, a pencil, and small non-text particle-motion cards, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  3: [
    slide(
      "Today's Goal",
      ['Model all three states', 'Use spacing and motion', 'Revise diagrams with evidence'],
      'Begin with the quick state prediction bridge, then tell learners that drawings must communicate science, not decoration.',
      '',
    ),
    slide(
      'Do Now: Sketch the Invisible',
      ['Draw ice particles quickly', 'Circle one uncertain part', 'Write one evidence reason'],
      'Do not correct drawings yet. Use the uncertain circles to show that scientific diagrams improve through criteria and evidence.',
      '',
    ),
    slide(
      'Three Samples, Three States',
      ['Solid sample', 'Liquid sample', 'Gas in a sealed bag'],
      'Show the samples. Ask how a particle diagram can show each state without drawing the object itself.',
      'A high-resolution realistic classroom science photo of three state-of-matter samples on a lab table: an ice cube or small solid object, a clear cup of water, and a sealed transparent plastic bag filled with air, accurate scale, no words, no labels, no text.',
      'particle-states',
      'situation',
      'photorealistic',
      [
        { id: 'sample-solid', text: 'Solid sample', x: 22, y: 74, fontSize: 16 },
        { id: 'sample-liquid', text: 'Liquid sample', x: 52, y: 74, fontSize: 16 },
        { id: 'sample-gas', text: 'Gas sample', x: 78, y: 74, fontSize: 16 },
      ],
    ),
    slide(
      'Diagram Quality Checklist',
      ['Tag one strong diagram', 'Tag one flawed diagram', 'Name the misleading feature', 'Fix it with evidence'],
      'Pairs tag one strong and one flawed diagram. Focus feedback on exact features that could mislead a learner.',
      'Two side-by-side particle diagrams, one scientifically organized and one visibly flawed with incorrect spacing, plus check icons, no words, letters, or labels.',
      'particle-states',
      'success-criteria',
      'diagram',
      [
        { id: 'check-accurate', text: 'Accurate feature', x: 29, y: 18, fontSize: 16 },
        { id: 'check-revise', text: 'Revise feature', x: 72, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Revision Codes',
      ['S = spacing', 'A = arrangement', 'M = motion arrows', 'E = evidence label'],
      'Introduce quick feedback codes before peer review. This makes feedback faster and more specific than "good" or "wrong."',
      '',
    ),
    slide(
      'Solid Particles',
      ['Close together', 'Orderly arrangement', 'Vibrate in place'],
      'Emphasize that solid particles are not motionless. Use short vibration arrows.',
      'A particle diagram of a solid: many equal-size particles packed close in an orderly grid with tiny vibration arrows, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
      [
        { id: 'solid-close', text: 'Close', x: 28, y: 22, fontSize: 16 },
        { id: 'solid-vibrate', text: 'Vibrate', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Liquid Particles',
      ['Close together', 'Less orderly', 'Slide past each other'],
      'Contrast with solid: close spacing remains, but arrangement and motion change.',
      'A particle diagram of a liquid: equal-size particles close together but irregularly arranged, with curved arrows showing sliding motion, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
      [
        { id: 'liquid-close', text: 'Close', x: 28, y: 24, fontSize: 16 },
        { id: 'liquid-slide', text: 'Slide past', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Gas Particles',
      ['Far apart', 'Move freely', 'Travel in many directions'],
      'Correct the common error of drawing gas particles only slightly farther apart than liquid particles.',
      'A particle diagram of a gas: equal-size particles far apart with long motion arrows in many directions, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
      [
        { id: 'gas-far', text: 'Far apart', x: 30, y: 22, fontSize: 16 },
        { id: 'gas-free', text: 'Free motion', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Compare the Three States',
      ['Solid: close and orderly', 'Liquid: close and sliding', 'Gas: far and fast'],
      'Use this as the synthesis slide before learners revise their own diagrams.',
      'A clean three-panel particle diagram for solid, liquid, and gas using equal-size particles, correct spacing, and motion arrows, no text or labels.',
      'particle-states',
      'generalization',
      'diagram',
      [
        { id: 'solid-label', text: 'Solid', x: 18, y: 14, fontSize: 18 },
        { id: 'liquid-label', text: 'Liquid', x: 50, y: 14, fontSize: 18 },
        { id: 'gas-label', text: 'Gas', x: 82, y: 14, fontSize: 18 },
      ],
    ),
    slide(
      'Mystery State Revision',
      ['Identify the sample state', 'Find one misleading feature', 'Make the exact correction'],
      'Groups revise a peer diagram using a mystery sample card such as oil, air in a ball, or ice.',
      'A high-resolution realistic classroom close-up of student hands revising a particle-diagram worksheet with colored pencils beside a mystery sample card showing oil, ice, or air in a sealed bag, no readable writing, no labels, no text.',
      'particle-states',
      'application',
      'photorealistic',
    ),
    slide(
      'Peer Feedback Rule',
      ['Name one accurate feature', 'Name one needed revision', 'Explain the science reason'],
      'Model respectful, evidence-based critique. Require a reason, not just “looks wrong.”',
      'A high-resolution realistic classroom photo of two students from behind or hands-only reviewing a particle diagram on paper with colored revision marks and sticky notes, no faces emphasized, no readable writing, no labels, no text.',
      'particle-states',
      'practice',
      'photorealistic',
    ),
    slide(
      'Gallery Walk: One Revision Only',
      ['Leave one code', 'Write one reason', 'Do not redraw for them', 'Owner makes the fix'],
      'Use a short gallery walk so feedback stays precise. Require owners to decide whether the evidence supports the suggested revision.',
      '',
    ),
    slide(
      'Mini Diagram Check',
      ['Draw all three states', 'Label spacing and motion', 'Write two comparisons', 'Bring one phase-change example'],
      'Score for spacing, arrangement, motion arrows, and evidence labels. The home example sets up the energy-direction probe.',
      'A high-resolution realistic classroom photo of a blank mini assessment sheet with three empty diagram boxes, a pencil, and small solid-liquid-gas particle reference cards turned partly away so no writing is readable, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  4: [
    slide(
      "Today's Goal",
      ['Explain changes of state', 'Track particle energy', 'Defend everyday examples'],
      'Frame the lesson around two questions: What changes in the particles, and where does energy go?',
      '',
    ),
    slide(
      'Do Now: Home Phase Change',
      ['Name your example', 'Choose start and end states', 'Guess energy in or out'],
      'Use examples learners brought from Session 3. Do not confirm answers yet; the card sequence will test the guesses.',
      '',
    ),
    slide(
      'Melting and Droplets Probe',
      ['Ice changes to liquid water', 'Droplets form outside cold surfaces', 'Energy direction matters'],
      'Ask learners where the outside droplets came from. Use answers to surface the condensation misconception.',
      'A high-resolution realistic classroom science photo of melting ice on a tray beside a cold bottle with water droplets forming on the outside, clear evidence of condensation, natural classroom lighting, no words, no labels, no text.',
      'phase-change-energy',
      'situation',
      'photorealistic',
      [
        { id: 'probe-melting', text: 'Melting', x: 24, y: 72, fontSize: 16 },
        { id: 'probe-droplets', text: 'Outside droplets', x: 72, y: 24, fontSize: 16 },
      ],
    ),
    slide(
      'Energy Direction Sort',
      ['Start with the state', 'Match the ending state', 'Choose absorbed or released'],
      'Groups sort state cards, phase-change cards, particle diagrams, and energy labels. Require one evidence reason before checking.',
      'A high-resolution realistic classroom photo of a hands-on phase-change card sort on a table: icon-only cards for solid, liquid, vapor, particle diagrams, and colored energy arrow cards, student hands sorting, no readable words, no labels, no text.',
      'phase-change-energy',
      'practice',
      'photorealistic',
      [
        { id: 'sort-start', text: 'Start state', x: 24, y: 24, fontSize: 16 },
        { id: 'sort-end', text: 'End state', x: 50, y: 24, fontSize: 16 },
        { id: 'sort-energy', text: 'Energy direction', x: 76, y: 24, fontSize: 16 },
      ],
    ),
    slide(
      'Sequence Table Build',
      ['Start state', 'End state', 'Arrangement change', 'Motion change', 'Energy direction'],
      'Groups complete one row at a time. Do not let learners name a phase change without also naming arrangement, motion, and energy direction.',
      '',
    ),
    slide(
      'Heating Row',
      ['Solid becomes liquid', 'Liquid becomes vapor', 'Particles gain energy'],
      'Connect melting and evaporation as energy-absorbing changes. Avoid treating vapor as “nothing.”',
      'A left-to-right particle diagram showing solid particles becoming liquid particles then widely spaced vapor particles, with warm energy arrows entering, no text or labels.',
      'phase-change-energy',
      'concept',
      'diagram',
      [
        { id: 'heating-energy-in', text: 'Energy in', x: 50, y: 18, fontSize: 18 },
        { id: 'heating-motion-up', text: 'Motion increases', x: 72, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Cooling Row',
      ['Vapor becomes liquid', 'Liquid becomes solid', 'Particles lose energy'],
      'Connect condensation and freezing as energy-releasing changes. Use the cold bottle example.',
      'A right-to-left particle diagram showing vapor particles becoming liquid particles then ordered solid particles, with cool energy arrows leaving, no text or labels.',
      'phase-change-energy',
      'concept',
      'diagram',
      [
        { id: 'cooling-energy-out', text: 'Energy out', x: 50, y: 18, fontSize: 18 },
        { id: 'cooling-motion-down', text: 'Motion decreases', x: 30, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Four Phase Changes',
      ['Melting: solid to liquid', 'Evaporation: liquid to vapor', 'Condensation: vapor to liquid', 'Freezing: liquid to solid'],
      'Use this as the class explanation table, but keep the slide concise. The teacher can add labels as overlays if needed.',
      'A four-part science diagram of phase changes using only particle arrangements and arrows between states, no words, no labels, no letters, no numbers.',
      'phase-change-energy',
      'model',
      'diagram',
      [
        { id: 'phase-melting', text: 'Melting', x: 28, y: 25, fontSize: 16 },
        { id: 'phase-evaporation', text: 'Evaporation', x: 70, y: 25, fontSize: 16 },
        { id: 'phase-condensation', text: 'Condensation', x: 70, y: 76, fontSize: 16 },
        { id: 'phase-freezing', text: 'Freezing', x: 28, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Where Did Droplets Come From?',
      ['Water vapor was in the air', 'The cold surface removed energy', 'Vapor changed to liquid droplets'],
      'Directly correct the idea that droplets came from inside the bottle. Ask what evidence rules it out.',
      'A high-resolution realistic close-up classroom photo of a cold glass bottle with water droplets clearly forming only on the outside surface, dry table visible around it, accurate condensation evidence, no words, no labels, no text.',
      'phase-change-energy',
      'application',
      'photorealistic',
      [
        { id: 'droplet-vapor', text: 'Water vapor', x: 25, y: 30, fontSize: 16 },
        { id: 'droplet-cooling', text: 'Loses energy', x: 62, y: 20, fontSize: 16 },
        { id: 'droplet-liquid', text: 'Liquid droplets', x: 70, y: 72, fontSize: 16 },
      ],
    ),
    slide(
      'Everyday Phase-Change CER',
      ['Claim names the phase change', 'Evidence points to a clue', 'Reasoning explains energy direction'],
      'Groups choose cases like foggy mirror, drying clothes, melting ice cream, droplets outside a bottle, or freezing juice.',
      'A high-resolution realistic photo collage of everyday phase changes: a foggy mirror, a drying cloth, melting ice cream in a cup, droplets outside a cold bottle, and juice freezing in a tray, clean classroom-safe composition, no words, no labels, no text.',
      'phase-change-energy',
      'application',
      'photorealistic',
    ),
    slide(
      'Defend the Explanation',
      ['Use particle arrangement', 'Use particle motion', 'Use energy direction', 'Rule out a wrong answer'],
      'Have groups revise the weaker CER and prepare one sentence defending it to a classmate.',
      'A high-resolution realistic classroom photo of a pair discussion over a phase-change particle diagram worksheet, with evidence cards and colored energy-arrow cards on the desk, hands pointing at the diagram, no readable writing, no labels, no text.',
      'phase-change-energy',
      'generalization',
      'photorealistic',
    ),
    slide(
      'Energy Direction Mastery Check',
      ['Melting ice', 'Drying puddle', 'Foggy mirror', 'Cold bottle droplets', 'Freezing juice', 'Steam on a lid'],
      'Give the independent six-item check from the lesson plan. Score each item for phase-change name, start/end states, energy direction, and particle explanation.',
      'A high-resolution realistic classroom photo of six small phase-change evidence stations arranged on one table: melting ice, drying water spot, fogged mirror tile, cold bottle droplets, freezing tray, and steam on a lid, accurate materials, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
    slide(
      'Assignment and Reflection',
      ['Document one home phase change', 'Explain starting and ending states', 'Include motion and energy direction'],
      'Assign the home connection and collect one teacher reflection note: which phase change caused the most confusion, and what evidence helped learners correct it. Remind learners that a written observation or simple sketch is enough.',
      'A high-resolution realistic classroom photo of a science notebook beside a cold glass with condensation and a small melting ice cube on a tray, pencil nearby, no readable writing, no words, no labels, no text.',
      'assignment',
      'assignment',
      'photorealistic',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Session 1 Flow and Timing',
      ['4 min: claim vote', '5 min: air demo', '12 min: evidence stations', '8 min: evidence board', '8 min: transfer model', '5 min: exit slip'],
      'Use this slide as the teacher pacing guide. Keep station talk tight so learners still have time to revise their model before the exit slip.',
      '',
    ),
    slide(
      'Evidence Table Routine',
      ['Case: air, sugar, or color', 'Observation: what changed', 'Inference: unseen particles', 'Evidence: strongest clue'],
      'This is the core student task. Require one complete row before learners draw; otherwise models become guesses instead of evidence-based explanations.',
      'A high-resolution realistic classroom photo of an evidence-table routine setup: a mostly blank worksheet with three broad rows, demo materials nearby, colored sticky markers, and small particle-symbol cards, no readable writing, no labels, no text.',
      'particle-evidence',
      'practice',
      'photorealistic',
      [
        { id: 'table-case', text: 'Case', x: 20, y: 18, fontSize: 16 },
        { id: 'table-observation', text: 'Observation', x: 43, y: 18, fontSize: 16 },
        { id: 'table-inference', text: 'Inference', x: 68, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Support, Safety, and Output',
      ['Sentence stem cards', 'Particle word bank', 'No tasting solutions', 'Wipe spills immediately', 'Submit table and model'],
      'Give sentence stems to learners who need support: I observed ____. I infer that particles ____. My evidence is ____. Check outputs before dismissal.',
      '',
    ),
  ],
  2: [
    slide(
      'Session 2 Flow and Timing',
      ['5 min: evidence callback', '5 min: prediction markup', '12 min: timing test', '8 min: data talk', '10 min: transfer chain', '8 min: quick check'],
      'The timing test should drive the explanation. Do not let learners jump to a memorized rule without evidence.',
      '',
    ),
    slide(
      'Fair-Test Evidence',
      ['Same cup size', 'Same color amount', 'Same start time', 'No stirring', 'Compare spread over time'],
      'Ask learners which variables must stay the same. The warm/cold comparison only works if the test is fair.',
      'A high-resolution realistic classroom science photo of two matched clear cups with identical drops of blue food coloring entering still water, one cup chilled with ice nearby and one warm cup with slight steam nearby, a plain timer object nearby, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'practice',
      'photorealistic',
    ),
    slide(
      'Support, Safety, and Output',
      ['Motion word bank', 'Cause-effect stem', 'Teacher handles warm water', 'Submit data table', 'Submit transfer chain'],
      'Use the stem: Higher temperature -> particles move ____ -> spreading or dissolving happens ____ because ____. Do not accept "heat adds particles."',
      '',
    ),
  ],
  3: [
    slide(
      'Session 3 Flow and Timing',
      ['5 min: invisible sketch', '8 min: diagram tagging', '15 min: three-panel build', '8 min: gallery feedback', '10 min: mystery revision', '8 min: mini check'],
      'Keep the emphasis on scientific diagrams, not decoration. Each drawing must explain spacing, arrangement, and motion.',
      '',
    ),
    slide(
      'Diagram Criteria',
      ['Spacing matches the state', 'Arrangement matches the state', 'Motion arrows are accurate', 'Labels explain evidence'],
      'Use these criteria before peer feedback. Common errors: liquid too far apart, no motion in solids, and different particle sizes by state.',
      'A three-panel particle diagram showing solid, liquid, and gas with spacing, arrangement, and motion-arrow differences, no words or labels.',
      'particle-states',
      'success-criteria',
      'diagram',
    ),
    slide(
      'Support, Safety, and Output',
      ['Visual state cards', 'Revision-code checklist', 'Keep water off walkways', 'No mouth-inflated balloons', 'Submit revised diagram set'],
      'Give checklist support before groups revise. The concrete output is the three-state particle diagram with a mystery-sample inset and one revision note.',
      '',
    ),
  ],
  4: [
    slide(
      'Session 4 Flow and Timing',
      ['5 min: home example probe', '6 min: droplet misconception', '12 min: card sequence', '12 min: table build', '10 min: everyday CER', '10 min: mastery check'],
      'This session should make energy direction explicit. Keep returning to starting state, ending state, particle motion, and energy transfer.',
      '',
    ),
    slide(
      'Energy Evidence Rules',
      ['Name starting state', 'Name ending state', 'Track arrangement change', 'Track motion change', 'Decide absorbed or released'],
      'Use this rule set when learners defend melting, evaporation, condensation, and freezing explanations.',
      'A clean phase-change particle diagram with warm and cool arrows moving between solid, liquid, and vapor particle arrangements, no words or labels.',
      'phase-change-energy',
      'success-criteria',
      'diagram',
    ),
    slide(
      'Support, Safety, and Output',
      ['Phase-change word bank', 'Partially filled table', 'Teacher handles warm water', 'Submit sequence table', 'Submit everyday CER'],
      'For condensation, explicitly correct the misconception that outside droplets come from inside the bottle. Require evidence from the cold surface example.',
      '',
    ),
  ],
};

const getSessionSlides = (dayNumber: number): Slide[] => {
  const slides = sessionSlides[dayNumber];
  if (!slides) return [];

  const [goalSlide, ...remainingSlides] = slides;
  const detailSlides = sessionDetailSlides[dayNumber] || [];
  const studentRoutineSlides = detailSlides.filter((detailSlide) => !/flow and timing/i.test(detailSlide.title));
  const openingSlides = remainingSlides.slice(0, 2);
  const lessonSlides = remainingSlides.slice(2);

  return [
    goalSlide,
    ...openingSlides,
    ...studentRoutineSlides,
    ...lessonSlides,
  ];
};

const getCompletePresentationSlides = (): Slide[] => [
  ...initialSlides,
  ...particleModelBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const particleModelSignals = [
  'particle model of matter',
  'tiny particles',
  'states of matter',
  'solid liquid gas',
  'particle arrangement',
  'particle motion',
  'changes of state',
  'phase change',
  'dissolving',
  'diffusion',
  'condensation',
  'evaporation',
  'air compression',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableParticleModelLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;

  const hasScienceContext = /\bscience\b/.test(normalized) || /\bgrade\s*7\b/.test(normalized);
  const score = particleModelSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);

  return hasScienceContext && score >= 3;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...particleModelBlueprint,
  smartObjectives: [...particleModelBlueprint.smartObjectives],
  studentFacingObjectives: [...particleModelBlueprint.studentFacingObjectives],
  days: particleModelBlueprint.days.map((day) => ({ ...day })),
});

export const getReusableK12LessonPlanSeed = (
  content: string,
  language: 'EN' | 'FIL',
): CachedLessonPlanSeed | null => {
  if (language !== 'EN' || !isReusableParticleModelLesson(content)) return null;

  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getReusableK12PlanUnitSlidesSeed = (
  content: string,
  dayNumber: number,
  language: 'EN' | 'FIL',
): Slide[] | null => {
  if (language !== 'EN' || !isReusableParticleModelLesson(content)) return null;
  const slides = getSessionSlides(dayNumber);
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getReusableK12CompleteLessonPlanSeed = (
  content: string,
  language: 'EN' | 'FIL',
): CachedLessonPlanSeed | null => {
  if (language !== 'EN' || !isReusableParticleModelLesson(content)) return null;

  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
