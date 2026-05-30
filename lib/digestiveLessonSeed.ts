import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const DIGESTIVE_TOPIC = 'Digestive Tract and Digestive Processes';
const DIGESTIVE_COMPETENCY = 'Using a labeled diagram, trace how food travels through the digestive tract and explain mechanical processing, secretion, digestion, absorption, and elimination. Use models, flow charts, diagrams, and simulations to explain how body systems work together, such as digestion and excretion.';
const DIGESTIVE_BODY_SYSTEM_IMAGE_STYLE = 'HD realistic anatomical educational illustration of the human digestive body system, accurate Grade 8 science anatomy, transparent torso cutaway, shaded organs, clear food-path arrows, clean medical-education lighting';
const DIGESTIVE_BODY_SYSTEM_IMAGE_AVOID = 'Avoid classroom tables, worksheets, printed cards, student hands, clip-art, cheap SVG style, decorative cartoons, unreadable labels, and any in-image text.';

const DIGESTIVE_LEARNING_OBJECTIVES = [
  'By the end of Session 1, learners identify the digestive tract organs, sequence the movement of food from mouth to anus, and distinguish tract organs from accessory organs using an annotated pathway map.',
  'By the end of Session 2, learners classify mechanical processing, secretion, and chemical digestion, then explain how each process changes food or helps digestion using evidence from classroom models and process cards.',
  'By the end of Session 3, learners analyze how digested nutrients are absorbed in the small intestine, explain why surface area matters, and trace undigested material toward elimination using a flow chart.',
  'By the end of Session 4, learners create, evaluate, and revise a complete digestive journey model that traces food movement and explains mechanical processing, secretion, digestion, absorption, and elimination with evidence-based captions.',
];

const digestiveBlueprint: LessonBlueprint = {
  mainTitle: 'Digestive Tract and Digestive Processes',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 8',
  quarter: 'First Term',
  learningCompetency: DIGESTIVE_COMPETENCY,
  smartObjectives: [...DIGESTIVE_LEARNING_OBJECTIVES],
  studentFacingObjectives: [...DIGESTIVE_LEARNING_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Food Pathway and Helper Organs',
      focus: 'Learners trace the food pathway from mouth to anus and distinguish tract organs from accessory organs.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Mechanical Processing, Secretion, and Chemical Digestion',
      focus: 'Learners classify digestive processes using model evidence and process cards.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Absorption, Surface Area, and Elimination',
      focus: 'Learners explain absorption through villi and trace undigested material toward elimination.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Complete Digestive Journey Model',
      focus: 'Learners synthesize the pathway and five digestive processes into an evidence-based model.',
      generationStatus: 'pending',
    },
  ],
};

const digestiveMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Science',
  topic: DIGESTIVE_TOPIC,
  gradeLevel: 'Grade 8',
  gradeBand: '7-10',
  learningCompetency: DIGESTIVE_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'photorealistic',
): ImageSemanticMetadata => ({
  ...digestiveMetadata,
  visualRole,
  slideTemplate,
  semanticAnchor,
  style,
});

const normalizeDigestiveImagePrompt = (imagePrompt: string): string => {
  if (!imagePrompt) return '';

  const concept = imagePrompt
    .replace(/^A high-resolution realistic classroom science photo of /, '')
    .replace(/^A high-resolution realistic classroom photo of /, '')
    .replace(/no readable writing, no labels, no text\.?$/i, '')
    .replace(/\b(classroom|student hands|students|teacher hand|teacher table|science table|clean classroom table|table|desk|printed|worksheet|organ cards?|process cards?|evidence cards?|helper-organ cards?|role cards?|cards?|sticky notes?|colored pencils?|pencils?|pencil|paper cracker pieces?|clear bag|water cup|droppers?|timer|exit slips?|peer-audit checklist|planning table|model materials?)\b/gi, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return `${DIGESTIVE_BODY_SYSTEM_IMAGE_STYLE}. Reinterpret the slide concept as an anatomy-first body-system visual: ${concept}. ${DIGESTIVE_BODY_SYSTEM_IMAGE_AVOID}`;
};

const slide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imagePrompt = '',
  slideTemplate = 'content',
  visualRole = 'content',
  style: ImageSemanticMetadata['style'] = 'photorealistic',
  imageOverlays?: Slide['imageOverlays'],
): Slide => {
  const normalizedImagePrompt = normalizeDigestiveImagePrompt(imagePrompt);

  return {
    title,
    content,
    speakerNotes,
    imagePrompt: normalizedImagePrompt,
    imageStyle: normalizedImagePrompt ? style : 'none',
    ...(normalizedImagePrompt ? { imageSemanticMetadata: metadataFor(slideTemplate, visualRole, `${title}. ${content.join(' ')}`, style) } : {}),
    ...(imageOverlays ? { imageOverlays } : {}),
  };
};

