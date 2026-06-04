import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const TOPIC = 'Scientists, Inventions, and Evidence from Secondary Sources';
const COMPETENCY = 'Use information from secondary sources to identify a famous Filipino and/or foreign scientist and their invention/s. Use information from the home or the local community to identify a science invention and explain its impact on their everyday life.';

const OBJECTIVES = [
  'By the end of Session 1, learners identify a scientist and invention from a teacher-vetted secondary source, record two source details, and distinguish source evidence from opinion or unsupported praise.',
  'By the end of Session 2, learners write a source-supported profile detail, select the most useful source evidence about an invention, and explain how the evidence shows daily-life impact.',
  'By the end of Session 3, learners compare two source-supported invention claims, classify claims as strong or weak, and revise one weak claim using clearer source evidence.',
  'By the end of Session 4, learners complete a source-supported scientist-invention profile card, justify the impact statement with source evidence, and evaluate the card using criteria for accuracy, evidence, and source note.',
];

const blueprint: LessonBlueprint = {
  mainTitle: 'Scientists, Inventions, and Evidence from Secondary Sources',
  planUnitLabel: 'Session',
  subject: 'Science',
  gradeLevel: 'Grade 4',
  quarter: 'First Term',
  learningCompetency: COMPETENCY,
  smartObjectives: [...OBJECTIVES],
  studentFacingObjectives: [...OBJECTIVES],
  days: [
    {
      dayNumber: 1,
      title: 'Source Evidence or Opinion',
      focus: 'Learners identify a scientist and invention from vetted source cards and separate source evidence from unsupported praise.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Source-Supported Profile Details',
      focus: 'Learners choose useful source evidence and connect invention details to daily-life impact.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Reliable Invention Claims',
      focus: 'Learners compare strong and weak claims, then repair weak claims with clearer source evidence.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Final Scientist-Invention Profile Card',
      focus: 'Learners complete and evaluate a source-supported profile card using criteria for accuracy, evidence, and source note.',
      generationStatus: 'pending',
    },
  ],
};

const baseMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'Science',
  topic: TOPIC,
  gradeLevel: 'Grade 4',
  gradeBand: '4-6',
  learningCompetency: COMPETENCY,
  language: 'EN' as const,
};

const metadataFor = (
  anchor: string,
  visualRole = 'activity',
  slideTemplate = anchor,
): ImageSemanticMetadata => ({
  ...baseMetadata,
  visualRole,
  slideTemplate,
  semanticAnchor: anchor,
  style: 'photorealistic',
});

const slide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imageAnchor = '',
  visualRole = 'activity',
): Slide => ({
  title,
  content,
  speakerNotes,
  imagePrompt: imageAnchor ? `Approved HD classroom visual for ${title}` : '',
  imageStyle: imageAnchor ? 'photorealistic' : 'none',
  ...(imageAnchor ? { imageSemanticMetadata: metadataFor(imageAnchor, visualRole) } : {}),
});

const initialSlides: Slide[] = [
  slide(
    blueprint.mainTitle,
    ['Subject: Science', 'Grade Level: Grade 4', 'Term: First Term'],
    'Introduce the week as source-based science communication: read vetted secondary sources, choose evidence, explain impact, and credit the source.',
    'cover_session_1',
    'overview',
  ),
  slide(
    'Learning Map',
    ['Source evidence or opinion', 'Useful evidence and impact', 'Reliable and repaired claims', 'Final profile card'],
    `Use this as a student-facing roadmap. Exact objectives: ${OBJECTIVES.join(' | ')}`,
    'today_s_evidence_goal',
    'overview',
  ),
];

