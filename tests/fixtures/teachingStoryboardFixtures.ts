import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';

export const TEACHER_SCRIPT_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-teacher-script.txt',
  sourceHash: 'fixture-teacher-script-source-hash',
  byteLength: 2600,
  plainText: '',
  blocks: [
    { id: 'ts001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'ts001' } },
    { id: 'ts002', kind: 'paragraph', text: 'Objective: TS-OBJ-A Choose a first test based on evidence.', sourceOrder: 2, sourceLocation: { blockId: 'ts002' } },
    { id: 'ts003', kind: 'paragraph', text: 'Launch: The teacher will ask learners to choose the first meter reading and explain why.', sourceOrder: 3, sourceLocation: { blockId: 'ts003' } },
    { id: 'ts004', kind: 'paragraph', text: 'Guided practice: The teacher will guide the learners to compare two sanitized evidence cards.', sourceOrder: 4, sourceLocation: { blockId: 'ts004' } },
    { id: 'ts005', kind: 'paragraph', text: 'Teacher modeling: Teacher will model how students explain one evidence choice.', sourceOrder: 5, sourceLocation: { blockId: 'ts005' } },
    { id: 'ts006', kind: 'paragraph', text: 'Check: The teacher checks learners draft claims for evidence.', sourceOrder: 6, sourceLocation: { blockId: 'ts006' } },
    { id: 'ts007', kind: 'paragraph', text: 'Clarify: The teacher clarifies the comparison pattern with one sanitized example.', sourceOrder: 7, sourceLocation: { blockId: 'ts007' } },
    { id: 'ts008', kind: 'paragraph', text: 'Present: The teacher presents a sanitized model for the class to inspect.', sourceOrder: 8, sourceLocation: { blockId: 'ts008' } },
    { id: 'ts009', kind: 'paragraph', text: 'Review: The teacher reviews the exit response checklist.', sourceOrder: 9, sourceLocation: { blockId: 'ts009' } },
    { id: 'ts010', kind: 'paragraph', text: 'Restate: The teacher restates the comparison goal with sanitized circuit cards.', sourceOrder: 10, sourceLocation: { blockId: 'ts010' } },
    { id: 'ts011', kind: 'paragraph', text: 'Connect: Use the comparison chart first. The teacher reviews the key pattern with sanitized labels.', sourceOrder: 11, sourceLocation: { blockId: 'ts011' } },
    { id: 'ts012', kind: 'paragraph', text: 'Output: Submit one claim and one reading as the exit ticket.', sourceOrder: 12, sourceLocation: { blockId: 'ts012' } },
  ],
  tables: [],
};

export const EVIDENCE_OUTPUT_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-evidence-output.txt',
  sourceHash: 'fixture-evidence-output-source-hash',
  byteLength: 3200,
  plainText: '',
  blocks: [
    { id: 'eo001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'eo001' } },
    { id: 'eo002', kind: 'paragraph', text: 'Objective: EO-OBJ-A Use observations to support a claim.', sourceOrder: 2, sourceLocation: { blockId: 'eo002' } },
    { id: 'eo003', kind: 'paragraph', text: 'Investigation: EO-EVIDENCE-A Record two observations and one measurement in the data table.', sourceOrder: 3, sourceLocation: { blockId: 'eo003' } },
    { id: 'eo004', kind: 'paragraph', text: 'Closure: EO-OUTPUT-A Submit a conclusion that uses the recorded evidence.', sourceOrder: 4, sourceLocation: { blockId: 'eo004' } },
  ],
  tables: [],
};

export const DENSE_STORYBOARD_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-dense-storyboard.txt',
  sourceHash: 'fixture-dense-storyboard-source-hash',
  byteLength: 6400,
  plainText: '',
  blocks: [
    { id: 'ds001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'ds001' } },
    {
      id: 'ds002',
      kind: 'paragraph',
      text: 'Objective: DS-OBJ-A Compare several source-backed observations, explain the selected pattern, and justify a conclusion using the stated criteria in source order.',
      sourceOrder: 2,
      sourceLocation: { blockId: 'ds002' },
    },
    {
      id: 'ds003',
      kind: 'paragraph',
      text: 'Collaborative Evidence Synthesis and Response Preparation Sequence: Review the first source-backed observation and identify its relevant feature. Compare it with the second observation and record one similarity and one difference. Discuss which stated criterion applies to each observation. Organize the comparison in source order. Prepare a concise explanation that cites both observations. Check that every claim is supported by the provided information. Revise the explanation so another learner can follow the reasoning without additional context.',
      sourceOrder: 3,
      sourceLocation: { blockId: 'ds003' },
    },
    {
      id: 'ds004',
      kind: 'paragraph',
      text: 'Discussion Question for Comparing Multiple Source-Backed Explanations: Which explanation best matches the first observation, which explanation best matches the second observation, and what source-backed reason supports each choice? Discuss the alternatives in order, identify one limitation in each alternative, and prepare a response that uses the provided criteria without adding a new requirement.',
      sourceOrder: 4,
      sourceLocation: { blockId: 'ds004' },
    },
    {
      id: 'ds005',
      kind: 'paragraph',
      text: 'Evidence Capture and Review for the Shared Classroom Record: Record the first observation, the second observation, the comparison result, and the supporting reason in the provided evidence record. Verify that each entry can be traced to the source-backed task. Preserve the order of the entries and include the required evidence for the final explanation.',
      sourceOrder: 5,
      sourceLocation: { blockId: 'ds005' },
    },
    {
      id: 'ds006',
      kind: 'paragraph',
      text: 'Exit Response for the Complete Source-Backed Reasoning Sequence: Submit a final response that states the selected pattern, cites both observations, explains why the stated criterion applies, identifies one limitation, and presents the required output in the same sequence as the source-backed activity.',
      sourceOrder: 6,
      sourceLocation: { blockId: 'ds006' },
    },
  ],
  tables: [],
};

export const SOURCE_BACKED_BLANK_TASK_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-source-backed-blank-task.txt',
  sourceHash: 'fixture-source-backed-blank-task-hash',
  byteLength: 1200,
  plainText: '',
  blocks: [
    { id: 'sb001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'sb001' } },
    {
      id: 'sb002',
      kind: 'paragraph',
      text: 'Objective: SB-OBJ-A Select source-provided terms that complete a response frame.',
      sourceOrder: 2,
      sourceLocation: { blockId: 'sb002' },
    },
    {
      id: 'sb003',
      kind: 'paragraph',
      text: 'Practice: Complete the blank spaces in the provided response frame using only the source-provided terms.',
      sourceOrder: 3,
      sourceLocation: { blockId: 'sb003' },
    },
  ],
  tables: [],
};