const initialSlides: Slide[] = [
  slide(
    digestiveBlueprint.mainTitle,
    ['Subject: Science', 'Grade Level: Grade 8', 'Term: First Term'],
    'Introduce the week as one coherent journey: pathway first, processes second, absorption and elimination third, and final model synthesis last.',
    'A high-resolution realistic classroom science photo of a Grade 8 digestive-system lesson setup: printed digestive tract diagram, organ cards, process cards, folded villi paper model, colored pencils, and blank flow-chart sheets on a clean classroom table, no readable writing, no labels, no text.',
    'overview',
    'overview',
    'photorealistic',
  ),
  slide(
    'Learning Objectives',
    digestiveBlueprint.studentFacingObjectives,
    'Read the objectives as a progression. Emphasize that learners will not just label organs; they will explain movement, process, absorption, elimination, and evidence.',
    '',
  ),
  slide(
    'Learning Map',
    ['Food pathway and helper organs', 'Digestive processes and model evidence', 'Absorption and elimination paths', 'Complete digestive journey model'],
    'Preview the learning arc. Ask learners which part sounds like labeling and which part sounds like explanation.',
    '',
  ),
  slide(
    'How We Will Learn Like Scientists',
    ['Trace the pathway before explaining processes', 'Use models without pretending they are exact', 'Separate tract organs from helper organs', 'Revise captions when evidence improves'],
    'Set expectations for the week: arrows must show real food movement, captions must explain processes, and models must be revised when evidence shows a weak part.',
    '',
  ),
];