const sessionSlides: Record<number, Slide[]> = {
  1: [
    slide('Can We Trust This Detail?', ['Sort each statement.', 'Underline a source clue.', 'Explain one choice.'], 'Connect and diagnose: Source or Opinion Sort. Listen for learners who accept praise without evidence. Ask: What detail came from the source? Which statement is only praise?', 'can_we_trust_this_detail'),
    slide('Today’s Evidence Goal', ['Identify a scientist and invention.', 'Record two source details.', 'Separate evidence from praise.'], `Official objective: ${OBJECTIVES[0]}`, 'today_s_evidence_goal', 'overview'),
    slide('Main Activity: Source or Opinion Sort', ['Read the short statement.', 'Choose evidence, opinion, or unsure.', 'Underline the clue that helped you.', 'Be ready to explain.'], 'Complete instructions from the lesson plan: learners sort short statements as source evidence, opinion, or unsure; underline one source clue; explain one choice. Output: source-or-opinion sort strip.', 'main_activity__source_or_opinion_sort'),
    slide('Read Like a Scientist', ['Read two source cards.', 'Name the card title first.', 'Record scientist and invention.', 'Copy one short detail in your words.'], 'Investigate with evidence: Scientist-Invention Source Walk. Output: source detail notes. Support: who-invention-evidence organizer.', 'read_like_a_scientist'),
    slide('Build the Evidence Board', ['Place details under the right column.', 'Scientist, invention, problem, or impact.', 'Every detail needs a source note.'], 'Make meaning together: Source Evidence Board. Learners place one detail, explain placement, and revise opinion into source-based wording.', 'build_the_evidence_board'),
    slide('Start the Profile Card', ['Choose one source card.', 'Write scientist and invention.', 'Add one source detail.', 'Name the source card.'], 'Guided modeling: Profile Card Start. Check for scientist, invention, source detail, and source note.', 'start_the_profile_card'),
    slide('Check Before You Submit', ['Scientist and invention match.', 'Source detail is short.', 'Source title is named.', 'No praise without evidence.'], 'Use this as the success-criteria checkpoint before independent work.', 'check_before_you_submit'),
    slide('Source Evidence Exit', ['Read the new source line.', 'Identify scientist or invention.', 'Mark evidence or opinion.', 'Explain what is missing.'], 'Independent check: Source Evidence Exit. Output: individual source evidence exit slip.', 'source_evidence_exit'),
    slide('Support and Challenge', ['Support: use the organizer.', 'Frame: According to ___, ___.', 'Challenge: compare two source cards.'], 'Extended learning: use the who-invention-evidence organizer; extension compares two source cards for clearer impact evidence.', 'support_and_challenge'),
    slide('What Evidence Changed Your Answer?', ['Name one source detail.', 'Tell where you placed it.', 'Explain why it belongs there.'], 'Debrief: Ask learners what evidence changed their first answer and identify support needed for Session 2.', 'what_evidence_changed_your_answer'),
  ],
  2: [
    slide('Which Detail Helps the Profile?', ['Compare two details.', 'Choose the clearer detail.', 'Explain what question it answers.'], 'Connect and diagnose: Reliable Detail Warm-Up. Check that learners choose details answering who, what, problem, or impact.', 'which_detail_helps_the_profile'),
    slide('Today’s Evidence Goal', ['Write one supported profile detail.', 'Choose useful invention evidence.', 'Explain daily-life impact.'], `Official objective: ${OBJECTIVES[1]}`, 'today_s_evidence_goal', 'overview'),
    slide('Main Activity: Two-Source Profile Lab', ['Read two short source cards.', 'Select one useful detail from each.', 'Record how each detail helps.', 'Do not copy long passages.'], 'Complete instructions from the lesson plan. Output: two-source profile notes. Checking point: cite source card title and paraphrase.', 'main_activity__two_source_profile_lab'),
    slide('What Each Source Adds', ['Source 1 may tell who or what.', 'Source 2 may explain impact.', 'Use the detail that answers the task.'], 'Model comparing source contributions before group work. Ask: What does source one tell us? What does source two add?', 'what_each_source_adds'),
    slide('Source Detail Talk', ['Share one selected detail.', 'Name what it supports.', 'Compare it with another group.'], 'Make meaning together: Source Detail Talk. Accept details only after the source title is named.', 'source_detail_talk'),
    slide('Profile Evidence Table', ['Complete each column.', 'Underline the evidence.', 'Write one because sentence.'], 'Guided modeling: Profile Evidence Table. Frame: The invention helped by ___ because the source says ___.', 'profile_evidence_table'),
    slide('Because Sentences Work Like Evidence Chains', ['Claim: what changed.', 'Evidence: what the source says.', 'Because: how the evidence proves impact.'], 'Discussion support slide. Keep examples tied to the profile table and source details.', 'because_sentences_work_like_evidence_chains'),
    slide('Best Source Exit', ['Read two evidence choices.', 'Select the stronger source detail.', 'Explain why it supports impact.'], 'Independent check: Best Source Exit. Look for source-based reason and no long copied text.', 'best_source_exit'),
    slide('Success Criteria', ['Evidence is relevant.', 'Impact is explained.', 'Source card is cited.', 'Long passages are paraphrased.'], 'Assessment criteria: learner selects relevant source evidence, connects it to invention impact, and cites or names the source card.', 'success_criteria'),
    slide('What Evidence Improved Your Claim?', ['Name the useful detail.', 'Tell the impact it supports.', 'Say what you changed.'], 'Debrief: connect source evidence to stronger impact claims. Prepare reliability cases for Session 3 from common errors.', 'what_evidence_improved_your_claim'),
  ],
  3: [
    slide('Strong, Weak, or Unsupported?', ['Read the invention claim.', 'Find the source evidence.', 'Sort the claim.', 'Explain one choice.'], 'Connect and diagnose: Strong Weak Source Sort. Clarify that strong means supported by source evidence, not just interesting.', 'strong__weak__or_unsupported'),
    slide('Today’s Evidence Goal', ['Compare invention claims.', 'Classify strong and weak claims.', 'Repair one weak claim.'], `Official objective: ${OBJECTIVES[2]}`, 'today_s_evidence_goal', 'overview'),
    slide('Main Activity: Scientist-Invention Case Team', ['Analyze two profile cases.', 'Compare source evidence.', 'Choose the more reliable case.', 'Cite the detail before choosing.'], 'Complete instructions from the lesson plan. Output: source case comparison sheet. Support: scientist, invention, problem, source, impact checklist.', 'main_activity__scientist_invention_case_team'),
    slide('Compare Before You Decide', ['Check scientist and invention.', 'Check the source detail.', 'Check the impact claim.'], 'Discussion support for case comparison. Keep learners from choosing based on neatness or interest alone.', 'compare_before_you_decide'),
    slide('Reliability Conference', ['Find one weak claim.', 'Suggest stronger evidence.', 'Explain the improvement.'], 'Make meaning together: Evidence Reliability Conference. Revision must use source details, not added guesses.', 'reliability_conference'),
    slide('Source Claim Repair', ['Rewrite the weak claim.', 'Add the source detail.', 'Include the source title note.'], 'Guided modeling: Source Claim Repair. Frame: According to ___, ___ because ___.', 'source_claim_repair'),
    slide('Your Repair Slip', ['Find the weak part.', 'Add a better source detail.', 'Mark the source title.'], 'Independent preparation before exit slip. Teacher checks scientist, invention, evidence, source note.', 'your_repair_slip'),
    slide('Source Repair Exit', ['Repair one claim alone.', 'Add source evidence.', 'Name the source card.'], 'Independent check. Sort slips by name-match support, evidence support, and source-note support.', 'source_repair_exit'),
    slide('Success Criteria', ['Claim matches the source.', 'Evidence is specific.', 'Revision removes guesses.', 'Source title is included.'], 'Assessment criteria: learner compares evidence, identifies weak claims, and revises claims with accurate source support.', 'success_criteria'),
    slide('How Did the Repair Improve Trust?', ['Tell what was weak.', 'Tell what evidence fixed it.', 'Tell why readers can trust it.'], 'Debrief. Prepare final profile cards using common repair errors.', 'how_did_the_repair_improve_trust'),
  ],
  4: [
    slide('What Makes a Profile Complete?', ['Compare two profile cards.', 'Find the missing part.', 'Mark the stronger profile.'], 'Connect and diagnose: Profile Criteria Scan. Ask learners to name missing scientist, invention, source detail, impact, or source note.', 'what_makes_a_profile_complete'),
    slide('Today’s Evidence Goal', ['Complete the profile card.', 'Justify impact with source evidence.', 'Evaluate using the criteria.'], `Official objective: ${OBJECTIVES[3]}`, 'today_s_evidence_goal', 'overview'),
    slide('Main Activity: Final Source Profile Check', ['Recheck the source card.', 'Confirm scientist and invention.', 'Record one impact detail.', 'Paraphrase the wording.'], 'Complete instructions from the lesson plan. Output: final source profile notes. Conference first with learners who mixed up names or copied too much text.', 'main_activity__final_source_profile_check'),
    slide('From Source Detail to Impact', ['Source detail first.', 'Impact claim second.', 'Because sentence connects them.'], 'Discussion support. The visual and statement align: evidence table directly supports impact writing.', 'from_source_detail_to_impact'),
    slide('Profile Gallery Review', ['Read two classmates’ cards.', 'Identify source evidence.', 'Leave one improvement question.'], 'Make meaning together: Profile Gallery Review. Accept feedback only if it names scientist, invention, source detail, impact, or source note.', 'profile_gallery_review'),
    slide('Complete the Final Profile Card', ['Fill all profile boxes.', 'Write one because sentence.', 'Check against criteria.'], 'Guided modeling and final work. Learners may rehearse orally before writing. Output: final source-supported scientist-invention profile card.', 'complete_the_final_profile_card'),
    slide('Self-Check the Final Card', ['Scientist and invention are accurate.', 'Evidence supports impact.', 'Source card title is noted.', 'No long passage is copied.'], 'Success criteria from the lesson plan. Use before peer or teacher collection.', 'self_check_the_final_card'),
    slide('Peer Feedback Question', ['Ask about evidence.', 'Ask about impact.', 'Ask about the source note.'], 'Peer feedback slip. Keep feedback specific and respectful.', 'peer_feedback_question'),
    slide('Reliable Source Transfer', ['Read a new science statement.', 'Decide if it is usable.', 'Write what evidence is still needed.'], 'Independent check: Reliable Source Transfer. Confirm learners name evidence needed, not only yes/no.', 'reliable_source_transfer'),
    slide('Final Evidence Reflection', ['What source detail helped most?', 'What did you revise?', 'What makes your profile reliable?'], 'Debrief and transition to Week 2 local invention impact mapping. Use final cards to identify learners needing support.', 'final_evidence_reflection'),
  ],
};

