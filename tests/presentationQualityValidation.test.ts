import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validatePresentationQuality,
} from '../lib/presentationQualityValidation.ts';
import type { CompiledSlideScene, SceneTextElement } from '../lib/compiledSlideScene.ts';
import {
  buildCloseReadingQualityEndToEndFixture,
  buildLearnerReferenceQualityEndToEndFixture,
  buildVisualTeachingQualityEndToEndFixture,
} from './fixtures/endToEndValidationFixtures.ts';

type QualityFixtureInput = ReturnType<typeof buildVisualTeachingQualityEndToEndFixture>;

const passingQualityFixture = (): QualityFixtureInput => buildVisualTeachingQualityEndToEndFixture();

const cloneFixture = (fixture: QualityFixtureInput): QualityFixtureInput => (
  structuredClone(fixture)
);

const sceneTitle = (scene: CompiledSlideScene): SceneTextElement => {
  const element = scene.elements.find((candidate): candidate is SceneTextElement => (
    candidate.kind === 'text' && candidate.role === 'title'
  ));
  assert.ok(element);
  return element;
};

const sceneBody = (scene: CompiledSlideScene): SceneTextElement => {
  const element = scene.elements.find((candidate): candidate is SceneTextElement => (
    candidate.kind === 'text' && candidate.role !== 'title'
  ));
  assert.ok(element);
  return element;
};

const replaceText = (element: SceneTextElement, text: string): void => {
  element.runs = [{ text }];
};

const withVisibleTitle = (
  fixture: QualityFixtureInput,
  title: string,
): QualityFixtureInput => {
  const mutated = cloneFixture(fixture);
  replaceText(sceneTitle(mutated.presentation.scenes[0]), title);
  return mutated;
};

const withRepeatedGenericParagraphSlides = (
  fixture: QualityFixtureInput,
  title: string,
  paragraph: string,
): QualityFixtureInput => {
  const mutated = cloneFixture(fixture);
  replaceText(sceneTitle(mutated.presentation.scenes[0]), `${title} 1`);
  replaceText(sceneTitle(mutated.presentation.scenes[1]), `${title} (continued)`);
  replaceText(sceneBody(mutated.presentation.scenes[0]), paragraph);
  return mutated;
};

const withRawAssessmentText = (
  fixture: QualityFixtureInput,
  assessment: string,
): QualityFixtureInput => {
  const mutated = cloneFixture(fixture);
  replaceText(sceneBody(mutated.presentation.scenes[0]), assessment);
  return mutated;
};

const asPlainTitleBody = (scene: CompiledSlideScene): void => {
  const title = sceneTitle(scene);
  const body = sceneBody(scene);
  scene.elements = [title, body];
  scene.readingOrder = [title.id, body.id];
};

const plainTextDominatedQualityFixture = (): QualityFixtureInput => {
  const mutated = cloneFixture(passingQualityFixture());
  for (let index = 0; index < 4; index += 1) {
    asPlainTitleBody(mutated.presentation.scenes[index]);
  }
  return mutated;
};

test('blocks visible planning labels and reference dumps', () => {
  const result = validatePresentationQuality(withVisibleTitle(
    passingQualityFixture(),
    'References (books, websites, toolkits, etc.)',
  ));

  assert.equal(result.ok, false);
  assert.equal(result.report.referenceDumpCount, 1);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_planning_label_visible'), true);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_reference_dump'), true);
});

test('blocks every anchored planning label in English and conservative Filipino equivalents', () => {
  const labels = [
    'Teacher Preparation',
    'Administrative Notes',
    'Learner Context',
    'Observations of Learners',
    'Ways Forward',
    'Intentions',
    'Sources',
    'Paghahanda ng Guro',
    'Mga Tala ng Administrasyon',
    'Konteksto ng mga Mag-aaral',
    'Mga Obserbasyon sa mga Mag-aaral',
    'Mga Susunod na Hakbang',
    'Mga Sanggunian',
    'Mga Kagamitan',
  ];

  for (const label of labels) {
    const result = validatePresentationQuality(withVisibleTitle(passingQualityFixture(), label));
    assert.equal(result.ok, false, label);
    assert.equal(
      result.diagnostics.some((item) => item.code === 'quality_planning_label_visible'),
      true,
      label,
    );
  }
});