const sessionStructure: Record<number, { objective: string; question: string; evidence: string; output: string }> = {
  1: {
    objective: DIGESTIVE_LEARNING_OBJECTIVES[0],
    question: 'Which organs does food pass through, and which organs help digestion without food passing through them?',
    evidence: 'Bite route prediction, pathway cards, tract-or-helper board, arrowed diagram',
    output: 'Annotated pathway map with tract arrows, accessory-organ notes, and misconception correction',
  },
  2: {
    objective: DIGESTIVE_LEARNING_OBJECTIVES[1],
    question: 'Why is breaking food into smaller pieces not the same as complete digestion?',
    evidence: 'Crush-mix-secretions model, process cards, annotated mouth-and-stomach passage',
    output: 'Three-process evidence table, process chart, and quick-check explanation',
  },
  3: {
    objective: DIGESTIVE_LEARNING_OBJECTIVES[2],
    question: 'What happens after digestion: what enters the body, and what stays in the digestive tract?',
    evidence: 'Nutrient-or-waste fork, villi fold-and-dot test, two-path flow chart',
    output: 'Absorption-elimination flow chart with surface-area evidence and misconception repairs',
  },
  4: {
    objective: DIGESTIVE_LEARNING_OBJECTIVES[3],
    question: 'What makes a digestive journey model accurate enough to teach someone else?',
    evidence: 'Week evidence cards, caption clinic, peer audit, final defense',
    output: 'Complete digestive journey model with path arrows, helper notes, five process captions, evidence links, and revision note',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const day = digestiveBlueprint.days.find((candidate) => candidate.dayNumber === dayNumber);
  const structure = sessionStructure[dayNumber];

  return slide(
    day?.title || 'Lesson Focus',
    [structure.objective, `Inquiry question: ${structure.question}`, `Evidence source: ${structure.evidence}`, `Expected output: ${structure.output}`],
    'Use this opener to make the objective, inquiry question, evidence, and output visible before the first task. Ask: What will count as proof that we met the objective today?',
    '',
  );
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Learning Target: Food Pathway',
      ['Sequence the digestive tract from mouth to anus', 'Distinguish tract organs from accessory organs', 'Annotate a pathway map with arrows and helper notes'],
      'Start with the bridge prompt from the lesson plan. Ask: After you swallow food, where does it go first, next, and last? Which organs are you unsure about?',
      '',
    ),
    slide(
      'Bite Route Prediction',
      ['Write a three-part route for one bite of food', 'Underline one organ you are unsure about', 'Mark whether food passes through it or it only helps'],
      'Give learners one quiet minute before partner comparison. Ask: What makes you think food passes through an organ instead of only being helped by it?',
      '',
    ),
    slide(
      'What Does Food Pass Through?',
      ['Look at the torso diagram carefully', 'Trace only the tube food enters and leaves', 'Save helper organs for a separate area'],
      'Show the diagram and withhold the answer. Ask: Which organ comes first after the mouth? Which organ comes last before waste leaves? Which organs are near the pathway but not inside it?',
      'A high-resolution realistic classroom photo of a printed educational torso diagram of the digestive system on a desk, with separate blank organ cards and colored arrows beside it, accurate school anatomy, no readable writing, no labels, no text.',
      'digestive-pathway',
      'situation',
      'photorealistic',
    ),
    slide(
      'Pathway Build Evidence Check',
      ['Place tract cards in food-path order', 'Draw arrows only where food actually passes', 'Put helper organs beside the correct tract region', 'Stop for a pathway check before copying'],
      'This is the first main evidence task. Groups must build one food-path line and one helper-organ area. Ask: What mistake would happen if we drew food going through the liver?',
      'A high-resolution realistic classroom photo of student hands arranging digestive organ cards into a mouth-to-anus path line, with helper-organ cards placed to the side, colored arrows, and a blank path mat, no readable writing, no labels, no text.',
      'digestive-pathway',
      'activity',
      'photorealistic',
      [
        { id: 'path-line', text: 'Food path', x: 48, y: 76, fontSize: 16 },
        { id: 'helper-area', text: 'Helper organs', x: 78, y: 25, fontSize: 16 },
      ],
    ),
    slide(
      'Pathway Checkpoint: Mouth to Anus',
      ['Mouth', 'Esophagus', 'Stomach', 'Small intestine', 'Large intestine', 'Rectum', 'Anus'],
      'Check the sequence before learners copy. Ask: Which cards are missing if the path jumps from stomach to large intestine? Where should arrows point?',
      'A high-resolution realistic classroom photo of a completed digestive pathway card line on a table, showing seven blank organ-card positions connected by arrows from mouth to anus, with helper cards outside the path, no readable writing, no labels, no text.',
      'digestive-pathway',
      'practice',
      'photorealistic',
    ),
    slide(
      'Tract or Helper Evidence Board',
      ['Food passes through tract organs', 'Helper organs release or store substances', 'A helper organ can be important without being in the food path'],
      'Build the two-column board. Ask: What evidence shows the esophagus is a pathway? Why are liver and pancreas not in the food path? How does this prepare us to explain digestion later?',
      'A high-resolution realistic classroom photo of a two-column evidence board with digestive tract cards on one side and helper-organ cards on the other, arrows and blank sticky notes, no readable writing, no labels, no text.',
      'digestive-pathway',
      'discussion',
      'photorealistic',
      [
        { id: 'tract', text: 'Food passes through', x: 30, y: 18, fontSize: 16 },
        { id: 'helpers', text: 'Helps digestion', x: 72, y: 18, fontSize: 16 },
      ],
    ),
    slide(
      'Mouth and Esophagus: First Movement',
      ['Mouth starts mechanical processing', 'Swallowing moves food into the esophagus', 'The esophagus is a pathway, not a storage organ'],
      'Model one annotation. Ask: What arrow shows the path? What function label is short but useful?',
      'A high-resolution realistic classroom photo of a printed mouth-and-esophagus pathway diagram card beside colored pencils and arrows, accurate school anatomy, no readable writing, no labels, no text.',
      'digestive-pathway',
      'concept',
      'photorealistic',
    ),
    slide(
      'Stomach and Intestines: Next Stops',
      ['Stomach mixes food', 'Small intestine receives digested nutrients for absorption', 'Large intestine moves undigested material toward elimination'],
      'Keep the explanation brief because Session 2 and 3 will deepen the processes. Ask: Which arrows still show food inside the tract?',
      'A high-resolution realistic classroom photo of printed stomach, small intestine, and large intestine cards connected with directional arrows on a desk, accurate school diagram style, no readable writing, no labels, no text.',
      'digestive-pathway',
      'concept',
      'photorealistic',
    ),
    slide(
      'Accessory Organs Help Digestion',
      ['Liver, gallbladder, and pancreas help digestion', 'Food does not pass through these helper organs', 'Helper notes belong beside the tract, not inside the path'],
      'Directly correct the common wrong route. Ask: How can an organ help digestion without food passing through it?',
      'A high-resolution realistic classroom photo of digestive helper-organ cards placed beside a tract diagram, with arrows pointing toward the small intestine region but not routing food through the helper organs, no readable writing, no labels, no text.',
      'digestive-pathway',
      'concept',
      'photorealistic',
    ),
    slide(
      'Arrow-and-Function Diagram',
      ['Add a direction arrow', 'Write one short function label', 'Add one helper-organ note where needed', 'Keep food movement separate from help'],
      'Teacher models mouth and esophagus first, then pairs annotate the rest. Ask: Does your arrow show movement or just decoration?',
      'A high-resolution realistic classroom photo of a blank digestive pathway worksheet being annotated with colored arrows, short function-note boxes, and helper-organ notes, no readable writing, no labels, no text.',
      'digestive-pathway',
      'application',
      'photorealistic',
    ),
    slide(
      'Common Pathway Mistake',
      ['Food does not go through the liver', 'Food does not go through the gallbladder', 'Food does not go through the pancreas', 'These organs help the tract do its work'],
      'Show a flawed map and have learners repair it. Ask: What evidence from the card build proves this route is wrong?',
      'A high-resolution realistic classroom photo of two digestive pathway maps side by side: one flawed map incorrectly routes food through helper organs, and one corrected map keeps helper organs outside the food path, no readable writing, no labels, no text.',
      'digestive-pathway',
      'misconception',
      'photorealistic',
    ),
    slide(
      'Food Path Exit Map',
      ['Number the seven tract organs in order', 'Cross out two helper organs that are not in the food path', 'Write one sentence correcting the misconception'],
      'Use this as the independent check. The answer must show a complete mouth-to-anus sequence and must not route food through liver, gallbladder, or pancreas.',
      'A high-resolution realistic classroom photo of a food-path exit map worksheet with seven blank numbered spaces, two helper-organ cards to cross out, and a pencil, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  2: [
    slide(
      'Learning Target: Digestive Processes',
      ['Classify mechanical processing, secretion, and chemical digestion', 'Use model evidence for each process', 'Explain why digestion is more than making food smaller'],
      'Begin with a quick recall of the food path. Tell learners that today explains what happens to food while it moves through the path.',
      '',
    ),
    slide(
      'Smaller Is Not Finished',
      ['Decide whether crushing alone is complete digestion', 'Name what changed about the food', 'Name what has not changed yet'],
      'Use the cracker/crumb probe. Ask: Why might the body need more than breaking food into pieces?',
      '',
    ),
    slide(
      'What Changed and What Did Not Change?',
      ['Crushing changes size and shape', 'Mixing helps contact digestive fluids', 'Chemical digestion changes food into smaller molecules'],
      'Keep the distinction visible before the model. Ask: Which change can we see directly, and which change needs a model or diagram?',
      'A high-resolution realistic classroom photo of a safe digestive-process model setup: paper cracker pieces in a clear bag, a small water cup representing secretion, process cards, and an enzyme-action diagram card on a desk, no readable writing, no labels, no text.',
      'digestive-processes',
      'situation',
      'photorealistic',
    ),
    slide(
      'Model Evidence: Crush, Mix, Secretions',
      ['Record what each model shows', 'Classify the process type', 'Write one limitation of the model', 'Do not call crushing complete chemical digestion'],
      'This slide starts the main activity. Teacher manages any real cracker demonstration; paper cracker is enough. Ask: What does the model show well? What can it not show?',
      'A high-resolution realistic classroom photo of student hands using a clear bag with paper cracker pieces, a small water cup for secretion model, process cards, and a mostly blank evidence table, no tasting, no readable writing, no labels, no text.',
      'digestive-processes',
      'activity',
      'photorealistic',
    ),
    slide(
      'Mechanical Processing',
      ['Food changes physically', 'Pieces become smaller', 'Chewing and stomach churning increase contact area', 'The food is not chemically changed yet'],
      'Ask: Which part of the model proves physical change? Why does smaller size help but not finish digestion?',
      'A high-resolution realistic classroom photo of a paper-cracker crushing model beside a printed digestive-process card showing chewing and stomach churning as physical changes, no readable writing, no labels, no text.',
      'digestive-processes',
      'concept',
      'photorealistic',
    ),
    slide(
      'Secretion',
      ['A gland or organ releases a digestive substance', 'The substance helps digestion happen', 'Saliva, stomach fluid, bile, and pancreatic juice are examples'],
      'Keep this age-appropriate and non-medical. Ask: Which part of the model represents a substance being released?',
      'A high-resolution realistic classroom photo of secretion model cards beside a small water cup and droppers, with helper-organ cards placed beside the digestive tract diagram, no readable writing, no labels, no text.',
      'digestive-processes',
      'concept',
      'photorealistic',
    ),
    slide(
      'Chemical Digestion',
      ['Food molecules are changed into smaller molecules', 'Enzymes and digestive fluids support this change', 'The process is unseen, so diagrams and models help explain it'],
      'Ask: Why is chemical digestion harder to observe than crushing? What evidence or model helps us explain it?',
      'A high-resolution realistic classroom photo of an enzyme-action diagram card beside process cards and a digestive tract worksheet, showing large food pieces becoming smaller nutrient symbols, no readable writing, no labels, no text.',
      'digestive-processes',
      'concept',
      'photorealistic',
    ),
    slide(
      'Process Sorting Wall',
      ['Place each card under mechanical processing, secretion, or chemical digestion', 'Defend one placement with because', 'Move a card if evidence changes your thinking'],
      'Groups defend one card. Ask: Which action physically changes food? Which action releases a substance? Which action changes food chemically?',
      'A high-resolution realistic classroom photo of a three-column process sorting wall with digestive process cards, student hands placing cards and blank sticky notes, no readable writing, no labels, no text.',
      'digestive-processes',
      'discussion',
      'photorealistic',
    ),
    slide(
      'Mouth and Stomach Annotation',
      ['Circle process words', 'Label the process type', 'Add one because-statement', 'Separate physical breakdown from chemical change'],
      'Model one annotated sentence, then pairs annotate chewing, saliva, stomach churning, acid, and enzymes. Ask: Why can saliva connect to both secretion and digestion?',
      'A high-resolution realistic classroom photo of an annotated mouth-and-stomach passage worksheet with colored process markers and process cards nearby, no readable writing, no labels, no text.',
      'digestive-processes',
      'application',
      'photorealistic',
    ),
    slide(
      'Model Limitation Check',
      ['A classroom model shows part of digestion', 'It cannot show every real body process', 'Strong explanations name both the use and the limit'],
      'Require the limitation sentence from the lesson plan. Ask: What would be misleading if we treated the clear-bag model as exact?',
      'A high-resolution realistic classroom photo of a model-limitation checklist beside the crush-mix-secretions materials and a digestive process diagram card, no readable writing, no labels, no text.',
      'digestive-processes',
      'misconception',
      'photorealistic',
    ),
    slide(
      'Three-Process Quick Check',
      ['Classify five examples', 'Explain why chewing helps digestion', 'Explain why chewing cannot replace secretions and chemical digestion'],
      'Use this as the independent check. Responses must separate physical breakdown, release of digestive substances, and chemical change.',
      'A high-resolution realistic classroom photo of a quick-check sheet with process cards, pencil, and small model materials arranged on a desk, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  3: [
    slide(
      'Learning Target: Absorption and Elimination',
      ['Explain absorption through small intestine and villi', 'Use surface-area evidence', 'Trace undigested material toward elimination'],
      'Begin with the prediction fork from the lesson plan. Make clear that useful nutrients and undigested material follow different paths.',
      '',
    ),
    slide(
      'Nutrient or Waste Fork',
      ['Choose the path for useful nutrients', 'Choose the path for undigested material', 'Explain what the body keeps and what leaves'],
      'Ask: What should the body keep? What should leave the body? Which organ comes before the large intestine in the food path?',
      '',
    ),
    slide(
      'What Should the Body Keep?',
      ['Useful nutrients move into the blood', 'Undigested material stays in the digestive tract', 'Absorption and elimination are not the same process'],
      'Surface the misconception that everything eaten becomes waste. Ask: What evidence would show that some material leaves the digestive tract and enters the body?',
      'A high-resolution realistic classroom photo of a two-path digestive flow card setup: useful nutrient-dot cards moving toward a blood-vessel card and undigested-material cards moving toward large intestine cards, no readable writing, no labels, no text.',
      'absorption-elimination',
      'situation',
      'photorealistic',
    ),
    slide(
      'Fold-and-Dot Evidence Check',
      ['Compare flat paper with folded or fringed paper', 'Count or estimate nutrient-dot contact points', 'Infer why folds help absorption', 'Connect folds to absorption, not storage'],
      'This is the main evidence activity. Ask: Which surface gives more contact points? What does that suggest about villi?',
      'A high-resolution realistic classroom photo of a villi surface-area model: flat paper strip and folded fringed paper strip with colored nutrient dots, a comparison table, and student hands counting contact points, no readable writing, no labels, no text.',
      'absorption-elimination',
      'activity',
      'photorealistic',
    ),
    slide(
      'Surface Area Evidence',
      ['More folds give more contact area', 'More contact area helps more nutrients be absorbed', 'The model explains structure and function'],
      'Ask learners to use the stem: More folds give more contact area, so more nutrients can ____. Check that they connect folds to absorption.',
      'A high-resolution realistic classroom photo of the folded-villi paper model beside nutrient-dot markers and a completed-looking but unreadable comparison table, no readable writing, no labels, no text.',
      'absorption-elimination',
      'discussion',
      'photorealistic',
    ),
    slide(
      'Small Intestine and Villi',
      ['Small intestine is the main absorption site', 'Villi increase surface area', 'Digested nutrients move through the villi into blood'],
      'Keep the circulatory connection simple. Ask: Why does surface area matter for absorption?',
      'A high-resolution realistic classroom photo of a printed small-intestine-and-villi diagram card beside the folded paper villi model and nutrient-dot cards, accurate educational anatomy, no readable writing, no labels, no text.',
      'absorption-elimination',
      'concept',
      'photorealistic',
    ),
    slide(
      'Nutrients Enter Blood',
      ['Digested nutrients leave the digestive tract', 'Blood carries nutrients to body cells', 'This connects digestion to another body system'],
      'Do not overextend into detailed circulatory content. Ask: What enters the blood, and what stays in the tract?',
      'A high-resolution realistic classroom photo of an educational flow model showing nutrient-dot cards moving from small intestine/villi cards to a simple blood-vessel card and body-cell card, no readable writing, no labels, no text.',
      'absorption-elimination',
      'concept',
      'photorealistic',
    ),
    slide(
      'Undigested Material Continues',
      ['Some material is not absorbed', 'It moves to the large intestine', 'Rectum and anus complete elimination'],
      'Ask: Why is “digestion ends in the stomach” wrong? What still has to happen after the small intestine?',
      'A high-resolution realistic classroom photo of a large-intestine elimination path card sequence with undigested-material markers moving toward rectum and anus cards, no readable writing, no labels, no text.',
      'absorption-elimination',
      'concept',
      'photorealistic',
    ),
    slide(
      'Two-Path Digestion Map',
      ['Digested nutrients -> small intestine and villi -> blood -> cells', 'Undigested material -> large intestine -> rectum -> anus', 'The two paths answer different questions'],
      'Co-construct the class flow chart. Ask: Which path shows useful nutrients? Which path shows waste leaving?',
      'A high-resolution realistic classroom photo of a two-path digestion flow chart being assembled with nutrient-dot cards, villi cards, blood-vessel card, large intestine card, rectum card, and anus card, no readable writing, no labels, no text.',
      'absorption-elimination',
      'generalization',
      'photorealistic',
    ),
    slide(
      'Absorption and Elimination Labels',
      ['Write one cause-effect sentence for villi and absorption', 'Write one cause-effect sentence for large intestine, rectum, anus, and elimination', 'Use evidence from the fold-and-dot test'],
      'Teacher models one cause-effect sentence, then learners label the diagram. Ask: Which sentence explains structure and function?',
      'A high-resolution realistic classroom photo of an absorption-elimination diagram worksheet with blank label boxes, folded villi model, nutrient dots, and colored pencils, no readable writing, no labels, no text.',
      'absorption-elimination',
      'application',
      'photorealistic',
    ),
    slide(
      'Misconception Repair Slip',
      ['Correct: Food is absorbed in the stomach', 'Correct: Everything eaten becomes waste', 'Name the organ or structure that fixes each statement'],
      'Use this as the misconception check. Corrections must name small intestine/villi for absorption and large intestine, rectum, anus for elimination.',
      'A high-resolution realistic classroom photo of two misconception repair cards beside the two-path digestion map and a pencil, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
  4: [
    slide(
      'Learning Target: Complete Digestive Journey',
      ['Create a complete digestive journey model', 'Evaluate and revise weak parts', 'Use evidence-based captions for all five processes'],
      'Tell learners the final product must teach another learner accurately. It is not enough to label organs.',
      '',
    ),
    slide(
      'Digestive Quality Preview',
      ['Correct path arrows', 'Tract and helper distinction', 'Five process captions', 'Evidence link', 'Misconception warning'],
      'Learners mark green, yellow, or red for readiness. Ask: Which criterion prevents the most common wrong pathway?',
      '',
    ),
    slide(
      'What Makes a Model Scientific?',
      ['It traces the correct food path', 'It explains what each process does', 'It uses evidence from class models', 'It warns against a common misconception'],
      'Ask: What must a diagram show before it can explain digestion? Which process is hardest to explain with evidence?',
      'A high-resolution realistic classroom photo of a complete digestive journey storyboard template with path arrows, helper-organ note areas, process-caption boxes, evidence cards, and revision markers, no readable writing, no labels, no text.',
      'digestive-journey',
      'situation',
      'photorealistic',
    ),
    slide(
      'Evidence Card Retrieval',
      ['Choose the evidence card that supports each process', 'Write a one-line evidence note', 'Flag one possible misconception', 'Match each process to an organ or region'],
      'This is the main evidence retrieval activity. Ask: Which evidence card supports mechanical processing? Which supports absorption? Which prevents a wrong path?',
      'A high-resolution realistic classroom photo of evidence cards from the week: pathway map, crush-mix-secretions model, process sort, and villi fold-and-dot test arranged beside a planning table, no readable writing, no labels, no text.',
      'digestive-journey',
      'activity',
      'photorealistic',
    ),
    slide(
      'Caption Clinic',
      ['Name the process', 'Name where it happens', 'Connect to evidence or model', 'Prevent one misconception', 'Make the caption shorter and more precise'],
      'Improve weak captions together before final model building. Ask: What process is named? What evidence supports it? What misconception does it prevent?',
      'A high-resolution realistic classroom photo of weak and improved digestive-process caption cards beside a digestive journey model template and colored revision markers, no readable writing, no labels, no text.',
      'digestive-journey',
      'discussion',
      'photorealistic',
    ),
    slide(
      'Digestive Journey Model Build',
      ['Add arrows for food movement', 'Add helper-organ notes outside the food path', 'Write five process captions', 'Add one misconception warning', 'Use evidence from the week'],
      'This slide starts the final model build. Model one complete caption for mouth or small intestine, then release learners to build.',
      'A high-resolution realistic classroom photo of students building a complete digestive journey flow diagram on a desk with organ cards, helper-organ notes, process-caption cards, evidence cards, and colored arrows, no readable writing, no labels, no text.',
      'digestive-journey',
      'application',
      'photorealistic',
    ),
    slide(
      'Pathway and Helper Check',
      ['Food path is mouth to anus', 'Helper organs stay beside the path', 'No arrow routes food through liver, gallbladder, or pancreas'],
      'Before process captions, learners verify the pathway. Ask: Which arrow would make the model scientifically wrong?',
      'A high-resolution realistic classroom photo of a peer checking digestive path arrows and helper-organ notes on a final model worksheet, with a checklist and colored pencil, no readable writing, no labels, no text.',
      'digestive-journey',
      'practice',
      'photorealistic',
    ),
    slide(
      'Five Process Captions',
      ['Mechanical processing', 'Secretion', 'Chemical digestion', 'Absorption', 'Elimination'],
      'Ask learners to point to the evidence card for each process before writing the caption.',
      'A high-resolution realistic classroom photo of five digestive-process caption cards placed around a digestive journey model with evidence cards beside each caption, no readable writing, no labels, no text.',
      'digestive-journey',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Misconception Warning',
      ['Food does not pass through helper organs', 'Digestion is more than crushing', 'Absorption is not elimination', 'Everything eaten does not become waste'],
      'Learners choose one warning to add to the model. Ask: Which warning would help a Grade 8 learner avoid the biggest error?',
      'A high-resolution realistic classroom photo of misconception warning cards beside a digestive model, including wrong-route, crushing-only, absorption-vs-elimination, and everything-becomes-waste idea cards, no readable writing, no labels, no text.',
      'digestive-journey',
      'misconception',
      'photorealistic',
    ),
    slide(
      'Peer Audit',
      ['Check the path', 'Check tract versus helper organs', 'Check all five process captions', 'Check evidence links', 'Require one revision before final defense'],
      'Learners audit a partner model using the five-item checklist. Ask: What exact revision would make this model stronger?',
      'A high-resolution realistic classroom photo of two learners hands-only using a peer-audit checklist to review a digestive journey model with colored revision marks, no readable writing, no labels, no text.',
      'digestive-journey',
      'assessment',
      'photorealistic',
    ),
    slide(
      'Final Defense Sentence',
      ['My model shows digestion accurately because...', 'Name the path', 'Name one process caption', 'Name one evidence link', 'Name one revision you made'],
      'Use this as the final defense. The model must correctly trace food movement and explain all five processes without routing food through accessory organs.',
      'A high-resolution realistic classroom photo of a final digestive journey model beside a blank defense sentence card, pencil, evidence cards, and revision marker, no readable writing, no labels, no text.',
      'assessment',
      'assessment',
      'photorealistic',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    slide(
      'Learning Sequence: Food Pathway',
      ['Bite route prediction', 'Pathway card build', 'Expected output check', 'Tract-or-helper evidence board', 'Arrow-and-function diagram', 'Food path exit map'],
      'Use this as the pacing guide. The path must be correct before learners explain digestive processes.',
      '',
    ),
    slide(
      'Main Activity: Digestive Pathway Card Build',
      ['Work with your group', 'Place tract cards in order', 'Draw arrows only where food passes', 'Place helper organs beside the correct tract region', 'Ask for a teacher pathway check', 'Copy only the checked pathway into your map'],
      'Give complete instructions before groups begin. The output is a checked pathway card map that separates food movement from helper organs.',
      'A high-resolution realistic classroom photo showing the start of a digestive pathway card-build activity with organ cards, a path mat, helper-organ area, colored arrows, and a mostly blank annotated pathway map, no readable writing, no labels, no text.',
      'digestive-pathway',
      'activity',
      'photorealistic',
    ),
    slide(
      'Expected Output: Annotated Pathway Map',
      ['Food path: mouth -> esophagus -> stomach -> small intestine -> large intestine -> rectum -> anus', 'Accessory organs: salivary glands, liver, gallbladder, and pancreas', 'Arrows show food movement only; helper notes stay outside the route', 'Add one function label per major tract region', 'Correct the misconception that food passes through helper organs'],
      'Make the output criteria explicit before independent annotation. Point to the numbered route first, then the helper-organ markers outside the route. Connect each criterion to the objective.',
      'A high-resolution realistic classroom photo of an expected annotated digestive pathway map layout with numbered tract spaces, arrow path, helper-organ note boxes, and a misconception correction area, no readable writing, no labels, no text.',
      'digestive-pathway',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Roles, Timing, and Safety: Pathway Build',
      ['Card manager moves organ cards', 'Path checker watches arrow direction', 'Evidence speaker explains one placement', 'Recorder copies only after the check', 'No food handling is needed'],
      'Recommended pacing: 2 minutes prediction, 8 minutes card build, 4 minutes pathway check, 6 minutes evidence board, 8 minutes annotation, 4 minutes exit map.',
      'A high-resolution realistic classroom photo of digestive pathway role cards, timer, organ cards, path mat, colored pencils, and exit slips arranged on a science table, no readable writing, no labels, no text.',
      'digestive-pathway-roles',
      'activity',
      'photorealistic',
    ),
  ],
  2: [
    slide(
      'Learning Sequence: Digestive Processes',
      ['Smaller-is-not-finished probe', 'Crush-mix-secretions model', 'Expected output check', 'Process sorting wall', 'Mouth-and-stomach annotation', 'Three-process quick check'],
      'Use the probe to prevent the common shortcut that digestion only means smaller pieces.',
      '',
    ),
    slide(
      'Main Activity: Crush, Mix, and Secretions Model',
      ['Observe the crush model', 'Observe the mixing or secretion model', 'Use the enzyme-action diagram for unseen chemical change', 'Classify each as mechanical processing, secretion, or chemical digestion', 'Write one model limitation', 'Defend one classification with because'],
      'Give complete instructions before the model. Teacher manages any real food material; paper cracker is acceptable and safer.',
      'A high-resolution realistic classroom photo showing a crush-mix-secretions model activity with a clear bag, paper cracker pieces, water cup, enzyme-action diagram card, process cards, and a blank evidence table, no readable writing, no labels, no text.',
      'digestive-processes',
      'activity',
      'photorealistic',
    ),
    slide(
      'Expected Output: Three-Process Evidence Table',
      ['One row for mechanical processing', 'One row for secretion', 'One row for chemical digestion', 'Each row names what the model shows', 'Each row includes a limitation or evidence reason'],
      'Connect the output to the objective: learners must classify and explain, not just copy definitions.',
      'A high-resolution realistic classroom photo of a three-row digestive process evidence table beside model materials and process cards, no readable writing, no labels, no text.',
      'digestive-processes',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Roles, Timing, and Safety: Process Models',
      ['Materials manager handles model pieces only when told', 'Recorder completes the evidence table', 'Classifier chooses process labels', 'Skeptic names one model limitation', 'No tasting or shared food handling'],
      'Recommended pacing: 2 minutes probe, 8 minutes model evidence, 5 minutes classification, 6 minutes sorting wall, 8 minutes annotation, 4 minutes quick check.',
      'A high-resolution realistic classroom photo of process-model role cards, timer, clear bag, paper cracker pieces, water cup, process cards, and quick-check slips arranged on a desk, no readable writing, no labels, no text.',
      'digestive-processes-roles',
      'activity',
      'photorealistic',
    ),
  ],
  3: [
    slide(
      'Learning Sequence: Absorption and Elimination',
      ['Nutrient-or-waste fork', 'Villi fold-and-dot test', 'Expected output check', 'Two-path digestion map', 'Cause-effect labels', 'Misconception repair slip'],
      'Keep the two paths visible: nutrients enter the blood, undigested material continues toward elimination.',
      '',
    ),
    slide(
      'Main Activity: Villi Fold-and-Dot Test',
      ['Compare a flat paper surface with a folded or fringed surface', 'Place or count nutrient dots on each surface', 'Record which surface gives more contact points', 'Infer why villi help absorption', 'Explain what the model cannot show'],
      'Give complete instructions before pairs begin. The activity output is surface-area evidence that supports the absorption explanation.',
      'A high-resolution realistic classroom photo showing a villi fold-and-dot activity with flat paper, folded/fringed paper, nutrient-dot markers, a partially blank comparison table, and colored pencils, no readable writing, no labels, no text.',
      'absorption-elimination',
      'activity',
      'photorealistic',
    ),
    slide(
      'Expected Output: Absorption-Elimination Flow Chart',
      ['Surface-area comparison table', 'Nutrient path from small intestine and villi to blood and cells', 'Waste path from large intestine to rectum and anus', 'Two cause-effect sentences', 'Two misconception repairs'],
      'Make the output criteria explicit. Connect the product to the objective: learners explain absorption and trace elimination.',
      'A high-resolution realistic classroom photo of an absorption-elimination flow-chart template with two paths, folded villi model, nutrient-dot cards, and misconception repair slips, no readable writing, no labels, no text.',
      'absorption-elimination',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Roles, Timing, and Safety: Villi Model',
      ['Surface builder folds the villi model', 'Dot counter compares contact points', 'Flow mapper places nutrient and waste paths', 'Evidence speaker explains the cause-effect link', 'Use paper only; no biological samples are needed'],
      'Recommended pacing: 2 minutes prediction, 7 minutes fold-and-dot test, 5 minutes evidence talk, 8 minutes two-path map, 7 minutes labels, 4 minutes repair slip.',
      'A high-resolution realistic classroom photo of villi-model role cards, folded paper model, nutrient dots, flow-chart cards, timer, and misconception slips arranged on a science table, no readable writing, no labels, no text.',
      'absorption-elimination-roles',
      'activity',
      'photorealistic',
    ),
  ],
  4: [
    slide(
      'Learning Sequence: Digestive Journey Model',
      ['Quality preview', 'Evidence card retrieval', 'Expected output check', 'Caption clinic', 'Model build', 'Peer audit and final defense'],
      'The final session synthesizes the week. Learners should revise the model before defending it.',
      '',
    ),
    slide(
      'Main Activity: Evidence-Based Digestive Journey Model',
      ['Use the checked food pathway', 'Retrieve evidence for each process', 'Write five concise captions', 'Place helper notes outside the food path', 'Add one misconception warning', 'Revise after peer audit'],
      'Give complete instructions before learners build. The final product is a coherent model, not a decorative poster.',
      'A high-resolution realistic classroom photo showing the start of a final digestive journey model build with pathway cards, helper notes, process captions, evidence cards, peer-audit checklist, and colored arrows, no readable writing, no labels, no text.',
      'digestive-journey',
      'activity',
      'photorealistic',
    ),
    slide(
      'Expected Output: Digestive Journey Model',
      ['Correct mouth-to-anus path arrows', 'Tract/helper distinction is clear', 'Five process captions are evidence-based', 'One misconception warning is visible', 'One revision note explains what improved'],
      'Make the output criteria explicit before building. Connect the product to the objective: learners create, evaluate, and revise a complete digestive journey model.',
      'A high-resolution realistic classroom photo of a high-quality digestive journey model layout with path arrows, helper-organ notes, five caption boxes, evidence links, misconception warning, and revision note area, no readable writing, no labels, no text.',
      'digestive-journey',
      'success-criteria',
      'photorealistic',
    ),
    slide(
      'Roles, Timing, and Safety: Final Model',
      ['Pathway checker verifies food movement', 'Evidence manager matches process cards', 'Caption writer keeps explanations concise', 'Peer auditor requires one revision', 'No additional lab materials are needed'],
      'Recommended pacing: 3 minutes quality preview, 6 minutes evidence retrieval, 6 minutes caption clinic, 12 minutes model build, 7 minutes peer audit and revision, 4 minutes defense.',
      'A high-resolution realistic classroom photo of final-model role cards, timer, evidence cards, process caption cards, peer-audit checklist, and a blank digestive journey storyboard arranged on a table, no readable writing, no labels, no text.',
      'digestive-journey-roles',
      'activity',
      'photorealistic',
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
  const openingSlides = remainingSlides.slice(0, 2);
  const lessonSlides = remainingSlides.slice(2);

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
  ...digestiveBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const digestiveSignals = [
  'digestive tract',
  'digestive processes',
  'digestion',
  'mechanical processing',
  'secretion',
  'chemical digestion',
  'absorption',
  'elimination',
  'small intestine',
  'large intestine',
  'villi',
  'mouth to anus',
  'accessory organs',
  'food movement',
  'food path',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableDigestiveLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;

  const hasScienceContext = /\bscience\b/.test(normalized) || /\bgrade\s*8\b/.test(normalized);
  const score = digestiveSignals.reduce((count, signal) => (
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
  ...digestiveBlueprint,
  smartObjectives: [...digestiveBlueprint.smartObjectives],
  studentFacingObjectives: [...digestiveBlueprint.studentFacingObjectives],
  days: digestiveBlueprint.days.map((day) => ({ ...day })),
});

export const getDigestiveK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getDigestiveK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getDigestiveK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
