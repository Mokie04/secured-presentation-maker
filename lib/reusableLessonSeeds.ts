import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  getDigestiveK12CompleteLessonPlanSeed,
  getDigestiveK12LessonPlanSeed,
  getDigestiveK12PlanUnitSlidesSeed,
  isReusableDigestiveLesson,
} from './digestiveLessonSeed';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const PARTICLE_MODEL_TOPIC = 'Particle Model of Matter';
const PARTICLE_MODEL_COMPETENCY = 'Recognize that scientists use models to explain phenomena that cannot be easily seen or detected; Describe the Particle Model of Matter as "All matter is made up of tiny particles with each pure substance having its own kind of particles." Describe that particles are constantly in motion, have spaces between them, attract each other, and move faster as the temperature increases (or with the addition of heat). Use diagrams and illustrations to describe the arrangement, spacing, and relative motion of the particles in each of the three states (phases) of matter. Explain the changes of state in terms of particle arrangement and energy changes: a. solid -> liquid -> vapor b. vapor -> liquid -> solid';

const PARTICLE_MODEL_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify observable evidence from dissolving, diffusion, and air compression, then describe matter as tiny particles by using different symbols for different pure substances in a labeled particle model.',
  'By the end of Session 2, learners compare cold-water and warm-water diffusion evidence, then explain particle motion, spacing, attraction, and the effect of higher temperature using a cause-effect chain.',
  'By the end of Session 3, learners construct and revise particle diagrams for solid, liquid, and gas, showing arrangement, spacing, and relative motion with evidence-based labels.',
  'By the end of Session 4, learners evaluate and defend explanations of melting, evaporation, condensation, and freezing using particle arrangement, particle motion, and energy direction.',
];

const particleModelBlueprint: LessonBlueprint = {
  mainTitle: 'Particle Model of Matter: Evidence, Motion, States, and Phase Changes',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 7',
  quarter: 'First Term',
  learningCompetency: PARTICLE_MODEL_COMPETENCY,
  smartObjectives: [...PARTICLE_MODEL_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...PARTICLE_MODEL_LEARNING_OBJECTIVES],
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
    'Learning Map',
    ['Evidence for particles', 'Temperature and motion', 'Accurate state diagrams', 'Phase-change explanations'],
    'Preview the learning arc: learners first gather evidence, then explain motion, then build accurate diagrams, then use those ideas for phase changes.',
    '',
  ),
  slide(
    'How We Will Learn Like Scientists',
    ['Observe before explaining', 'Separate evidence from inference', 'Draw models for unseen particles', 'Revise when evidence improves'],
    'Use this as the class norm for the whole sequence. Tell learners that wrong first ideas are useful if they can improve them with evidence.',
    '',
  ),
];

