import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';
import {
  validateK12ScienceSessionPresentation,
  type SessionPresentationQualityResult,
} from './presentationStandards';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const ENGLISH_LITERATURE_VALUES_TOPIC = 'Philippine Literary Texts as Windows to Values and Contexts';
const ENGLISH_LITERATURE_VALUES_COMPETENCY = 'Analyze literary texts as expressions of individual or communal values within structural, biographical, historical, and sociocultural contexts (e.g., conflict types, character and characterization, plot, rhyme and meter, diction, tone and mood, style, patterns and motifs, figures of speech and sound devices, point of view and narrative techniques, and organic unity). Analyze the maxims, universal truths, and philosophies presented in literary texts as a means of valuing other people and their various circumstances in life. Identify one\'s meaning and purpose in selecting the type of literary text for composition. Compose literary texts using appropriate structure. Revise literary texts for coherence and cohesion. Publish an original literary text that reflects culture (poem/prose).';

const ENGLISH_LITERATURE_VALUES_OBJECTIVES = [
  'By the end of Session 1, learners identify a value shown in a Philippine literary excerpt, cite a relevant text detail, and explain how the detail expresses an individual or communal value.',
  'By the end of Session 2, learners identify character evidence from words, actions, thoughts, and others responses, then analyze how characterization reveals a value or conflict.',
  'By the end of Session 3, learners identify the central conflict and analyze how conflict, character choice, and context reveal an individual or communal value.',
  'By the end of Session 4, learners identify the parts of a literary response and compose a short response that explains how character, conflict, and context work together to reveal a value for a specific reader or community.',
];

const englishLiteratureValuesBlueprint: LessonBlueprint = {
  mainTitle: ENGLISH_LITERATURE_VALUES_TOPIC,
  planUnitLabel: 'Session',
  subject: 'English',
  gradeLevel: 'Grade 7',
  quarter: 'First Term',
  learningCompetency: ENGLISH_LITERATURE_VALUES_COMPETENCY,
  smartObjectives: [...ENGLISH_LITERATURE_VALUES_OBJECTIVES],
  studentFacingObjectives: [...ENGLISH_LITERATURE_VALUES_OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Text Details and Values',
      focus: 'Learners move from retelling events to using text details and context to explain individual or communal values.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Characterization Evidence and Values',
      focus: 'Learners read character evidence from words, actions, thoughts, and others responses, then connect traits to values.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Conflict, Choice, Context, and Value',
      focus: 'Learners identify conflict type and explain how pressure on a character reveals a value within context.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Focused Literary Response',
      focus: 'Learners plan, draft, review, revise, and reflect on a short literary response using character, conflict, and context evidence.',
      generationStatus: 'pending',
    },
  ],
};

const englishMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'English',
  topic: ENGLISH_LITERATURE_VALUES_TOPIC,
  gradeLevel: 'Grade 7',
  gradeBand: '7-10',
  learningCompetency: ENGLISH_LITERATURE_VALUES_COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  slideTemplate: string,
  visualRole: string,
  semanticAnchor: string,
  style: ImageSemanticMetadata['style'] = 'diagram',
): ImageSemanticMetadata => ({
  ...englishMetadata,
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
    englishLiteratureValuesBlueprint.mainTitle,
    ['Subject: English', 'Grade Level: Grade 7', 'Term: First Term', 'Week focus: values, context, character, conflict, and response'],
    'Introduce the week as a reading-to-response arc: read details, connect values, analyze character evidence, track conflict pressure, then write a focused literary response.',
    'HD classroom literary analysis overview with excerpt card, evidence table, characterization chart, conflict map, and response frame.',
    'english-literature-values',
    'overview',
  ),
  evidenceSlide(
    'Learning Roadmap',
    ['Mark important text details.', 'Explain how details show values.', 'Analyze character and conflict evidence.', 'Write a focused literary response.'],
    `Use this roadmap only as student-facing framing. Exact lesson-plan objectives: ${englishLiteratureValuesBlueprint.studentFacingObjectives.join(' | ')}`,
    'HD classroom reading roadmap showing excerpt mark-up, claim-evidence table, characterization chart, conflict map, and response draft.',
    'english-literature-values-roadmap',
    'overview',
  ),
  evidenceSlide(
    'How We Will Work Like Literary Readers',
    ['Read before judging.', 'Use evidence before opinion.', 'Explain beyond retelling.', 'Revise for clearer meaning.'],
    'Set the norm for close reading. Emphasize that value claims must come from text details and context, not only personal opinion.',
    'HD literary reader workspace with marked excerpt, evidence notes, value lens cards, and response revision marks.',
    'english-literature-values-norms',
    'overview',
  ),
];

