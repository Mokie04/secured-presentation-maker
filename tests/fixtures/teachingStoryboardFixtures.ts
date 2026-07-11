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
    { id: 'ts004', kind: 'paragraph', text: 'Output: Submit one claim and one reading as the exit ticket.', sourceOrder: 4, sourceLocation: { blockId: 'ts004' } },
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