test('blocks paragraph dumps and repeated normalized generic titles', () => {
  const result = validatePresentationQuality(withRepeatedGenericParagraphSlides(
    passingQualityFixture(),
    'Learning Task',
    'Source-backed sentence '.repeat(35),
  ));

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_paragraph_dump'), true);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_generic_title_repeated'), true);
});

test('blocks concatenated multiple-choice text inside one editable visible element', () => {
  const result = validatePresentationQuality(withRawAssessmentText(
    passingQualityFixture(),
    '1. Choose A. Alpha B. Beta C. Gamma D. Delta',
  ));

  assert.equal(result.ok, false);
  assert.equal(result.report.unparsedAssessmentCount, 1);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_assessment_unparsed'), true);
});

test('treats lowercase ordered choice markers as an unparsed assessment', () => {
  const result = validatePresentationQuality(withRawAssessmentText(
    passingQualityFixture(),
    'Choose a. Alpha b. Beta c. Gamma',
  ));

  assert.equal(result.ok, false);
  assert.equal(result.report.unparsedAssessmentCount, 1);
});

test('does not combine ordered choice markers across separate visible elements', () => {
  const mutated = cloneFixture(passingQualityFixture());
  replaceText(sceneBody(mutated.presentation.scenes[0]), 'A. Alpha');
  replaceText(sceneBody(mutated.presentation.scenes[1]), 'B. Beta');
  replaceText(sceneBody(mutated.presentation.scenes[2]), 'C. Gamma');

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, true);
  assert.equal(result.report.unparsedAssessmentCount, 0);
});

test('blocks decks dominated by plain title-and-body scenes', () => {
  const stripped = plainTextDominatedQualityFixture();
  assert.equal(stripped.semanticSpecs.slice(0, 4).every((spec) => spec.visualGrammar !== 'minimal-statement'), true);
  const result = validatePresentationQuality(stripped);

  assert.equal(result.ok, false);
  assert.equal(result.report.meaningfulVisualGrammarRatio < 0.75, true);
  assert.equal(result.report.explanatoryStructureRatio < 0.40, true);
  assert.equal(result.report.plainTitleBodyRatio > 0.25, true);
});

test('does not restore visual credit from rich grammar metadata after native structure is removed', () => {
  const stripped = plainTextDominatedQualityFixture();
  for (const spec of stripped.semanticSpecs.slice(0, 4)) {
    spec.visualGrammar = 'relationship-diagram';
    spec.layoutId = 'relationship-diagram';
  }

  const result = validatePresentationQuality(stripped);

  assert.equal(result.ok, false);
  assert.equal(result.report.meaningfulVisualGrammarRatio < 0.75, true);
  assert.equal(result.report.plainTitleBodyRatio > 0.25, true);
});

test('blocks a source-required relationship rendered as prose only', () => {
  const mutated = cloneFixture(passingQualityFixture());
  const relationshipScene = mutated.visualTeachingPlan.scenes.find((scene) => (
    scene.visualGrammar === 'relationship-diagram'
  ));
  assert.ok(relationshipScene);
  relationshipScene.visualGrammar = 'minimal-statement';
  const spec = mutated.semanticSpecs.find((candidate) => (
    candidate.visualTeachingSceneId === relationshipScene.id
  ));
  assert.ok(spec);
  spec.visualGrammar = 'minimal-statement';
  spec.layoutId = 'generic-bullets';
  const compiledScene = mutated.presentation.scenes.find((candidate) => (
    candidate.semanticSlideSpecId === spec.id
  ));
  assert.ok(compiledScene);
  asPlainTitleBody(compiledScene);

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, false);
  assert.equal(result.report.proseOnlyRelationshipCount, 1);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_relationship_prose_only'), true);
});

