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
    'A clean classroom science illustration showing water, ice, vapor, colored particles, and simple particle diagrams arranged as one coherent lesson visual, no words or labels.',
    'overview',
    'overview',
    'illustration',
  ),
  slide(
    'Learning Objectives',
    particleModelBlueprint.studentFacingObjectives,
    'Read each objective aloud. Tell learners that every activity will connect visible evidence to an invisible particle explanation.',
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
      'Matter Mystery Claims',
      ['Sugar seems to disappear', 'A smell spreads across space', 'Air can be compressed'],
      'Show the three setup cards or demonstrations. Ask learners to write one observation and one possible explanation.',
      'Three classroom science setups on a table: sugar dissolving in a clear cup, a drop of colored liquid spreading in still water, and a sealed needle-free syringe with air particles shown inside, no words or labels.',
      'particle-evidence',
      'situation',
      'illustration',
    ),
    slide(
      'Observe, Infer, or Unsure?',
      ['Observation: directly noticed', 'Inference: explained from evidence', 'Model: represents unseen particles'],
      'Have pairs classify their first answers. Emphasize that the model is not a guess; it must be supported by evidence.',
      'A classroom evidence board with visual cards represented by icons only: an eye, connecting dots, and a simple particle cluster, no written words or labels.',
      'particle-evidence',
      'concept',
      'illustration',
    ),
    slide(
      'Air Is Matter Too',
      ['The syringe volume changes', 'Air resists full compression', 'Particles move closer together'],
      'Demonstrate the needle-free sealed syringe. Ask which observation proves air is present even when unseen.',
      'A side-by-side science diagram of a needle-free syringe before and after gentle compression, with air particles farther apart first and closer together second, one broad arrow showing compression, no words or labels.',
      'air-compression',
      'model',
      'diagram',
    ),
    slide(
      'Sugar Did Not Vanish',
      ['Sugar particles spread through water', 'The mixture still contains matter', 'Evidence comes from the solution'],
      'Guide learners away from “disappeared.” Ask what evidence would show that sugar is still present without tasting.',
      'A transparent cup of water with sugar crystals at the bottom transitioning into many tiny particles spread evenly through the liquid, no words or labels.',
      'dissolving-diffusion',
      'concept',
      'diagram',
    ),
    slide(
      'Color Spreads Without Stirring',
      ['Color particles move through water', 'Spreading takes time', 'Still water gives better evidence'],
      'Let learners observe without stirring. Ask what changed and what stayed the same in the cup.',
      'A clear beaker of still water with one drop of colored liquid diffusing outward as many tiny particles and soft trails, no spoon, no stirring, no text or labels.',
      'dissolving-diffusion',
      'practice',
      'diagram',
    ),
    slide(
      'Evidence Board',
      ['Post one evidence sentence', 'Separate observation from inference', 'Revise weak explanations'],
      'Collect group evidence. Rewrite “sugar disappeared” into a particle-model explanation with the class.',
      'A science classroom board represented with pinned image cards and simple particle icons, with no readable writing, no letters, and no labels.',
      'particle-evidence',
      'generalization',
      'illustration',
    ),
    slide(
      'Build a Particle Model',
      ['Choose one case', 'Use a different symbol for each substance', 'Show spacing or motion', 'Link the model to evidence'],
      'Pairs create the four-box organizer. Check that different pure substances use different symbols and that dissolving does not imply particles changed size or disappeared.',
      'A clean before-and-after particle model for a dissolving substance in water, using two different particle shapes or colors and no text, labels, letters, or numbers.',
      'particle-evidence',
      'application',
      'diagram',
    ),
    slide(
      'New Case Transfer',
      ['Powdered juice mixing', 'Salt dissolving in soup', 'Smell spreading in a room'],
      'Let pairs choose one new case. Require one evidence link from the stations before drawing their model.',
      'Three small classroom-safe everyday science scenes shown as icons: powder mixing into water, salt entering soup, and scent particles spreading through a room, no text or labels.',
      'dissolving-diffusion',
      'application',
      'illustration',
    ),
    slide(
      'Exit Slip',
      ['Choose the stronger diagram', 'Explain dissolved sugar', 'Write one CER sentence', 'Find one home mixing example'],
      'Use the exit slip to identify who still thinks dissolved matter is gone or that models are exact pictures. The home example prepares the Session 2 evidence callback.',
      'A simple science exit-slip visual with a paper, a check mark, and a small particle diagram, no readable text or labels.',
      'assessment',
      'assessment',
      'illustration',
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
      'Cold or Warm Prediction',
      ['Predict which spreads faster', 'Underline the motion idea', 'Keep the same color amount'],
      'Ask learners to commit to a prediction before the test. Listen for “heat adds particles” as a misconception.',
      'Two clear cups of water side by side, one visually cool and one visually warm, each receiving the same small colored drop, no words, labels, letters, or numbers.',
      'diffusion-temperature',
      'situation',
      'diagram',
      [
        { id: 'cold-cup', text: 'Cold', x: 26, y: 18, fontSize: 18 },
        { id: 'warm-cup', text: 'Warm', x: 74, y: 18, fontSize: 18 },
      ],
    ),
    slide(
      'Fair Test Setup',
      ['Same cup size', 'Same color amount', 'Same start time', 'No stirring'],
      'Have pairs identify what must stay the same. Teacher handles or approves warm water.',
      'A clean science fair-test setup with two matching clear cups, two identical droppers, a simple timer icon, and still water, no readable text or labels.',
      'diffusion-temperature',
      'practice',
      'illustration',
    ),
    slide(
      'Watch the Spread',
      ['Record the start', 'Observe after 30 seconds', 'Observe after 2 minutes'],
      'Tell learners to observe silently for the first interval. They should describe spread, not just color.',
      'A three-stage visual sequence of colored particles spreading through water over time, with the warm side spreading wider than the cold side, no numbers or labels.',
      'diffusion-temperature',
      'practice',
      'diagram',
    ),
    slide(
      'What Pattern Appeared?',
      ['Warm water spreads faster', 'The color amount stayed same', 'Motion evidence changed'],
      'Build the class pattern from actual observations. If results vary, discuss handling error or temperature differences.',
      'Two transparent cups with colored particles: one compact slow plume in cool blue water and one wider fast plume in warm tinted water, no text or labels.',
      'diffusion-temperature',
      'generalization',
      'diagram',
    ),
    slide(
      'Particles Move Faster',
      ['Higher temperature increases motion', 'Faster motion spreads particles', 'Heat does not create particles'],
      'Use the class evidence to connect temperature to motion. Explicitly reject the idea that heat adds particles.',
      'A particle-motion diagram showing the same number of particles in two areas, with short motion trails in the cool area and longer motion trails in the warm area, no text or labels.',
      'diffusion-temperature',
      'concept',
      'diagram',
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
      'A cup of warm drink with sugar particles dispersing quickly through the liquid, with gentle steam and particle motion trails, no text or labels.',
      'diffusion-temperature',
      'application',
      'illustration',
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
      ['Temperature item', 'Spacing item', 'Attraction item', 'Evidence explanation'],
      'Collect the quick check. Sort responses by misconception for the next session opening.',
      'A simple assessment visual with a clipboard, check marks, and small particle-motion icons, no readable text or labels.',
      'assessment',
      'assessment',
      'illustration',
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
      'Three Samples, Three States',
      ['Solid sample', 'Liquid sample', 'Gas in a sealed bag'],
      'Show the samples. Ask how a particle diagram can show each state without drawing the object itself.',
      'A classroom science table with a solid object, a clear cup of water, and a sealed transparent bag containing air particles, no text or labels.',
      'particle-states',
      'situation',
      'illustration',
    ),
    slide(
      'Diagram Quality Checklist',
      ['Tag one strong diagram', 'Tag one flawed diagram', 'Name the misleading feature', 'Fix it with evidence'],
      'Pairs tag one strong and one flawed diagram. Focus feedback on exact features that could mislead a learner.',
      'Two side-by-side particle diagrams, one scientifically organized and one visibly flawed with incorrect spacing, plus check icons, no words, letters, or labels.',
      'particle-states',
      'success-criteria',
      'diagram',
    ),
    slide(
      'Solid Particles',
      ['Close together', 'Orderly arrangement', 'Vibrate in place'],
      'Emphasize that solid particles are not motionless. Use short vibration arrows.',
      'A particle diagram of a solid: many equal-size particles packed close in an orderly grid with tiny vibration arrows, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
    ),
    slide(
      'Liquid Particles',
      ['Close together', 'Less orderly', 'Slide past each other'],
      'Contrast with solid: close spacing remains, but arrangement and motion change.',
      'A particle diagram of a liquid: equal-size particles close together but irregularly arranged, with curved arrows showing sliding motion, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
    ),
    slide(
      'Gas Particles',
      ['Far apart', 'Move freely', 'Travel in many directions'],
      'Correct the common error of drawing gas particles only slightly farther apart than liquid particles.',
      'A particle diagram of a gas: equal-size particles far apart with long motion arrows in many directions, no text or labels.',
      'particle-states',
      'concept',
      'diagram',
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
      'A student science worksheet with a particle diagram being revised using colored marks and a small mystery sample inset, no readable text or labels.',
      'particle-states',
      'application',
      'illustration',
    ),
    slide(
      'Peer Feedback Rule',
      ['Name one accurate feature', 'Name one needed revision', 'Explain the science reason'],
      'Model respectful, evidence-based critique. Require a reason, not just “looks wrong.”',
      'Two students reviewing a particle diagram on paper with simple check and edit icons, no readable writing or labels.',
      'particle-states',
      'practice',
      'illustration',
    ),
    slide(
      'Mini Diagram Check',
      ['Draw all three states', 'Write two comparisons', 'Circle one part to revise', 'Bring one phase-change example'],
      'Collect the independent diagrams. Look for spacing and motion errors before Session 4. The home example sets up the energy-direction probe.',
      'A clean mini assessment sheet with three empty diagram boxes represented visually and particle icons, no readable text or labels.',
      'assessment',
      'assessment',
      'illustration',
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
      'Melting and Droplets Probe',
      ['Ice changes to liquid water', 'Droplets form outside cold surfaces', 'Energy direction matters'],
      'Ask learners where the outside droplets came from. Use answers to surface the condensation misconception.',
      'A realistic classroom science scene with melting ice beside a cold bottle covered with outside droplets, plus subtle particle visuals around them, no text or labels.',
      'phase-change-energy',
      'situation',
      'illustration',
    ),
    slide(
      'Energy Direction Sort',
      ['Start with the state', 'Match the ending state', 'Choose absorbed or released'],
      'Groups sort state cards, phase-change cards, particle diagrams, and energy labels. Require one evidence reason before checking.',
      'A hands-on card sort table with state icons, particle diagrams, and energy arrow cards represented without readable words or labels.',
      'phase-change-energy',
      'practice',
      'illustration',
    ),
    slide(
      'Heating Row',
      ['Solid becomes liquid', 'Liquid becomes vapor', 'Particles gain energy'],
      'Connect melting and evaporation as energy-absorbing changes. Avoid treating vapor as “nothing.”',
      'A left-to-right particle diagram showing solid particles becoming liquid particles then widely spaced vapor particles, with warm energy arrows entering, no text or labels.',
      'phase-change-energy',
      'concept',
      'diagram',
    ),
    slide(
      'Cooling Row',
      ['Vapor becomes liquid', 'Liquid becomes solid', 'Particles lose energy'],
      'Connect condensation and freezing as energy-releasing changes. Use the cold bottle example.',
      'A right-to-left particle diagram showing vapor particles becoming liquid particles then ordered solid particles, with cool energy arrows leaving, no text or labels.',
      'phase-change-energy',
      'concept',
      'diagram',
    ),
    slide(
      'Four Phase Changes',
      ['Melting: solid to liquid', 'Evaporation: liquid to vapor', 'Condensation: vapor to liquid', 'Freezing: liquid to solid'],
      'Use this as the class explanation table, but keep the slide concise. The teacher can add labels as overlays if needed.',
      'A four-part science diagram of phase changes using only particle arrangements and arrows between states, no words, no labels, no letters, no numbers.',
      'phase-change-energy',
      'model',
      'diagram',
    ),
    slide(
      'Where Did Droplets Come From?',
      ['Water vapor was in the air', 'The cold surface removed energy', 'Vapor changed to liquid droplets'],
      'Directly correct the idea that droplets came from inside the bottle. Ask what evidence rules it out.',
      'A cold bottle with water droplets forming on the outside from nearby vapor particles in the air, with particles slowing and clustering on the surface, no text or labels.',
      'phase-change-energy',
      'application',
      'diagram',
    ),
    slide(
      'Everyday Phase-Change CER',
      ['Claim names the phase change', 'Evidence points to a clue', 'Reasoning explains energy direction'],
      'Groups choose cases like foggy mirror, drying clothes, melting ice cream, droplets outside a bottle, or freezing juice.',
      'Everyday phase-change scenes in a classroom-safe collage: foggy mirror, drying cloth, melting ice cream, cold bottle droplets, and freezing juice, no text or labels.',
      'phase-change-energy',
      'application',
      'illustration',
    ),
    slide(
      'Defend the Explanation',
      ['Use particle arrangement', 'Use particle motion', 'Use energy direction', 'Rule out a wrong answer'],
      'Have groups revise the weaker CER and prepare one sentence defending it to a classmate.',
      'Two students discussing a particle phase-change diagram with evidence icons and arrows, no readable writing or labels.',
      'phase-change-energy',
      'generalization',
      'illustration',
    ),
    slide(
      'Energy Direction Mastery Check',
      ['Name the phase change', 'Identify start and end states', 'Choose absorbed or released', 'Explain the particle change'],
      'Give the independent six-item check from the lesson plan: melting ice, drying puddle, foggy mirror, cold bottle droplets, freezing juice, and steam cooling on a lid. Score for state change, energy direction, and particle explanation.',
      'A clean science mastery-check visual showing six small phase-change cases with particle arrangements and energy arrows, no readable text, no letters, and no labels.',
      'assessment',
      'assessment',
      'illustration',
    ),
    slide(
      'Assignment and Reflection',
      ['Document one home phase change', 'Explain starting and ending states', 'Include motion and energy direction'],
      'Assign the home connection and collect one teacher reflection note: which phase change caused the most confusion, and what evidence helped learners correct it. Remind learners that a written observation or simple sketch is enough.',
      'A notebook beside a glass with condensation and a small melting ice cube, with simple particle sketch icons but no readable text or labels.',
      'assignment',
      'assignment',
      'illustration',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Session 1 Flow and Timing',
      ['5 min: quick claims', '4 min: air demo', 'Two 6 min stations', '8 min: transfer model', '7 min: exit slip'],
      'Use this slide as the teacher pacing guide. Keep the activity moving so learners have time to revise their model before the exit slip.',
      '',
    ),
    slide(
      'Evidence Table Routine',
      ['Observe without disturbing', 'Record what changed or stayed', 'Infer particle behavior', 'Choose the strongest evidence'],
      'This is the core student task. Learners should not simply draw; they must connect observation, inference, and evidence.',
      'A clean science worksheet visual with three observation rows, particle icons, and a highlighted evidence choice, no readable text or labels.',
      'particle-evidence',
      'practice',
      'illustration',
    ),
    slide(
      'Support, Safety, and Output',
      ['Use sentence stems', 'Use particle word bank', 'Do not taste solutions', 'Wipe spills immediately', 'Submit table and model'],
      'Give sentence stems to learners who need support: I observed ____. I infer that particles ____. My evidence is ____.',
      '',
    ),
  ],
  2: [
    slide(
      'Session 2 Flow and Timing',
      ['5 min: prediction markup', '15 min: timing test', '10 min: motion model', '12 min: transfer chain', '8 min: quick check'],
      'The timing test should drive the explanation. Do not let learners jump to a memorized rule without evidence.',
      '',
    ),
    slide(
      'Fair-Test Evidence',
      ['Same cup size', 'Same color amount', 'Same start time', 'No stirring', 'Compare spread over time'],
      'Ask learners which variables must stay the same. The warm/cold comparison only works if the test is fair.',
      'Two matched cups with identical drops of color entering still water, one cool and one warm, with a timer icon and no readable text or labels.',
      'diffusion-temperature',
      'practice',
      'diagram',
    ),
    slide(
      'Support, Safety, and Output',
      ['Use motion word bank', 'Use cause-effect stem', 'Teacher handles warm water', 'Submit data table', 'Submit transfer chain'],
      'Use the stem: Higher temperature -> particles move ____ -> spreading or dissolving happens ____ because ____.',
      '',
    ),
  ],
  3: [
    slide(
      'Session 3 Flow and Timing',
      ['5 min: state prediction', '8 min: diagram tagging', '15 min: three-panel build', '12 min: mystery revision', '10 min: mini check'],
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
      ['Use visual state cards', 'Use diagram checklist', 'Keep water off walkways', 'Do not inflate balloons by mouth', 'Submit revised diagram set'],
      'Give checklist support before groups revise. The concrete output is the three-state particle diagram with a mystery-sample inset and revision note.',
      '',
    ),
  ],
  4: [
    slide(
      'Session 4 Flow and Timing',
      ['6 min: energy probe', '12 min: card sequence', '12 min: explanation table', '10 min: everyday CER', '10 min: mastery check'],
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
      ['Use phase-change word bank', 'Use partially filled table', 'Teacher handles warm water', 'Submit sequence table', 'Submit everyday CER'],
      'For condensation, explicitly correct the misconception that outside droplets come from inside the bottle.',
      '',
    ),
  ],
};

const getSessionSlides = (dayNumber: number): Slide[] => {
  const slides = sessionSlides[dayNumber];
  if (!slides) return [];

  const [goalSlide, ...remainingSlides] = slides;
  return [
    goalSlide,
    ...(sessionDetailSlides[dayNumber] || []),
    ...remainingSlides,
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