const sessionStructure: Record<number, { objective: string; question: string; evidence: string; output: string }> = {
  1: {
    objective: PARTICLE_MODEL_LEARNING_OBJECTIVES[0],
    question: 'How can evidence show that matter is made of tiny particles?',
    evidence: 'Dissolving, diffusion, and compression',
    output: 'Evidence table, evidence-based particle model, revision note, and defense sentence',
  },
  2: {
    objective: PARTICLE_MODEL_LEARNING_OBJECTIVES[1],
    question: 'How does temperature affect particle motion, spacing, and attraction?',
    evidence: 'Cold and warm diffusion test',
    output: 'Fair-test observation table, same-time evidence comparison, cause-effect chain, transfer correction',
  },
  3: {
    objective: PARTICLE_MODEL_LEARNING_OBJECTIVES[2],
    question: 'How should each state be modeled?',
    evidence: 'Sample states and diagram criteria',
    output: 'Revised solid-liquid-gas diagram set with spacing, arrangement, motion labels, and evidence-based revision note',
  },
  4: {
    objective: PARTICLE_MODEL_LEARNING_OBJECTIVES[3],
    question: 'How do particles explain phase changes?',
    evidence: 'Melting, condensation, and sorting',
    output: 'Completed sequence table, energy-direction sort, everyday CER, and defense sentence',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const day = particleModelBlueprint.days.find((candidate) => candidate.dayNumber === dayNumber);
  const structure = sessionStructure[dayNumber];

  return slide(
    day?.title || 'Lesson Focus',
    [structure.objective, `Inquiry question: ${structure.question}`, `Evidence source: ${structure.evidence}`, `Expected output: ${structure.output}`],
    `Use this opener to orient learners before the first task. Keep the focus on the objective, the inquiry question, and the concrete output they will submit. Ask: What will count as proof that we met today's objective?`,
    '',
  );
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Learning Target: Evidence for Particles',
      ['Use observations before explanations', 'Build a model from evidence', 'Revise ideas that say matter disappears'],
      'Begin with the brief attendance and wellbeing bridge, then ask: What would count as evidence for something too small to see? What would make an explanation stronger than a guess?',
      '',
    ),
    slide(
      'Which Claim Can We Test?',
      ['Choose one claim', 'Write one observable clue', 'Be ready to revise your answer'],
      'Give learners one minute to vote silently: Did sugar disappear? Was color pushed? Is air empty? Ask: Which claim can we test with evidence today? What would you need to observe to change your mind?',
      '',
    ),
    slide(
      'What Do You Notice First?',
      ['Look at each setup silently', 'Record only what you can observe', 'Save explanations for later'],
      'Show the three setup cards or demonstrations. Ask: What do you notice in the sugar cup? What do you notice in the colored water? What do you notice when the syringe is pressed? Which detail can everyone verify?',
      'A high-resolution realistic classroom science photo of three safe demo setups on one lab table: sugar dissolving in a clear cup of water, a drop of food coloring spreading in still water, and a sealed needle-free syringe for air compression, natural light, accurate materials, no words, no labels, no text.',
      'particle-evidence',
      'situation',
      'photorealistic',
    ),
    slide(
      'What Is Evidence and What Is Explanation?',
      ['Observation: what you directly notice', 'Inference: what the evidence suggests', 'Model: how you show unseen particles'],
      'Have pairs classify their first answers. Ask: Which sentence is a direct observation? Which sentence explains something unseen? What makes a model different from a guess?',
      'A high-resolution realistic classroom photo of a teacher table with three blank evidence cards using simple non-text visual symbols only: an eye icon card, a connected-dots card, and a particle-cluster card, real paper and classroom lighting, no readable writing, no labels, no text.',
      'particle-evidence',
      'concept',
      'photorealistic',
    ),
    slide(
      'How Can Air Be Matter?',
      ['What happens to the syringe volume?', 'Why does the plunger resist?', 'What model explains unseen air?'],
      'Demonstrate the needle-free sealed syringe. Ask: What changed when the plunger moved? Why did it not go all the way down? What does that suggest about particles in air?',
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
      'Where Did the Sugar Go?',
      ['What changed after mixing?', 'What stayed in the cup?', 'What evidence shows sugar is still matter?'],
      'Guide learners away from “disappeared.” Ask: What did we observe before mixing? What did we observe after mixing? What evidence could show the sugar is still present without tasting?',
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
      'Why Does Color Spread Without Stirring?',
      ['What changes over time?', 'What stayed still?', 'What particle idea explains the spread?'],
      'Let learners observe without stirring. Ask: What changed during the first minute? What stayed the same in the setup? How can spreading happen if no one stirred the water?',
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
      'Which Evidence Is Strongest?',
      ['Rank the three evidence cases', 'Choose the strongest observation', 'Connect the cases to one particle idea', 'Reject one weak explanation'],
      'Pairs must speak in this order: observation first, inference second, model last. Ask: Which evidence would convince another group? What evidence rejects the idea that matter disappeared? Which explanation fits sugar, color, and air at the same time? If learners rank only the most dramatic visual, push them to defend the ranking with observable evidence.',
      'A high-resolution realistic classroom discussion photo of student hands sorting three demo photo cards on a table: sugar dissolving, blue dye spreading in still water, and a compressed needle-free syringe, with blank evidence cards arranged into three columns and small particle-symbol cards nearby, no readable writing, no labels, no text.',
      'particle-evidence',
      'discussion',
      'photorealistic',
      [
        { id: 'discussion-observation', text: 'Observation', x: 24, y: 18, fontSize: 16 },
        { id: 'discussion-inference', text: 'Inference', x: 52, y: 18, fontSize: 16 },
        { id: 'discussion-model', text: 'Model', x: 78, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'What Pattern Do We See?',
      ['Post one evidence sentence', 'Separate observation from inference', 'Cross out one weak explanation', 'Rewrite it with particles'],
      'Collect group evidence. Ask: Which observations appear in more than one case? Which explanations are still guesses? How can we rewrite "sugar disappeared" as an evidence-based particle explanation? Listen for three misconceptions: matter disappeared, air is empty, and color moved only because water was disturbed.',
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
      'Can Your Model Match the Evidence?',
      ['Choose one case', 'Use different symbols for different substances', 'Show spacing or motion', 'Point to the evidence your model explains'],
      'Pairs create the four-box organizer. Ask: Which particles represent each substance? What does your model show that we could not see directly? Which observation does each part of your model explain?',
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
      'Which Model Is More Scientific?',
      ['Which model keeps matter?', 'Which model uses different symbols?', 'What revision makes the model stronger?', 'What evidence supports the revision?'],
      'Before groups submit, compare two model cards publicly. Ask: Which model accidentally shows matter disappearing? Which model uses evidence better? What exact revision would make the weaker model scientific? Name the rule explicitly: a scientific model keeps the same matter, uses distinct symbols for distinct pure substances, and explains an observation.',
      'A high-resolution realistic classroom discussion photo of two student particle-model cards side by side on a desk: one model accurately shows sugar particles spread among water particles, the other flawed model leaves missing particles after dissolving, colored pencils and the dissolving cup nearby, no readable writing, no labels, no text.',
      'particle-evidence',
      'discussion',
      'photorealistic',
      [
        { id: 'model-stronger', text: 'Stronger model', x: 30, y: 20, fontSize: 16 },
        { id: 'model-revise', text: 'Needs revision', x: 72, y: 20, fontSize: 16 },
        { id: 'model-evidence-check', text: 'Evidence check', x: 52, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Can Your Model Explain a New Case?',
      ['Choose one new case', 'Use evidence from today', 'Draw before and after', 'Explain what changed and what stayed matter'],
      'Let pairs choose one new case. Ask: Which investigation from today is most similar? What evidence can you reuse? What would your model need to show before and after?',
      'A high-resolution realistic classroom-safe collage photo on a lab table showing powdered drink mix entering a clear glass of water, salt beside a small bowl of soup, and a small covered scent container for smell diffusion, natural lighting, no words, no labels, no text.',
      'dissolving-diffusion',
      'application',
      'photorealistic',
    ),
    slide(
      'Final Output: Claim, Evidence, Model',
      ['Claim: matter is made of tiny particles', 'Evidence: one observation from a station', 'Model: symbols show different substances', 'Reasoning: matter did not disappear', 'Transfer: one home example'],
      'Use this as the exit rubric. Score quickly: 1 point for claim, 1 for direct observation, 1 for particle model with different symbols, 1 for reasoning that matter did not disappear, and 1 for a home transfer. Ask: What claim can you now defend? What evidence supports it? How does your particle model explain it?',
      'A high-resolution realistic classroom photo of an exit-slip station: a blank paper slip, pencil, small accurate particle diagram card, and clear cup from the dissolving demo on a desk, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  2: [
    slide(
      'Learning Target: Temperature and Motion',
      ["Use yesterday's particle evidence", 'Compare cold-water and warm-water diffusion fairly', 'Explain motion, spacing, attraction, and temperature with evidence'],
      'Start by revisiting the Session 1 evidence board. Ask: If particles are already moving, what could temperature change? Make learners choose between amount of particles, speed of motion, spacing, and attraction before they see the test.',
      '',
    ),
    slide(
      "Yesterday's Evidence",
      ['Name one observation that showed particles exist', 'Name one particle inference from that observation', 'Predict what warming could change in the model'],
      'Use two learner examples from Session 1. Ask: Which part was directly observed? Which part was a model explanation? If we warm the water today, what part of the model might change?',
      '',
    ),
    slide(
      'Cold or Warm Prediction',
      ['Which cup will spread faster?', 'What must stay the same for the test to be fair?', 'What evidence would change your mind?'],
      'Ask learners to commit to a prediction before the test. Listen for “heat adds particles” and “cold particles stop moving” as misconceptions to revisit after evidence appears.',
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
      ['Same cup size and water amount', 'Same color drop and start time', 'Same observation times', 'Only temperature changes', 'No stirring'],
      'Have pairs identify what must stay the same before any drops are added. Teacher handles or approves warm water. Ask: If one group stirs and one group does not, can we still blame temperature?',
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
      ['Record what happens at the start', 'Observe after the same short time mark', 'Observe again after the same longer time mark', 'Describe spread, not just color darkness'],
      'Tell learners to observe silently for the first interval. Ask: Which cup shows a wider spread at the same time? What exactly do you see that proves it?',
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
      'What Counts as Faster?',
      ['Compare spread distance', 'Use the same time mark', 'Ignore color darkness alone', 'Explain evidence aloud'],
      'Stop the class before explanation. Have learners compare spread at the same time mark so they do not confuse darkness with speed. Ask: Which measurement or visual clue is fair evidence?',
      'A high-resolution realistic classroom discussion photo showing two clear cups from the warm-and-cold diffusion test at the same time mark, with a simple ruler strip and timer nearby, warm water plume spread wider and cold water plume more compact, student hands pointing to spread distance, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'discussion',
      'photorealistic',
      [
        { id: 'same-time', text: 'Same time', x: 50, y: 18, fontSize: 16 },
        { id: 'spread-distance', text: 'Spread distance', x: 58, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'What Pattern Appeared?',
      ['Warm water spread farther at the same time mark', 'The color amount stayed the same', 'The fair test changed temperature only', 'The evidence points to faster motion'],
      'Build the class pattern from actual observations. If results vary, discuss handling error, water temperature differences, or accidental stirring before accepting a claim.',
      'A high-resolution realistic close-up classroom photo comparing two transparent cups after the same blue food-coloring drop: one cold-water cup with a compact plume and one warm-water cup with a wider plume, same amount of color, no words, no labels, no text.',
      'diffusion-temperature',
      'generalization',
      'photorealistic',
    ),
    slide(
      'Particles Move Faster',
      ['Higher temperature increases particle motion', 'Faster motion spreads particles sooner', 'The number of particles does not increase', 'Cold particles still move'],
      'Use the class evidence to connect temperature to motion. Ask: Which part of the evidence supports faster motion? What evidence rules out “heat added more particles”?',
      'A high-resolution realistic classroom photo of two printed particle-motion model cards on a desk: the cool-water card shows the same number of particles with short motion trails, the warm-water card shows the same number with longer motion trails, accurate science diagram on paper, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'concept',
      'photorealistic',
      [
        { id: 'cool-motion', text: 'Slower motion', x: 26, y: 78, fontSize: 16 },
        { id: 'warm-motion', text: 'Faster motion', x: 74, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Cause-Effect Chain',
      ['Higher temperature', 'Particles move faster but stay the same matter', 'Spaces allow particles to spread through water', 'Color spreads faster at the same time mark', 'Evidence supports the claim'],
      'Have learners read the chain forward, then backward from evidence to claim. Require the word "because" in oral responses. Ask: Where do spacing and attraction fit without saying heat creates particles?',
      'A high-resolution realistic classroom photo of a warm-water diffusion cup beside four connected paper model cards: warm cup, faster particle motion, wider color plume, and evidence check symbol, accurate science model, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'discussion',
      'photorealistic',
      [
        { id: 'chain-temperature', text: 'Higher temperature', x: 18, y: 24, fontSize: 15 },
        { id: 'chain-motion', text: 'Faster motion', x: 40, y: 40, fontSize: 15 },
        { id: 'chain-spread', text: 'Faster spread', x: 62, y: 56, fontSize: 15 },
        { id: 'chain-evidence', text: 'Evidence', x: 82, y: 72, fontSize: 15 },
      ],
    ),
    slide(
      'Spacing and Attraction',
      ['Particles have spaces between them', 'Attraction keeps particles near each other', 'Higher temperature makes motion faster', 'Faster motion can overcome attraction more easily'],
      'Use hand models while seated. Keep the point qualitative. Ask: If particles attract, why can the color still spread? What changes when particles move faster?',
      'A high-resolution realistic classroom photo of three printed particle cards on a lab table showing close solid particles, close but sliding liquid particles, and far-apart gas particles with motion arrows, accurate diagrams on paper, no readable writing, no labels, no text.',
      'particle-states',
      'model',
      'photorealistic',
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
      ['Heat does not add particles', 'Cold particles still move', 'The same matter is present', 'Evidence must come from the fair test'],
      'Ask learners to correct one wrong statement using evidence from the investigation. Require the correction to mention the same-time comparison.',
      'A high-resolution realistic classroom photo of two printed particle model cards on a desk: one flawed warm-water model shows extra particles and is marked for revision, the corrected model shows the same number with faster motion trails, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'assessment',
      'photorealistic',
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
      'Learning Target: Particle Diagrams',
      ['Construct diagrams for solid, liquid, and gas', 'Show arrangement, spacing, and relative motion', 'Revise using evidence-based labels'],
      'Begin with the quick state prediction bridge, then tell learners that drawings must communicate science, not decoration. Ask: What must a diagram show so another learner can identify the state without seeing the object?',
      '',
    ),
    slide(
      'Sketch the Invisible',
      ['Draw particles for one familiar state quickly', 'Circle one uncertain part', 'Write one evidence reason', 'Expect to revise after the criteria'],
      'Do not correct drawings yet. Use the uncertain circles to show that scientific diagrams improve through criteria and evidence. Ask: Which part of your sketch is based on evidence and which part is still a guess?',
      '',
    ),
    slide(
      'Three Samples, Three States',
      ['Which sample keeps its shape?', 'Which sample flows and takes the container shape?', 'Which sample fills available space?', 'How can particles show that evidence?'],
      'Show the samples. Ask how a particle diagram can show each state without drawing the object itself. Require students to name the visible property before they draw the unseen particles.',
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
      ['Tag one strong diagram', 'Tag one flawed diagram', 'Name the misleading feature', 'Fix spacing, arrangement, or motion with evidence'],
      'Pairs tag one strong and one flawed diagram. Focus feedback on exact features that could mislead a learner. Ask: What feature would make someone confuse a liquid with a gas?',
      'A high-resolution realistic classroom photo of two printed particle diagrams side by side on a desk: one scientifically accurate diagram and one flawed diagram with incorrect spacing, with colored feedback markers nearby, no readable writing, no labels, no text.',
      'particle-states',
      'success-criteria',
      'photorealistic',
      [
        { id: 'check-accurate', text: 'Accurate feature', x: 29, y: 18, fontSize: 16 },
        { id: 'check-revise', text: 'Revise feature', x: 72, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Revision Codes',
      ['S = spacing', 'A = arrangement', 'M = motion arrows', 'E = evidence label'],
      'Introduce quick feedback codes before peer review. This makes feedback faster and more specific than "good" or "wrong." Ask learners to give one code and one science reason, not a decoration comment.',
      'A high-resolution realistic classroom photo of a particle-diagram peer review table with four small colored feedback stickers marked only by simple symbols for spacing, arrangement, motion arrows, and evidence, student hands placing stickers on a diagram sheet, no readable writing, no labels, no text.',
      'particle-states',
      'discussion',
      'photorealistic',
      [
        { id: 'code-spacing', text: 'Spacing', x: 22, y: 20, fontSize: 15 },
        { id: 'code-arrangement', text: 'Arrangement', x: 43, y: 20, fontSize: 15 },
        { id: 'code-motion', text: 'Motion', x: 64, y: 20, fontSize: 15 },
        { id: 'code-evidence', text: 'Evidence', x: 82, y: 20, fontSize: 15 },
      ],
    ),
    slide(
      'Solid Particles',
      ['Close together', 'Orderly arrangement', 'Vibrate in place', 'Do not draw solid particles as motionless'],
      'Emphasize that solid particles are not motionless. Ask: If a solid keeps its shape, what should the arrangement show? What kind of motion is still possible?',
      'A high-resolution realistic classroom photo of a printed solid-particle model card on a desk, showing equal-size particles packed close in an orderly grid with tiny vibration arrows, accurate diagram on paper, no readable writing, no labels, no text.',
      'particle-states',
      'concept',
      'photorealistic',
      [
        { id: 'solid-close', text: 'Close', x: 28, y: 22, fontSize: 16 },
        { id: 'solid-vibrate', text: 'Vibrate', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Liquid Particles',
      ['Close together', 'Less orderly than a solid', 'Slide past each other', 'Do not draw liquid particles far apart like gas'],
      'Contrast with solid: close spacing remains, but arrangement and motion change. Ask: What evidence from liquid water supports sliding motion and changing shape?',
      'A high-resolution realistic classroom photo of a printed liquid-particle model card on a desk, showing equal-size particles close together in an irregular arrangement with curved sliding arrows, accurate diagram on paper, no readable writing, no labels, no text.',
      'particle-states',
      'concept',
      'photorealistic',
      [
        { id: 'liquid-close', text: 'Close', x: 28, y: 24, fontSize: 16 },
        { id: 'liquid-slide', text: 'Slide past', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Gas Particles',
      ['Far apart', 'Move freely in many directions', 'Fill available space', 'Use much larger spacing than liquid'],
      'Correct the common error of drawing gas particles only slightly farther apart than liquid particles. Ask: How should the diagram show that gas fills the sealed bag?',
      'A high-resolution realistic classroom photo of a printed gas-particle model card on a desk, showing equal-size particles far apart with long motion arrows in many directions, accurate diagram on paper, no readable writing, no labels, no text.',
      'particle-states',
      'concept',
      'photorealistic',
      [
        { id: 'gas-far', text: 'Far apart', x: 30, y: 22, fontSize: 16 },
        { id: 'gas-free', text: 'Free motion', x: 70, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Compare the Three States',
      ['Solid: close, orderly, vibrating', 'Liquid: close, less orderly, sliding', 'Gas: far apart, free motion', 'Use equal-size particles for the same substance'],
      'Use this as the synthesis slide before learners revise their own diagrams. Ask: Which state pair is easiest to confuse in a drawing, and what feature prevents the confusion?',
      'A high-resolution realistic classroom photo of a three-panel particle-diagram worksheet on a desk showing solid, liquid, and gas with equal-size particles, correct spacing, and motion arrows, no readable writing, no labels, no text.',
      'particle-states',
      'generalization',
      'photorealistic',
      [
        { id: 'solid-label', text: 'Solid', x: 18, y: 14, fontSize: 18 },
        { id: 'liquid-label', text: 'Liquid', x: 50, y: 14, fontSize: 18 },
        { id: 'gas-label', text: 'Gas', x: 82, y: 14, fontSize: 18 },
      ],
    ),
    slide(
      'Mystery State Revision',
      ['Identify the sample state', 'Find one misleading feature', 'Make the exact correction', 'Write why the revision matches evidence'],
      'Groups revise a peer diagram using a mystery sample card such as oil, air in a ball, or ice. Ask: Which evidence from the sample tells you the state? Which diagram feature must change?',
      'A high-resolution realistic classroom close-up of student hands revising a particle-diagram worksheet with colored pencils beside a mystery sample card showing oil, ice, or air in a sealed bag, no readable writing, no labels, no text.',
      'particle-states',
      'application',
      'photorealistic',
    ),
    slide(
      'Peer Feedback Rule',
      ['Name one accurate feature', 'Name one needed revision', 'Explain the science reason', 'Owner decides and revises'],
      'Model respectful, evidence-based critique. Require a reason, not just “looks wrong.” Ask: What exact feature should the owner change, and what evidence supports the change?',
      'A high-resolution realistic classroom photo of two students from behind or hands-only reviewing a particle diagram on paper with colored revision marks and sticky notes, no faces emphasized, no readable writing, no labels, no text.',
      'particle-states',
      'practice',
      'photorealistic',
    ),
    slide(
      'Gallery Walk Revision',
      ['Leave one code', 'Write one reason', 'Do not redraw for them', 'Owner makes the fix'],
      'Use a short gallery walk so feedback stays precise. Require owners to decide whether the evidence supports the suggested revision.',
      'A high-resolution realistic classroom gallery-walk photo with several particle-diagram worksheets posted on a board, students from behind or hands-only placing small feedback notes and pointing at spacing, arrangement, and motion-arrow features, no readable writing, no labels, no text.',
      'particle-states',
      'discussion',
      'photorealistic',
      [
        { id: 'gallery-code', text: 'One code', x: 24, y: 18, fontSize: 16 },
        { id: 'gallery-reason', text: 'One reason', x: 50, y: 18, fontSize: 16 },
        { id: 'gallery-owner', text: 'Owner revises', x: 76, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Mini Diagram Check',
      ['Draw all three states', 'Label spacing, arrangement, and motion', 'Write two evidence-based comparisons', 'Bring one phase-change example'],
      'Score for spacing, arrangement, motion arrows, and evidence labels. The home example sets up the energy-direction probe. Do not accept drawings that show different particle sizes just because the state changed.',
      'A high-resolution realistic classroom photo of a blank mini assessment sheet with three empty diagram boxes, a pencil, and small solid-liquid-gas particle reference cards turned partly away so no writing is readable, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  4: [
    slide(
      'Learning Target: Phase Changes',
      ['Explain melting, evaporation, condensation, and freezing', 'Track arrangement, motion, and energy direction', 'Defend everyday examples with evidence'],
      'Frame the lesson around two questions: What changes in the particles, and where does energy go? Ask learners to avoid naming a phase change unless they can also name start state, end state, particle change, and energy direction.',
      '',
    ),
    slide(
      'Home Phase Change',
      ['Name your example', 'Choose start and end states', 'Predict whether energy is absorbed or released', 'Hold your answer until the evidence sort'],
      'Use examples learners brought from Session 3. Do not confirm answers yet; the card sequence will test the guesses. Ask: What visible clue tells you the starting state? What clue tells you the ending state?',
      '',
    ),
    slide(
      'Melting and Droplets Probe',
      ['Ice changes to liquid water', 'Droplets form outside cold surfaces', 'The starting matter may be invisible', 'Energy direction matters'],
      'Ask learners where the outside droplets came from. Use answers to surface the condensation misconception. Ask: What evidence rules out the idea that droplets leaked from inside the bottle?',
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
      ['Start with the beginning state', 'Match the ending state', 'Choose absorbed or released', 'Use arrangement and motion to justify the choice'],
      'Groups sort state cards, phase-change cards, particle diagrams, and energy labels. Require one evidence reason before checking. Ask: Did particles move faster or slower? Did spacing increase or decrease?',
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
      ['Start state', 'End state', 'Arrangement change', 'Motion change', 'Energy direction', 'Evidence clue'],
      'Groups complete one row at a time. Do not let learners name a phase change without also naming arrangement, motion, and energy direction. Ask: Which card proves the energy direction?',
      'A high-resolution realistic classroom discussion photo of a phase-change sequence table being assembled with icon-only cards for solid, liquid, and vapor particle arrangements, motion-arrow cards, and energy-direction arrows, student hands placing cards in a row, no readable writing, no labels, no text.',
      'phase-change-energy',
      'discussion',
      'photorealistic',
      [
        { id: 'sequence-start', text: 'Start state', x: 18, y: 20, fontSize: 15 },
        { id: 'sequence-end', text: 'End state', x: 36, y: 20, fontSize: 15 },
        { id: 'sequence-arrangement', text: 'Arrangement', x: 56, y: 20, fontSize: 15 },
        { id: 'sequence-motion', text: 'Motion', x: 72, y: 20, fontSize: 15 },
        { id: 'sequence-energy', text: 'Energy', x: 88, y: 20, fontSize: 15 },
      ],
    ),
    slide(
      'Heating Row',
      ['Solid becomes liquid', 'Liquid becomes vapor', 'Particles absorb energy', 'Motion and spacing increase'],
      'Connect melting and evaporation as energy-absorbing changes. Avoid treating vapor as “nothing.” Ask: What changes in arrangement? What changes in motion? Which arrow shows energy entering?',
      'A high-resolution realistic classroom photo of a printed heating sequence model on a desk: solid particles become liquid particles then widely spaced vapor particles, with warm energy arrows entering, accurate diagram on paper, no readable writing, no labels, no text.',
      'phase-change-energy',
      'concept',
      'photorealistic',
      [
        { id: 'heating-energy-in', text: 'Energy in', x: 50, y: 18, fontSize: 18 },
        { id: 'heating-motion-up', text: 'Motion increases', x: 72, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Cooling Row',
      ['Vapor becomes liquid', 'Liquid becomes solid', 'Particles release energy', 'Motion and spacing decrease'],
      'Connect condensation and freezing as energy-releasing changes. Use the cold bottle example. Ask: What evidence shows vapor became liquid outside the bottle?',
      'A high-resolution realistic classroom photo of a printed cooling sequence model on a desk: vapor particles become liquid particles then ordered solid particles, with cool energy arrows leaving, accurate diagram on paper, no readable writing, no labels, no text.',
      'phase-change-energy',
      'concept',
      'photorealistic',
      [
        { id: 'cooling-energy-out', text: 'Energy out', x: 50, y: 18, fontSize: 18 },
        { id: 'cooling-motion-down', text: 'Motion decreases', x: 30, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Four Phase Changes',
      ['Melting: solid to liquid, energy absorbed', 'Evaporation: liquid to vapor, energy absorbed', 'Condensation: vapor to liquid, energy released', 'Freezing: liquid to solid, energy released'],
      'Use this as the class explanation table, but keep the slide concise. Ask students to point to the arrangement change before reading the phase-change name.',
      'A high-resolution realistic classroom photo of a printed four-part phase-change particle model on a desk, showing solid, liquid, and vapor particle arrangements with arrows for melting, evaporation, condensation, and freezing, no readable writing, no labels, no text.',
      'phase-change-energy',
      'model',
      'photorealistic',
      [
        { id: 'phase-melting', text: 'Melting', x: 28, y: 25, fontSize: 16 },
        { id: 'phase-evaporation', text: 'Evaporation', x: 70, y: 25, fontSize: 16 },
        { id: 'phase-condensation', text: 'Condensation', x: 70, y: 76, fontSize: 16 },
        { id: 'phase-freezing', text: 'Freezing', x: 28, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Where Did Droplets Come From?',
      ['Water vapor was already in the air', 'The cold surface removed energy', 'Vapor particles slowed and came closer together', 'Vapor changed to liquid droplets'],
      'Directly correct the idea that droplets came from inside the bottle. Ask what evidence rules it out: the droplets are outside, the container is closed, and other cold surfaces show the same pattern.',
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
      ['Claim names the phase change and start/end states', 'Evidence points to a visible clue', 'Reasoning explains arrangement, motion, and energy direction', 'CER rules out one incorrect explanation'],
      'Groups choose cases like foggy mirror, drying clothes, melting ice cream, droplets outside a bottle, or freezing juice. Ask: What did you observe? What changed in the particles? Was energy absorbed or released?',
      'A high-resolution realistic photo collage of everyday phase changes: a foggy mirror, a drying cloth, melting ice cream in a cup, droplets outside a cold bottle, and juice freezing in a tray, clean classroom-safe composition, no words, no labels, no text.',
      'phase-change-energy',
      'application',
      'photorealistic',
    ),
    slide(
      'Defend the Explanation',
      ['Use particle arrangement', 'Use particle motion', 'Use energy direction', 'Use one visible evidence clue', 'Rule out a wrong answer'],
      'Have groups revise the weaker CER and prepare one sentence defending it to a classmate. Ask: Which sentence would convince someone who thinks the droplets came from inside the bottle?',
      'A high-resolution realistic classroom photo of a pair discussion over a phase-change particle diagram worksheet, with evidence cards and colored energy-arrow cards on the desk, hands pointing at the diagram, no readable writing, no labels, no text.',
      'phase-change-energy',
      'generalization',
      'photorealistic',
    ),
    slide(
      'Energy Direction Mastery',
      ['Melting ice', 'Drying puddle', 'Foggy mirror', 'Cold bottle droplets', 'Freezing juice', 'Steam on a lid'],
      'Give the independent six-item check from the lesson plan. Score each item for phase-change name, start/end states, energy direction, arrangement change, motion change, and evidence clue.',
      'A high-resolution realistic classroom photo of six small phase-change evidence stations arranged on one table: melting ice, drying water spot, fogged mirror tile, cold bottle droplets, freezing tray, and steam on a lid, accurate materials, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
    slide(
      'Assignment and Reflection',
      ['Document one home phase change', 'Explain starting and ending states', 'Include arrangement, motion, and energy direction', 'Add one evidence clue from the real example'],
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
      'Learning Sequence: Evidence for Particles',
      ['Claim vote', 'Assign roles and timing', 'Observe three evidence cases', 'Check the expected output', 'Build and revise a model', 'Exit with claim, evidence, model'],
      'Use this slide as the teacher pacing guide. Keep station talk tight so learners still have time to revise their model before the exit slip. The visible flow should tell learners what they will do, not what the teacher will lecture.',
      '',
    ),
    slide(
      'What Goes in the Evidence Table?',
      ['Which case are you studying?', 'What did you directly observe?', 'What particle idea does it suggest?', 'Which clue is strongest?'],
      'This is the core student task. Ask: Is this sentence an observation or an inference? What clue is strongest? Require one complete row before learners draw; otherwise models become guesses instead of evidence-based explanations.',
      'A high-resolution realistic classroom photo of an evidence-table routine setup: a mostly blank worksheet with three broad rows beside the sugar cup, food-coloring beaker, and needle-free syringe demo materials, colored sticky markers, and small particle-symbol cards, no readable writing, no labels, no text.',
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
      'Main Activity: Evidence Stations',
      ['Work with your group of three or four', 'Visit the air, sugar, and color stations', 'Observe first before giving explanations', 'Complete one evidence-table row per station', 'Build one particle model from your strongest evidence', 'Prepare one sentence to defend your model'],
      'This slide starts the main activity. Give the complete instructions before learners move. Ask: What will your group do first? What must be written before you draw? Which evidence will you use if another group challenges your model? Remind learners that the activity output is the completed evidence table plus one evidence-based particle model.',
      'A high-resolution realistic classroom photo showing the start of a student-centered evidence-stations activity: three clearly separated lab-table stations with a needle-free syringe, a sugar-and-water cup, and a blue food-coloring diffusion beaker, student hands holding a mostly blank evidence-table worksheet and colored pencils, teacher standing aside, natural classroom lighting, no readable writing, no labels, no text.',
      'particle-evidence',
      'activity',
      'photorealistic',
      [
        { id: 'activity-stations', text: '3 stations', x: 24, y: 18, fontSize: 16 },
        { id: 'activity-table', text: 'Evidence table', x: 52, y: 76, fontSize: 16 },
        { id: 'activity-model', text: 'Particle model', x: 78, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Expected Output: Evidence-Based Particle Model',
      ['Three evidence rows: air, sugar, and color', 'One model with different symbols for different substances', 'Before-and-after model keeps matter present', 'Defense sentence links observation to particle idea', 'Revision note fixes one weak explanation'],
      'Make the output criteria explicit before learners work independently. Connect each criterion to the objective: learners are proving the particle model with observations from dissolving, diffusion, and compression. Tell learners that a neat drawing is not enough; the output must show evidence, model, and reasoning.',
      'A high-resolution realistic classroom photo of the expected student output for an evidence-stations activity: a mostly blank evidence table beside a before-and-after particle model worksheet, colored dot symbols for different substances, sugar cup, blue diffusion beaker, and needle-free syringe nearby, no readable writing, no labels, no text.',
      'particle-evidence',
      'success-criteria',
      'photorealistic',
      [
        { id: 'output-table', text: 'Evidence table', x: 26, y: 20, fontSize: 16 },
        { id: 'output-model', text: 'Particle model', x: 68, y: 20, fontSize: 16 },
        { id: 'output-defense', text: 'Defense sentence', x: 52, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Roles, Timing, and Safety',
      ['Materials manager handles only assigned items', 'Recorder completes the evidence row', 'Speaker asks the group evidence question', 'Safety checker watches spills and syringe handling', 'Rotate when the timer signal is given'],
      'Assign roles before learners stand up. Recommended pacing: 1 minute role check, 4 minutes per station, 3 minutes choose strongest evidence, 6 minutes build model, 3 minutes revise and prepare the defense sentence. Safety reminder: no tasting, wipe spills immediately, and the syringe remains needle-free and gently sealed.',
      'A high-resolution realistic classroom photo of four student role cards, a timer, colored station markers, and the evidence-stations materials on a science table, showing organized group work setup, no readable writing, no labels, no text.',
      'station-roles-and-timing',
      'activity',
      'photorealistic',
      [
        { id: 'role-materials', text: 'Materials', x: 16, y: 20, fontSize: 16 },
        { id: 'role-recorder', text: 'Recorder', x: 38, y: 20, fontSize: 16 },
        { id: 'role-speaker', text: 'Speaker', x: 61, y: 20, fontSize: 16 },
        { id: 'role-safety', text: 'Safety', x: 83, y: 20, fontSize: 16 },
        { id: 'role-timer', text: 'Timer signal', x: 27, y: 65, fontSize: 16 },
      ],
    ),
  ],
  2: [
    slide(
      'Learning Sequence: Temperature and Motion',
      ['Evidence callback', 'Prediction and fair-test controls', 'Roles, timing, and safety', 'Warm-cold timing test', 'Same-time evidence comparison', 'Cause-effect chain and transfer', 'Quick check'],
      'The timing test should drive the explanation. Do not let learners jump to a memorized rule without evidence. The slide flow must keep students comparing evidence before naming the particle rule.',
      '',
    ),
    slide(
      'Fair-Test Evidence',
      ['Same cup size and water amount', 'Same color amount and start time', 'Same observation times', 'No stirring', 'Compare spread at the same time mark'],
      'Ask learners which variables must stay the same. The warm/cold comparison only works if the test is fair. Ask: What would make our evidence unfair or impossible to trust?',
      'A high-resolution realistic classroom science photo of two matched clear cups with identical drops of blue food coloring entering still water, one cup chilled with ice nearby and one warm cup with slight steam nearby, a plain timer object nearby, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'practice',
      'photorealistic',
    ),
    slide(
      'Main Activity: Warm and Cold Diffusion Test',
      ['Work with your group roles', 'Set two equal cups side by side', 'Add the same color drop at the same time', 'Do not stir either cup', 'Record spread at each time mark', 'Compare spread distance, not color darkness', 'Write a cause-effect explanation using evidence'],
      'This slide starts the main activity. Ask learners to repeat the procedure before starting: What must stay the same? What are we measuring? Why is stirring not allowed? Require the final output: data notes plus one cause-effect chain connecting temperature, particle motion, spacing, attraction, and spread.',
      'A high-resolution realistic classroom photo showing students beginning a warm-and-cold diffusion test with two identical clear cups, equal water levels, identical blue food-coloring droppers, a timer, and a mostly blank observation sheet, no stirring tools, student hands only, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'activity',
      'photorealistic',
      [
        { id: 'activity-cold-warm', text: 'Same setup', x: 50, y: 18, fontSize: 16 },
        { id: 'activity-no-stir', text: 'No stirring', x: 32, y: 78, fontSize: 16 },
        { id: 'activity-time', text: 'Time marks', x: 75, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Expected Output: Temperature-Motion Chain',
      ['Data notes compare cold and warm water at the same time marks', 'Claim states which cup spread faster', 'Reasoning links temperature, motion, spaces, and attraction', 'Evidence uses spread distance, not color darkness', 'Final chain avoids "heat adds particles"'],
      'Make the output criteria explicit before group work. Connect the product to the objective: learners must compare evidence, then explain motion, spaces, attraction, and temperature through a cause-effect chain supported by diffusion evidence.',
      'A high-resolution realistic classroom photo of the expected student output for a warm-and-cold diffusion test: two clear cups with different blue plume spread, a timer, a mostly blank data table, and a cause-effect chain organizer with icon-only arrows, no readable writing, no labels, no text.',
      'diffusion-temperature',
      'success-criteria',
      'photorealistic',
      [
        { id: 'output-data', text: 'Data notes', x: 27, y: 20, fontSize: 16 },
        { id: 'output-chain', text: 'Cause-effect chain', x: 66, y: 20, fontSize: 16 },
        { id: 'output-evidence', text: 'Evidence', x: 52, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Roles, Timing, and Safety: Temperature Test',
      ['Materials manager handles cups and droppers only when told', 'Recorder completes time-mark observations', 'Timer calls each observation moment', 'Speaker asks for evidence before explanation', 'Teacher approves warm water handling'],
      'Assign roles before learners move. Recommended pacing: 1 minute role check, 2 minutes prediction, 5 minutes setup and first observations, 4 minutes same-time comparison, 6 minutes cause-effect chain, 3 minutes transfer correction. Safety reminder: teacher handles hot or warm water, spills are wiped immediately, and no tasting.',
      'A high-resolution realistic classroom photo of role cards, a timer, two matched diffusion-test cups, blue food-coloring droppers, and a mostly blank data sheet arranged on a science table, no readable writing, no labels, no text.',
      'roles-timing-and-safety-temperature-test',
      'activity',
      'photorealistic',
      [
        { id: 'role-materials', text: 'Materials', x: 18, y: 22, fontSize: 16 },
        { id: 'role-recorder', text: 'Recorder', x: 38, y: 22, fontSize: 16 },
        { id: 'role-timer', text: 'Timer', x: 58, y: 22, fontSize: 16 },
        { id: 'role-speaker', text: 'Speaker', x: 80, y: 22, fontSize: 16 },
        { id: 'role-output', text: 'Evidence chain', x: 50, y: 72, fontSize: 16 },
      ],
    ),
    slide(
      'Support Before You Start',
      ['Motion word bank', 'Cause-effect stem', 'Teacher handles warm water', 'Submit data table', 'Submit transfer chain'],
      'Use the stem: Higher temperature -> particles move ____ -> spreading or dissolving happens ____ because ____. Do not accept "heat adds particles."',
      '',
    ),
  ],
  3: [
    slide(
      'Learning Sequence: Particle Diagrams',
      ['Invisible sketch', 'Sample evidence', 'Diagram criteria', 'Three-state model build', 'Expected output check', 'Revision cycle and gallery feedback', 'Mini check'],
      'Keep the emphasis on scientific diagrams, not decoration. Each drawing must explain spacing, arrangement, and motion. Learners should revise before submission, not after teacher grading.',
      '',
    ),
    slide(
      'Diagram Criteria',
      ['Spacing matches the state', 'Arrangement matches the state', 'Motion arrows are accurate', 'Particles stay equal-size for the same substance', 'Labels explain evidence'],
      'Use these criteria before peer feedback. Common errors: liquid too far apart, no motion in solids, gas not far enough apart, and different particle sizes by state.',
      'A high-resolution realistic classroom photo of a three-panel particle-diagram criteria sheet on a desk showing solid, liquid, and gas with correct spacing, arrangement, and motion-arrow differences, no readable writing, no labels, no text.',
      'particle-states',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Main Activity: Three-State Model Build',
      ['Begin with your assigned solid, liquid, or gas sample', 'Complete all three state diagrams before submission', 'Draw only particles, not the object', 'Show spacing, arrangement, and motion', 'Use equal-size particles unless substances are different', 'Apply one peer feedback code', 'Revise before submitting the final model'],
      'This slide starts the main activity. Ask: Which state is your group using as evidence first? How will your diagram show evidence without drawing the object? What makes a particle diagram misleading? Require each group to submit the revised three-state diagram set with one revision note.',
      'A high-resolution realistic classroom photo showing students starting a three-state particle-model build: an ice sample, a clear water cup, and a sealed air bag on a table, blank diagram worksheets with three empty boxes, colored pencils, and feedback-code stickers, student hands only, no readable writing, no labels, no text.',
      'particle-states',
      'activity',
      'photorealistic',
      [
        { id: 'activity-sample', text: 'Sample', x: 24, y: 18, fontSize: 16 },
        { id: 'activity-diagram', text: 'Particle diagram', x: 52, y: 74, fontSize: 16 },
        { id: 'activity-revise', text: 'Revise', x: 78, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Expected Output: Revised State Diagrams',
      ['One diagram each for solid, liquid, and gas', 'Spacing and arrangement match the state', 'Relative motion arrows match the state', 'Particles stay equal-size within the same substance', 'Evidence label explains why the diagram fits the state', 'Revision note explains what improved and why'],
      'Make the output criteria explicit before the build. Connect the product to the objective: learners are constructing and revising accurate particle diagrams using arrangement, spacing, relative motion, and evidence-based labels.',
      'A high-resolution realistic classroom photo of the expected student output for a three-state particle diagram task: a worksheet with three empty diagram boxes partly filled with colored particle dots and motion arrows, feedback-code stickers, colored pencils, and solid-liquid-gas sample cards nearby, no readable writing, no labels, no text.',
      'particle-states',
      'success-criteria',
      'photorealistic',
      [
        { id: 'output-three-diagrams', text: '3 diagrams', x: 24, y: 18, fontSize: 16 },
        { id: 'output-criteria', text: 'Spacing + motion', x: 58, y: 20, fontSize: 16 },
        { id: 'output-revision', text: 'Revision note', x: 72, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Roles, Timing, and Revision Cycle',
      ['Evidence checker connects sample property to diagram feature', 'Diagrammer draws particles and motion arrows', 'Reviewer gives one revision code and reason', 'Owner revises the final diagram set', 'Submit only after the revision note is written'],
      'Assign roles before the drawing cycle. Recommended pacing: 2 minutes quick sketch, 4 minutes criteria check, 8 minutes build all three diagrams, 4 minutes peer feedback, 5 minutes revision, 3 minutes mini check. Keep water samples away from walkways and use only teacher-prepared air samples.',
      'A high-resolution realistic classroom photo of revision-code cards, colored pencils, solid-liquid-gas sample cards, and a three-box particle diagram worksheet arranged for group work, no readable writing, no labels, no text.',
      'roles-timing-and-revision-cycle',
      'activity',
      'photorealistic',
      [
        { id: 'role-evidence', text: 'Evidence checker', x: 20, y: 20, fontSize: 16 },
        { id: 'role-diagrammer', text: 'Diagrammer', x: 42, y: 20, fontSize: 16 },
        { id: 'role-reviewer', text: 'Reviewer', x: 64, y: 20, fontSize: 16 },
        { id: 'role-owner', text: 'Owner revises', x: 82, y: 20, fontSize: 16 },
        { id: 'role-revision', text: 'Revision note', x: 50, y: 76, fontSize: 16 },
      ],
    ),
    slide(
      'Support Before You Submit',
      ['Visual state cards', 'Revision-code checklist', 'Keep water off walkways', 'No mouth-inflated balloons', 'Submit revised diagram set'],
      'Give checklist support before groups revise. The concrete output is the three-state particle diagram with a mystery-sample inset and one revision note.',
      '',
    ),
  ],
  4: [
    slide(
      'Learning Sequence: Phase Changes',
      ['Home example probe', 'Droplet misconception', 'Energy evidence rules', 'Phase-change evidence sort', 'Expected output check', 'Everyday CER defense', 'Mastery check'],
      'This session should make energy direction explicit. Keep returning to starting state, ending state, arrangement, particle motion, and energy transfer. Students should defend, not just name, each phase change.',
      '',
    ),
    slide(
      'Energy Evidence Rules',
      ['Name the starting state', 'Name the ending state', 'Track arrangement change', 'Track motion change', 'Decide whether energy is absorbed or released', 'Name the evidence clue'],
      'Use this rule set when learners defend melting, evaporation, condensation, and freezing explanations. Ask learners to reject any answer that names only the phase change without particle evidence.',
      'A high-resolution realistic classroom photo of a printed phase-change evidence-rules sheet on a desk, showing solid, liquid, and vapor particle arrangements with warm and cool energy arrows, no readable writing, no labels, no text.',
      'phase-change-energy',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Main Activity: Phase-Change Evidence Sort',
      ['Work with your group roles', 'Sort each case by starting state and ending state', 'Match the particle arrangement card', 'Match the motion-change card', 'Choose energy absorbed or released', 'Complete one sequence-table row at a time', 'Use the row to write a CER explanation'],
      'This slide starts the main activity. Ask: What is the starting state? What is the ending state? How did arrangement and motion change? Where did energy go? Require the output: a completed sequence table and one everyday CER using phase-change evidence.',
      'A high-resolution realistic classroom photo showing students beginning a phase-change evidence sort with icon-only cards for solid, liquid, vapor, particle arrangements, motion arrows, and energy-direction arrows, plus a mostly blank sequence table worksheet, student hands only, no readable writing, no labels, no text.',
      'phase-change-energy',
      'activity',
      'photorealistic',
      [
        { id: 'activity-start-end', text: 'Start to end', x: 25, y: 18, fontSize: 16 },
        { id: 'activity-particles', text: 'Particles', x: 52, y: 75, fontSize: 16 },
        { id: 'activity-energy', text: 'Energy', x: 78, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Expected Output: Phase-Change CER',
      ['Sequence table names starting and ending states', 'Explanation describes arrangement and motion changes', 'Energy direction is marked as absorbed or released', 'CER uses one everyday evidence clue', 'Defense sentence rules out one incorrect explanation', 'All four phase changes are checked before submission'],
      'Make the output criteria explicit before the sort. Connect the product to the objective: learners must evaluate and defend phase-change explanations with particle arrangement, motion, and energy direction.',
      'A high-resolution realistic classroom photo of the expected student output for a phase-change evidence task: a mostly blank sequence table, icon-only cards for solid liquid vapor particles, energy-direction arrows, and a CER organizer beside a cold bottle with droplets and melting ice, no readable writing, no labels, no text.',
      'phase-change-energy',
      'success-criteria',
      'photorealistic',
      [
        { id: 'output-sequence-table', text: 'Sequence table', x: 25, y: 18, fontSize: 16 },
        { id: 'output-energy', text: 'Energy direction', x: 66, y: 20, fontSize: 16 },
        { id: 'output-cer', text: 'CER', x: 52, y: 78, fontSize: 16 },
      ],
    ),
    slide(
      'Roles, Timing, and Safety: Phase-Change Sort',
      ['Case reader names the visible evidence clue', 'State matcher chooses start and end states', 'Particle modeler matches arrangement and motion cards', 'Energy checker chooses absorbed or released', 'Speaker defends one CER with evidence'],
      'Assign roles before the card sort. Recommended pacing: 2 minutes home-example prediction, 4 minutes droplet probe, 8 minutes evidence sort, 6 minutes sequence table, 6 minutes CER writing and defense, 4 minutes mastery check. Safety reminder: teacher handles warm water or steam demonstrations; learners observe at a safe distance.',
      'A high-resolution realistic classroom photo of role cards, phase-change evidence cards, energy-arrow cards, a timer, and a mostly blank sequence table arranged on a science table, no readable writing, no labels, no text.',
      'roles-timing-and-safety-phase-change-sort',
      'activity',
      'photorealistic',
      [
        { id: 'role-case', text: 'Case reader', x: 18, y: 20, fontSize: 16 },
        { id: 'role-state', text: 'State matcher', x: 38, y: 20, fontSize: 16 },
        { id: 'role-modeler', text: 'Particle modeler', x: 60, y: 20, fontSize: 16 },
        { id: 'role-energy', text: 'Energy checker', x: 82, y: 20, fontSize: 16 },
        { id: 'role-cer', text: 'CER defense', x: 50, y: 74, fontSize: 16 },
      ],
    ),
    slide(
      'Support Before You Submit',
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
  const flowSlides = detailSlides.filter((detailSlide) => /learning sequence/i.test(detailSlide.title));
  const studentRoutineSlides = detailSlides.filter((detailSlide) => !/learning sequence/i.test(detailSlide.title));
  const openingSlideCount = dayNumber === 1 ? 3 : 2;
  const openingSlides = remainingSlides.slice(0, openingSlideCount);
  const lessonSlides = remainingSlides.slice(openingSlideCount);

  return [
    sessionOpenerSlide(dayNumber),
    ...flowSlides,
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
  if (language !== 'EN') return null;
  if (isReusableDigestiveLesson(content)) return getDigestiveK12LessonPlanSeed();
  if (!isReusableParticleModelLesson(content)) return null;

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
  if (language !== 'EN') return null;
  if (isReusableDigestiveLesson(content)) return getDigestiveK12PlanUnitSlidesSeed(dayNumber);
  if (!isReusableParticleModelLesson(content)) return null;
  const slides = getSessionSlides(dayNumber);
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getReusableK12CompleteLessonPlanSeed = (
  content: string,
  language: 'EN' | 'FIL',
): CachedLessonPlanSeed | null => {
  if (language !== 'EN') return null;
  if (isReusableDigestiveLesson(content)) return getDigestiveK12CompleteLessonPlanSeed();
  if (!isReusableParticleModelLesson(content)) return null;

  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