const sessionStructure: Record<number, { objective: string; studentGoals: string[]; question: string; evidence: string; output: string }> = {
  1: {
    objective: ENGLISH_LITERATURE_VALUES_OBJECTIVES[0],
    studentGoals: ['Identify a value in a Philippine literary excerpt', 'Cite a relevant text detail', 'Explain how the detail expresses an individual or communal value'],
    question: 'What value does the text show?',
    evidence: 'Value-action note, marked excerpt, claim-evidence table, context note, and four-sentence response',
    output: 'Value-action note, marked excerpt, claim-evidence table, revised value explanation, and four-sentence value response',
  },
  2: {
    objective: ENGLISH_LITERATURE_VALUES_OBJECTIVES[1],
    studentGoals: ['Identify character evidence from words, actions, thoughts, and responses', 'Choose precise trait words', 'Explain how characterization reveals value or conflict'],
    question: 'What does this line reveal about the character?',
    evidence: 'Character clue note, four-way characterization chart, context-pressure sentence, revised character claim, and trait revision slip',
    output: 'Character clue note, four-way characterization chart, context-pressure sentence, revised character claim, and trait revision slip',
  },
  3: {
    objective: ENGLISH_LITERATURE_VALUES_OBJECTIVES[2],
    studentGoals: ['Identify the central conflict', 'Analyze character choice under pressure', 'Explain how context reveals value'],
    question: 'What force opposes the character?',
    evidence: 'Conflict sort card, plot-pressure map, value-under-pressure evidence card, synthesis sentence, and exit slip',
    output: 'Conflict sort card, plot-pressure map, value-under-pressure evidence card, revised synthesis sentence, and conflict-to-value exit slip',
  },
  4: {
    objective: ENGLISH_LITERATURE_VALUES_OBJECTIVES[3],
    studentGoals: ['Identify parts of a literary response', 'Compose a short response with evidence and explanation', 'Revise for coherence, context, and audience meaning'],
    question: 'What makes a literary response clear?',
    evidence: 'Marked success criteria, response planning board, draft response, peer-marked draft, revision note, and reflection',
    output: 'Marked success criteria, response planning board, focused literary response draft, peer-marked draft, revised response, and reflection note',
  },
};