test('allows a long source-authorized close-reading passage', () => {
  const mutated = buildCloseReadingQualityEndToEndFixture();
  const closeReadingScene = mutated.presentation.scenes.find((scene) => {
    const spec = mutated.semanticSpecs.find((candidate) => candidate.id === scene.semanticSlideSpecId);
    return spec?.visualTeachingSceneId === mutated.visualTeachingPlan.scenes
      .find((candidate) => candidate.learnerTitle === 'Close Reading Passage')?.id;
  });
  assert.ok(closeReadingScene);
  replaceText(
    sceneBody(closeReadingScene),
    `Passage: ${'Source-backed passage sentence for careful evidence reading. '.repeat(12)}`,
  );

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, true);
  assert.equal(result.report.paragraphDumpCount, 0);
});

test('allows source-authorized references that learners must use', () => {
  const mutated = buildLearnerReferenceQualityEndToEndFixture();

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, true);
  assert.equal(result.report.referenceDumpCount, 0);
  assert.equal(result.report.planningLabelViolationCount, 0);
});

test('does not trust mutated plan accounting to authorize visible references', () => {
  const mutated = cloneFixture(passingQualityFixture());
  const spec = mutated.semanticSpecs[0];
  const planScene = mutated.visualTeachingPlan.scenes.find((scene) => scene.id === spec.visualTeachingSceneId);
  assert.ok(planScene);
  const sourceId = planScene.sourceObjectiveIds[0];
  const accounting = mutated.visualTeachingPlan.sourceAccounting.find((entry) => entry.sourceId === sourceId);
  assert.ok(accounting);
  accounting.sourceLabel = 'References';
  replaceText(sceneTitle(mutated.presentation.scenes[0]), 'References');
  replaceText(
    sceneBody(mutated.presentation.scenes[0]),
    'Use these source-provided references to compare the two claims and cite the stronger evidence.',
  );

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_visual_plan_invalid'), true);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_reference_dump'), true);
});

test('blocks a visual plan with manipulated source accounting', () => {
  const mutated = cloneFixture(passingQualityFixture());
  const accounting = mutated.visualTeachingPlan.sourceAccounting.find((entry) => (
    entry.disposition === 'learner-visible' && entry.sceneIds.length > 0
  ));
  assert.ok(accounting);
  accounting.sceneIds = [];

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.some((item) => item.code === 'quality_visual_plan_invalid'), true);
});

test('allows one deliberate prompt and reveal pair after title normalization', () => {
  const mutated = cloneFixture(passingQualityFixture());
  const promptSpec = mutated.semanticSpecs[0];
  const revealSpec = mutated.semanticSpecs[1];
  promptSpec.intent = 'question';
  revealSpec.intent = 'answer-reveal';
  revealSpec.storyboardScreenId = promptSpec.storyboardScreenId;
  revealSpec.storyboardScreenIds = [...promptSpec.storyboardScreenIds];
  replaceText(sceneTitle(mutated.presentation.scenes[0]), 'Question');
  replaceText(sceneTitle(mutated.presentation.scenes[1]), 'Question — Reveal');

  const result = validatePresentationQuality(mutated);

  assert.equal(result.ok, true);
  assert.equal(result.report.repeatedGenericTitleCount, 0);
});

test('passes a source-aligned editable visual teaching deck', () => {
  const result = validatePresentationQuality(passingQualityFixture());

  assert.equal(result.ok, true);
  assert.equal(result.report.meaningfulVisualGrammarRatio >= 0.75, true);
  assert.equal(result.report.explanatoryStructureRatio >= 0.40, true);
  assert.equal(result.report.plainTitleBodyRatio <= 0.25, true);
  assert.deepEqual(result.diagnostics, []);
});
