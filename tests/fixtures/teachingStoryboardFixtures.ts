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