const sessionOpenerSlide = (dayNumber: number): Slide => {
  const structure = sessionStructure[dayNumber];
  const openerByDay: Record<number, Slide> = {
    1: evidenceSlide(
      'What Value Does the Text Show?',
      ['Choose one value word.', 'Name one action that shows it.', 'Connect the action to a reader or community.', 'Output: value-action note.'],
      `Use this opener before reading the excerpt. Exact lesson-plan objective: ${structure.objective}. Ask: What action shows the value, and who benefits from that action?`,
      'HD value lens warm-up with value word cards, action note, and community meaning prompt.',
      'value-lens-warm-up',
      'situation',
    ),
    2: evidenceSlide(
      'What Does This Line Reveal About the Character?',
      ['Reread one line from the excerpt.', 'Name what the character says or does.', 'Infer a precise trait.', 'Output: character clue note.'],
      `Use this opener before the characterization chart. Exact lesson-plan objective: ${structure.objective}. Ask which exact word or action proves the trait.`,
      'HD character clue recall card with excerpt line, inference frame, and precise trait reminder.',
      'character-clue-recall',
      'situation',
    ),
    3: evidenceSlide(
      'What Force Opposes the Character?',
      ['Sort one familiar scenario.', 'Name the opposing force.', 'Classify the conflict type.', 'Output: conflict sort card.'],
      `Use this opener before the plot-pressure map. Exact lesson-plan objective: ${structure.objective}. Ask learners to name the opposition, not only the event.`,
      'HD conflict opener card showing one familiar scenario sorted by opposing force with character versus self, character, society, and nature choices.',
      'conflict-type-quick-sort',
      'situation',
    ),
    4: evidenceSlide(
      'What Makes a Literary Response Clear?',
      ['Read the success criteria.', 'Name the four required response parts.', 'Ask one clarifying question.', 'Output: marked success criteria.'],
      `Use this opener before writing. Exact lesson-plan objective: ${structure.objective}. Ask what the response must prove and what evidence is required.`,
      'HD response target check with claim, evidence, explanation, and context connection criteria.',
      'response-target-check',
      'situation',
    ),
  };

  return openerByDay[dayNumber];
};

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Evidence Goal: Detail, Value, Context',
      ['A value claim needs text evidence.', 'A detail can be quoted or paraphrased.', 'Context helps explain meaning.', 'A response must explain beyond retelling.'],
      'Bridge from retelling to interpretation. Ask learners to distinguish what happened from what the action reveals.',
      'HD literary analysis overview showing excerpt detail, value claim, context note, and explanation arrow.',
      'detail-value-context-goal',
      'overview',
    ),
    evidenceSlide(
      'Value Lens Warm-Up',
      ['1. Choose courage, respect, fairness, or responsibility.', '2. Write one action that shows the value.', '3. Share the action with a partner.', '4. Explain who benefits from the action.'],
      'This is the readiness task. Check that examples are observable actions, not only value labels.',
      'HD value lens warm-up with value word cards and observable action lines.',
      'value-lens-warm-up',
      'situation',
    ),
    evidenceSlide(
      'First Reading Trail',
      ['1. Mark one confusing word.', '2. Underline one important action.', '3. Star one line that may reveal a value.', '4. Ask what needs clarification.'],
      'This is the first close-reading pass. Each mark has a purpose: word, action, and possible value evidence.',
      'HD first reading trail with excerpt card and marking code for confusing word, important action, and value evidence.',
      'first-reading-trail',
      'model',
    ),
    evidenceSlide(
      'Claim and Evidence Pair Check',
      ['1. Identify a value the text can support.', '2. Copy or paraphrase one text detail.', '3. Explain how the detail shows the value.', '4. Check that you are not only retelling.'],
      'This is the main paired task. Output is a claim-evidence table where explanation connects the detail to the value.',
      'HD claim-evidence table for value claim, text detail, and how the detail shows the value.',
      'claim-evidence-pair-check',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Claim-Evidence Table',
      ['Value claim is defensible.', 'Text detail is relevant.', 'Explanation connects detail to value.', 'Context note helps meaning.', 'Retelling is reduced.'],
      'Make criteria explicit before group context work. Learners should revise explanations that repeat the text detail without interpretation.',
      'HD claim-evidence output checklist for defensible value, relevant detail, explanation, context, and reduced retelling.',
      'claim-evidence-table-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Context Makes Meaning',
      ['Connect the character, setting, or situation to the value claim.', 'Add one family, community, history, or culture note.', 'Revise your explanation for clarity.', 'Explain why this matters to a reader.'],
      'This is the context discussion task. Keep context notes tied to meaning, not random background facts.',
      'HD context makes meaning visual with excerpt evidence and context note categories.',
      'context-makes-meaning',
      'discussion',
    ),
    evidenceSlide(
      'Four-Sentence Value Response',
      ['Write the value claim.', 'Add the strongest text evidence.', 'Explain the context connection.', 'Explain why the value matters to people.'],
      'Use this independent response task. Learners should produce four connected sentences, not a list.',
      'HD four-sentence value response organizer with claim, evidence, context, and reader meaning rows.',
      'four-sentence-value-response',
      'practice',
    ),
    evidenceSlide(
      'Retelling Is Not Explaining',
      ['Retelling says what happened.', 'Explanation says what the detail shows.', 'Context says why it matters.', 'Revise one sentence that only retells.'],
      'Use this misconception repair before the exit response. Ask what the learner explained beyond retelling.',
      'HD literary response repair visual contrasting retelling sentence with explanation sentence and context note.',
      'retelling-is-not-explaining',
      'misconception',
    ),
    evidenceSlide(
      'Value Response Exit',
      ['Submit the four-sentence response.', 'Underline the value claim.', 'Box the text evidence.', 'Star the explanation beyond retelling.'],
      'Use this independent check. Look for a defensible claim, relevant evidence, and explanation that connects text to value and context.',
      'HD value response exit card with claim underline, evidence box, explanation star, and context note.',
      'value-response-exit',
      'assessment',
    ),
  ],
  2: [
    evidenceSlide(
      'Evidence Goal: Character Evidence',
      ['Characterization comes from clues.', 'Speech, action, thought, and responses can be evidence.', 'Precise traits are stronger than vague labels.', 'A trait must connect to value or conflict.'],
      'Bridge from value evidence to character evidence. Ask learners why good, bad, and nice are not precise enough for analysis.',
      'HD characterization evidence overview with says, does, thinks, others say, trait word, and value connection.',
      'character-evidence-goal',
      'overview',
    ),
    evidenceSlide(
      'Character Clue Recall',
      ['1. Choose one line from the excerpt.', '2. Name what the character says or does.', '3. Infer a trait or tendency.', '4. Point to the exact proof.'],
      'This is the retrieval task. Check that learners point to a specific line instead of general memory.',
      'HD character clue recall visual with excerpt line, inference frame, and specific line required label.',
      'character-clue-recall',
      'situation',
    ),
    evidenceSlide(
      'Four-Way Evidence Hunt',
      ['1. Reread selected passages.', '2. Sort evidence under says, does, thinks, and others say.', '3. Choose the strongest clue in each category.', '4. Explain why one clue is strongest.'],
      'This is the evidence organizer. At least three categories should contain text-based evidence.',
      'HD four-way characterization chart with says, does, thinks, and others say columns.',
      'four-way-evidence-hunt',
      'activity',
    ),
    evidenceSlide(
      'Setting Pressure Talk',
      ['Identify one setting detail or community expectation.', 'Explain how it pressures the character.', 'Connect the pressure to a choice.', 'Write one context-pressure sentence.'],
      'This is the context bridge. Learners should explain how context affects character, not only where the story happens.',
      'HD setting pressure talk visual linking setting detail, pressure, and value.',
      'setting-pressure-talk',
      'discussion',
    ),
    evidenceSlide(
      'Character Claim Builder',
      ['1. Draft the frame: The character is ___ because ___.', '2. Add one precise trait word.', '3. Add one evidence detail.', '4. Explain how the trait connects to value or conflict.'],
      'This is the main claim-building task. Output is a revised character claim with precise trait, evidence, and explanation.',
      'HD character claim builder with trait frame, learner draft, revision questions, and evidence detail.',
      'character-claim-builder',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Character Claim',
      ['Trait word is precise.', 'Evidence is text-based.', 'Explanation connects evidence to trait.', 'Trait connects to value or conflict.', 'Vague labels are replaced.'],
      'Make output criteria explicit before the exit revision. Learners should replace vague trait labels with evidence-based words.',
      'HD character claim output checklist with precise trait, evidence, explanation, value connection, and vague-label repair.',
      'character-claim-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Trait Precision Exit',
      ['Replace good, bad, or nice.', 'Choose a precise trait.', 'Cite the text clue.', 'Explain why the new word is more accurate.'],
      'Use this independent check. Look for a precise trait that better matches evidence.',
      'HD trait precision exit visual replacing vague labels with precise traits and explanation prompt.',
      'trait-precision-exit',
      'assessment',
    ),
    evidenceSlide(
      'Character Evidence Conference',
      ['Which clue is strongest?', 'What does it show about the character?', 'How does the setting pressure the choice?', 'What value or conflict becomes clearer?'],
      'Use this debrief to connect characterization, context, and value. Ask learners what evidence changed their first label.',
      'HD character evidence conference visual with strongest clue, trait, setting pressure, and value connection.',
      'character-evidence-conference',
      'generalization',
    ),
    evidenceSlide(
      'Good or Bad Is Not Analysis',
      ['Vague labels hide evidence.', 'Precise traits name a pattern.', 'Evidence must prove the trait.', 'Revise one label into an analysis sentence.'],
      'Use this misconception repair. Ask learners why the revised trait is more accurate than the original label.',
      'HD trait precision repair visual contrasting vague labels and precise evidence-based traits.',
      'good-or-bad-is-not-analysis',
      'misconception',
    ),
  ],
  3: [
    evidenceSlide(
      'Evidence Goal: Conflict, Choice, Value',
      ['Conflict is an opposing force.', 'A conflict can be internal or external.', 'Pressure reveals character choice.', 'Choice can reveal an individual or communal value.'],
      'Bridge from character analysis to conflict analysis. Ask learners to name the force opposing the character.',
      'HD conflict-choice-value overview with opposing force, character choice, context, and value link.',
      'conflict-choice-value-goal',
      'overview',
    ),
    evidenceSlide(
      'Conflict Type Quick Sort',
      ['1. Classify each scenario card.', '2. Name the opposing force.', '3. Explain one choice to a partner.', '4. Correct one item after feedback.'],
      'This is the connect-and-diagnose task. Check that explanations name the opposing force, not only an event.',
      'HD conflict type quick sort with character versus self, character, society, and nature cards.',
      'conflict-type-quick-sort',
      'situation',
    ),
    evidenceSlide(
      'Plot Pressure Map',
      ['1. Identify the beginning situation.', '2. Map the rising problem.', '3. Mark the key choice.', '4. Record the result.', '5. Show where conflict becomes clear.'],
      'This is the plot map task. Learners should show cause and effect, not a loose list of events.',
      'HD plot pressure map with beginning, pressure grows, key choice, result, and value shown points.',
      'plot-pressure-map',
      'model',
    ),
    evidenceSlide(
      'Value Under Pressure',
      ['1. Identify the value being tested.', '2. Cite one character action.', '3. Cite one line of narration or dialogue.', '4. Explain how both details support the value.'],
      'This is the main group task. Output is a value-under-pressure evidence card that connects conflict, action, line, and value.',
      'HD value-under-pressure evidence card with conflict, character action, narration or dialogue line, and value tested.',
      'value-under-pressure',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Evidence Card',
      ['Conflict type is accurate.', 'Opposing force is named.', 'Action evidence is relevant.', 'Line evidence strengthens the claim.', 'Both details support the same value.'],
      'Make output criteria explicit before synthesis sentences. Learners should not attach two unrelated details to one value claim.',
      'HD value-under-pressure output checklist with conflict type, opposing force, action evidence, line evidence, and same-value check.',
      'evidence-card-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Synthesis Sentence Workshop',
      ['Name the conflict.', 'Name the character choice.', 'Name the value revealed.', 'Add the context that deepens meaning.', 'Revise for clarity.'],
      'This is the synthesis task. Learners connect conflict, choice, value, and context in one coherent sentence.',
      'HD synthesis sentence workshop with conflict, choice, value, context, and reader meaning tags.',
      'synthesis-sentence-workshop',
      'practice',
    ),
    evidenceSlide(
      'Conflict-to-Value Exit Slip',
      ['Name the conflict type.', 'Name the value revealed.', 'Add one evidence detail for conflict.', 'Add one evidence detail for value.'],
      'Use this independent check. Each column needs evidence, not labels alone.',
      'HD conflict-to-value exit slip with conflict type, value revealed, and evidence detail columns.',
      'conflict-to-value-exit-slip',
      'assessment',
    ),
    evidenceSlide(
      'Event Is Not Always Conflict',
      ['An event is something that happens.', 'A conflict has opposition.', 'The opposing force tests a value.', 'Revise one event into a conflict statement.'],
      'Use this misconception repair. Ask learners to identify the pressure, not just the exciting moment.',
      'HD conflict repair visual distinguishing event, opposing force, conflict, and value tested.',
      'event-is-not-always-conflict',
      'misconception',
    ),
    evidenceSlide(
      'Conflict Discussion',
      ['What is your strongest evidence for the conflict?', 'What is your strongest evidence for the value?', 'What context detail changes the meaning?', 'What still feels uncertain?'],
      'Use this debrief to surface uncertainty. Learners should identify evidence and one remaining question before writing.',
      'HD conflict discussion visual with conflict evidence, value evidence, context detail, and uncertainty note.',
      'conflict-discussion',
      'discussion',
    ),
  ],
  4: [
    evidenceSlide(
      'Evidence Goal: Focused Literary Response',
      ['A response needs a defensible claim.', 'Evidence must support the same value.', 'Explanation connects text to meaning.', 'Revision improves clarity and cohesion.'],
      'Bridge from reading evidence to writing. Ask learners which part of the response usually needs the most support.',
      'HD focused literary response overview with claim, evidence, explanation, context, revision, and reader meaning.',
      'focused-literary-response-goal',
      'overview',
    ),
    evidenceSlide(
      'Response Target Check',
      ['1. Read the success criteria.', '2. Name claim, evidence, explanation, and context.', '3. Ask one clarifying question.', '4. Mark the hardest part.'],
      'This is the readiness check. Confirm learners can name the four required response parts before drafting.',
      'HD response target check with claim, evidence, explanation, context connection, and success criteria table.',
      'response-target-check',
      'situation',
    ),
    evidenceSlide(
      'Evidence Selection Board',
      ['1. Choose one value claim.', '2. Select one character detail.', '3. Select one conflict or context detail.', '4. Decide which evidence comes first.'],
      'This is the planning task. Both evidence details must support the same value claim.',
      'HD evidence selection board with value claim, character detail, conflict or context detail, and order column.',
      'evidence-selection-board',
      'activity',
    ),
    evidenceSlide(
      'Focused Literary Response Draft',
      ['1. Write the value claim.', '2. Add character evidence.', '3. Add conflict or context evidence.', '4. Explain what the evidence proves.', '5. Write for a specific reader or community.'],
      'This is the main writing task. Output is a short response that explains evidence instead of only listing it.',
      'HD focused literary response draft frame with claim, evidence, explanation, context, and audience meaning.',
      'focused-literary-response-draft',
      'activity',
    ),
    evidenceSlide(
      'Output Check: Literary Response',
      ['Claim is easy to find.', 'At least two details support the same value.', 'Evidence is explained, not listed.', 'Context connection is clear.', 'Audience meaning is included.'],
      'Make output criteria explicit before peer review. Learners should check whether the evidence supports one value claim.',
      'HD literary response output checklist with claim, two details, explanation, context connection, and audience meaning.',
      'literary-response-output',
      'success-criteria',
    ),
    evidenceSlide(
      'Partner Clarity Review',
      ['Underline the claim.', 'Box the evidence.', 'Star the explanation.', 'Suggest one sentence to clarify.', 'Check if context connects to the value.'],
      'This is the peer review task. The suggestion should target claim, evidence, explanation, or context.',
      'HD partner clarity review with peer-marked draft and review marks for claim, evidence, explanation, and revision.',
      'partner-clarity-review',
      'discussion',
    ),
    evidenceSlide(
      'Revision and Reflection Close',
      ['Revise one sentence.', 'Label the part you improved.', 'Name the reading lens that helped most.', 'Explain why the revision is clearer.'],
      'This is the revision task. The revision must change wording or explanation, not only handwriting.',
      'HD revision and reflection close with revision note and reading lens choices: character, conflict, context.',
      'revision-reflection-close',
      'practice',
    ),
    evidenceSlide(
      'Listing Evidence Is Not Enough',
      ['Evidence needs explanation.', 'Explanation names what the evidence proves.', 'Context shows why meaning deepens.', 'Revise one listed detail into an explanation.'],
      'Use this misconception repair before final submission. Ask learners what the evidence proves about value.',
      'HD literary response repair visual showing listed evidence changed into explained evidence with context.',
      'listing-evidence-is-not-enough',
      'misconception',
    ),
    evidenceSlide(
      'Response Reflection Exit',
      ['Submit the revised response.', 'Circle the clearest claim.', 'Mark the strongest evidence.', 'Answer which lens helped most and why.'],
      'Use this independent check. Sort responses by claim clarity, evidence relevance, or explanation depth for next-week planning.',
      'HD response reflection exit card with revised response, claim circle, strongest evidence mark, and lens reflection.',
      'response-reflection-exit',
      'assessment',
    ),
  ],
};

const sessionDetailSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      "Today's Value Evidence Path",
      ['Choose a value-action note.', 'Mark the first reading trail.', 'Complete the claim-evidence table.', 'Explain context meaning.', 'Write a four-sentence response.'],
      'Use this as the pacing guide. Keep learners moving from action, to text evidence, to value explanation.',
      'HD activity path for value lens warm-up, first reading trail, claim-evidence table, context meaning, and four-sentence response.',
      'today-s-value-evidence-path',
      'activity',
    ),
  ],
  2: [
    evidenceSlide(
      "Today's Character Evidence Path",
      ['Recall one character clue.', 'Sort four-way evidence.', 'Explain setting pressure.', 'Build a character claim.', 'Revise a vague trait.'],
      'Use this as the pacing guide. Character analysis should cite specific clues before naming traits.',
      'HD activity path for character clue recall, four-way evidence hunt, setting pressure talk, character claim builder, and trait precision exit.',
      'today-s-character-evidence-path',
      'activity',
    ),
  ],
  3: [
    evidenceSlide(
      "Today's Conflict Evidence Path",
      ['Classify conflict types.', 'Map plot pressure.', 'Explain value under pressure.', 'Revise a synthesis sentence.', 'Complete the exit slip.'],
      'Use this as the pacing guide. Conflict analysis should name the opposing force and the value being tested.',
      'HD activity path for conflict type sort, plot pressure map, value under pressure, synthesis sentence, and conflict-to-value exit.',
      'today-s-conflict-evidence-path',
      'activity',
    ),
  ],
  4: [
    evidenceSlide(
      "Today's Response Writing Path",
      ['Read the response target.', 'Plan evidence selection.', 'Write the focused draft.', 'Review clarity with a partner.', 'Revise and reflect.'],
      'Use this as the pacing guide. The response should be short, coherent, evidence-based, and revised for clarity.',
      'HD activity path for response target check, evidence selection board, focused response draft, partner clarity review, and revision reflection.',
      'today-s-response-writing-path',
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
  ...englishLiteratureValuesBlueprint.days.flatMap((day) => getSessionSlides(day.dayNumber)),
];

const englishLiteratureValuesSignals = [
  'philippine literary texts',
  'individual or communal values',
  'structural',
  'biographical',
  'historical',
  'sociocultural contexts',
  'characterization',
  'conflict types',
  'plot',
  'diction',
  'tone and mood',
  'point of view',
  'narrative techniques',
  'literary response',
  'claim-evidence',
  'context',
  'values',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableEnglishLiteratureValuesLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;
  const hasEnglishContext = /\benglish\b/.test(normalized);
  const hasGradeOrTopic = /\bgrade\s*7\b/.test(normalized)
    || normalized.includes('philippine literary texts')
    || normalized.includes('individual or communal values');
  const score = englishLiteratureValuesSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);
  return hasEnglishContext && hasGradeOrTopic && score >= 5;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...englishLiteratureValuesBlueprint,
  smartObjectives: [...englishLiteratureValuesBlueprint.smartObjectives],
  studentFacingObjectives: [...englishLiteratureValuesBlueprint.studentFacingObjectives],
  days: englishLiteratureValuesBlueprint.days.map((day) => ({ ...day })),
});