const signals = [
  'scientists, inventions, and evidence from secondary sources',
  'scientist and invention',
  'source evidence',
  'source-or-opinion',
  'source or opinion',
  'teacher-vetted source cards',
  'profile card',
  'source-supported scientist-invention profile card',
  'famous filipino and/or foreign scientist',
  'secondary sources',
];

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

export const isReusableScientistsInventionsLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;

  const hasGradeScienceContext = /\bgrade\s*4\b/.test(normalized) && /\bscience\b/.test(normalized);
  const score = signals.reduce((count, signal) => (normalized.includes(signal) ? count + 1 : count), 0);

  return hasGradeScienceContext && score >= 3;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageOverlays: source.imageOverlays?.map((overlay) => ({ ...overlay })),
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...blueprint,
  smartObjectives: [...blueprint.smartObjectives],
  studentFacingObjectives: [...blueprint.studentFacingObjectives],
  days: blueprint.days.map((day) => ({ ...day })),
});

export const getScientistsInventionsK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const clonedBlueprint = cloneBlueprint();
  return {
    blueprint: clonedBlueprint,
    initialPresentation: {
      title: clonedBlueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getScientistsInventionsK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = sessionSlides[dayNumber];
  return slides?.length ? cloneSlides(slides) : null;
};

export const getScientistsInventionsK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const clonedBlueprint = cloneBlueprint();
  return {
    blueprint: clonedBlueprint,
    initialPresentation: {
      title: clonedBlueprint.mainTitle,
      slides: cloneSlides([
        ...initialSlides,
        ...clonedBlueprint.days.flatMap((day) => sessionSlides[day.dayNumber] || []),
      ]),
    },
  };
};