const mainActivityByDayNumber: Record<number, string> = {
  1: 'Claim and Evidence Pair Check',
  2: 'Character Claim Builder',
  3: 'Value Under Pressure',
  4: 'Focused Literary Response Draft',
};

export const validateEnglishLiteratureValuesK12PlanUnitSlidesSeed = (
  dayNumber: number,
  slides: Slide[] = getSessionSlides(dayNumber),
): SessionPresentationQualityResult => {
  const structure = sessionStructure[dayNumber];
  return validateK12ScienceSessionPresentation(slides, {
    subject: englishLiteratureValuesBlueprint.subject,
    gradeLevel: englishLiteratureValuesBlueprint.gradeLevel,
    sessionNumber: dayNumber,
    objective: structure?.objective,
    expectedOutput: structure?.output,
    mainActivityTitle: mainActivityByDayNumber[dayNumber],
    minSlides: 8,
    maxSlides: 14,
    minPromptsPerSlide: 4,
    maxPromptsPerSlide: 6,
    maxPromptLength: 112,
    requireEvidenceImages: true,
    requirePhotorealisticScienceVisuals: false,
  });
};

export const getEnglishLiteratureValuesK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getEnglishLiteratureValuesK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = getSessionSlides(dayNumber);
  if (slides.length === 0) return null;
  const qualityResult = validateEnglishLiteratureValuesK12PlanUnitSlidesSeed(dayNumber, slides);
  if (!qualityResult.ok) {
    console.warn('English literature values reusable session deck failed quality validation.', {
      dayNumber,
      score: qualityResult.score,
      issues: qualityResult.issues,
    });
  }
  return cloneSlides(slides);
};

export const getEnglishLiteratureValuesK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(getCompletePresentationSlides()),
    },
  };
};
