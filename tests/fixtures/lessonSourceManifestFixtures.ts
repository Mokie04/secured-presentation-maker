import type { StructuredSourceDocument } from '../../lib/lessonSourceDocument.ts';

const location = (tableId: string, rowIndex: number, columnIndex: number) => ({
  tableId,
  rowIndex,
  columnIndex,
});

const cell = (
  tableId: string,
  rowIndex: number,
  columnIndex: number,
  text: string,
  columnSpan = 1,
) => ({
  text,
  state: text.trim() ? 'present' as const : 'blank' as const,
  rowSpan: 1,
  columnSpan,
  sourceLocation: location(tableId, rowIndex, columnIndex),
});

export const FIVE_SESSION_MATRIX_DOCUMENT: StructuredSourceDocument = {
  format: 'docx',
  fileName: 'sanitized-five-session-matrix.docx',
  sourceHash: 'fixture-five-session-source-hash',
  byteLength: 12000,
  plainText: [
    'Grade 9 Science sanitized source',
    'Session 1 objective sentinel S1-OBJ-CIRCUIT-A',
    'Session 5 tail sentinel S5-EVALUATE-TAIL-OMEGA',
  ].join('\n'),
  blocks: [],
  tables: [
    {
      id: 'table-001',
      sourceOrder: 1,
      rows: [
        {
          index: 0,
          cells: [
            cell('table-001', 0, 0, 'Field'),
            cell('table-001', 0, 1, 'Learning Session 1'),
            cell('table-001', 0, 2, 'Learning Session 2'),
            cell('table-001', 0, 3, 'Learning Session 3'),
            cell('table-001', 0, 4, 'Learning Session 4'),
            cell('table-001', 0, 5, 'Learning Session 5'),
          ],
        },
        {
          index: 1,
          cells: [
            cell('table-001', 1, 0, 'Objective'),
            cell('table-001', 1, 1, 'S1-OBJ-CIRCUIT-A Compare current observations in one path.'),
            cell('table-001', 1, 2, 'S2-OBJ-CIRCUIT-B Explain voltage evidence across components.'),
            cell('table-001', 1, 3, 'S3-OBJ-CIRCUIT-C Model resistance changes with evidence.'),
            cell('table-001', 1, 4, 'S4-OBJ-CIRCUIT-D Predict behavior in a changed setup.'),
            cell('table-001', 1, 5, 'S5-OBJ-CIRCUIT-E Defend a conclusion using measurements.'),
          ],
        },
        {
          index: 2,
          cells: [
            cell('table-001', 2, 0, 'Shared materials'),
            cell('table-001', 2, 1, 'Shared safe battery pack and meter kit.', 5),
          ],
        },
        {
          index: 3,
          cells: [
            cell('table-001', 3, 0, 'Engage - 5 min'),
            cell('table-001', 3, 1, 'S1-ENGAGE-WARMUP Ask which bulb changes first.'),
            cell('table-001', 3, 2, 'S2-ENGAGE-WARMUP Compare two meter readings.'),
            cell('table-001', 3, 3, 'S3-ENGAGE-WARMUP Sort resistance claim cards.'),
            cell('table-001', 3, 4, 'S4-ENGAGE-WARMUP Predict the changed setup.'),
            cell('table-001', 3, 5, 'S5-ENGAGE-WARMUP Choose strongest evidence.'),
          ],
        },
        {
          index: 4,
          cells: [
            cell('table-001', 4, 0, 'Explore - 12 min'),
            cell('table-001', 4, 1, 'S1-EXPLORE-MEASURE Build one path and record two readings.'),
            cell('table-001', 4, 2, 'S2-EXPLORE-MEASURE Test component positions with a data table.'),
            cell('table-001', 4, 3, 'S3-EXPLORE-MEASURE Change one resistor and keep a claim log.'),
            cell('table-001', 4, 4, 'S4-EXPLORE-MEASURE Revise prediction after a new card.'),
            cell('table-001', 4, 5, 'S5-EXPLORE-MEASURE Audit a peer evidence trail.'),
          ],
        },
        {
          index: 5,
          cells: [
            cell('table-001', 5, 0, 'Explain - 10 min'),
            cell('table-001', 5, 1, 'S1-EXPLAIN-RELATE Connect the reading to one-path flow.'),
            cell('table-001', 5, 2, 'S2-EXPLAIN-RELATE Use the evidence sentence frame.'),
            cell('table-001', 5, 3, 'S3-EXPLAIN-RELATE Explain resistance as a changed condition.'),
            cell('table-001', 5, 4, 'S4-EXPLAIN-RELATE Explain the changed setup result.'),
            cell('table-001', 5, 5, 'S5-EXPLAIN-RELATE Present the defended conclusion.'),
          ],
        },
        {
          index: 6,
          cells: [
            cell('table-001', 6, 0, 'Elaborate - 10 min'),
            cell('table-001', 6, 1, 'S1-ELABORATE-TRANSFER Apply the rule to a new path.'),
            cell('table-001', 6, 2, 'S2-ELABORATE-TRANSFER Compare the alternate arrangement.'),
            cell('table-001', 6, 3, 'S3-ELABORATE-TRANSFER Design one fair-change test.'),
            cell('table-001', 6, 4, 'S4-ELABORATE-TRANSFER Explain a troubleshooting case.'),
            cell('table-001', 6, 5, 'S5-ELABORATE-TRANSFER Revise the evidence board.'),
          ],
        },
        {
          index: 7,
          cells: [
            cell('table-001', 7, 0, 'Evaluate - 8 min'),
            cell('table-001', 7, 1, 'S1-EVALUATE-EXIT Submit one claim and one reading.'),
            cell('table-001', 7, 2, 'S2-EVALUATE-EXIT Submit the comparison ticket.'),
            cell('table-001', 7, 3, 'S3-EVALUATE-EXIT Submit the resistance explanation.'),
            cell('table-001', 7, 4, 'S4-EVALUATE-EXIT Submit the prediction revision.'),
            cell('table-001', 7, 5, 'S5-EVALUATE-TAIL-OMEGA Submit the defended conclusion and tail sentinel.'),
          ],
        },
        {
          index: 8,
          cells: [
            cell('table-001', 8, 0, 'Reflection'),
            cell('table-001', 8, 1, ''),
            cell('table-001', 8, 2, ''),
            cell('table-001', 8, 3, ''),
            cell('table-001', 8, 4, ''),
            cell('table-001', 8, 5, ''),
          ],
        },
      ],
    },
  ],
};

export const MULTI_TABLE_SESSION_DOCUMENT: StructuredSourceDocument = {
  format: 'docx',
  fileName: 'sanitized-multi-table-session.docx',
  sourceHash: 'fixture-multi-table-session-source-hash',
  byteLength: 14000,
  plainText: [
    'Grade 9 Science: Sanitized systems title',
    'Learning Session 1 objective sentinel MT-S1-OBJ',
    'Learning Session 5 activity sentinel MT-S5-PRACTICE',
  ].join('\n'),
  blocks: [],
  tables: [
    {
      id: 'table-objectives',
      sourceOrder: 1,
      rows: [
        {
          index: 0,
          cells: [
            cell('table-objectives', 0, 0, 'Lesson Title'),
            cell('table-objectives', 0, 1, 'Grade 9 Science: Sanitized systems title', 5),
          ],
        },
        {
          index: 1,
          cells: [
            cell('table-objectives', 1, 0, 'No. of Sessions'),
            cell('table-objectives', 1, 1, 'Learning Session 1'),
            cell('table-objectives', 1, 2, 'Learning Session 2'),
            cell('table-objectives', 1, 3, 'Learning Session 3'),
            cell('table-objectives', 1, 4, 'Learning Session 4'),
            cell('table-objectives', 1, 5, 'Learning Session 5'),
          ],
        },
        {
          index: 2,
          cells: [
            cell('table-objectives', 2, 0, 'Learning Objectives'),
            cell('table-objectives', 2, 1, 'MT-S1-OBJ Compare one observable change.'),
            cell('table-objectives', 2, 2, 'MT-S2-OBJ Explain one evidence pattern.'),
            cell('table-objectives', 2, 3, 'MT-S3-OBJ Model one cause-and-effect link.'),
            cell('table-objectives', 2, 4, 'MT-S4-OBJ Predict one changed condition.'),
            cell('table-objectives', 2, 5, 'MT-S5-OBJ Defend one evidence-based claim.'),
          ],
        },
      ],
    },
    {
      id: 'table-experience',
      sourceOrder: 2,
      rows: [
        {
          index: 0,
          cells: [
            cell('table-experience', 0, 0, 'Learning Experience'),
            cell('table-experience', 0, 1, 'Learning Session 1'),
            cell('table-experience', 0, 2, 'Learning Session 2'),
            cell('table-experience', 0, 3, 'Learning Session 3'),
            cell('table-experience', 0, 4, 'Learning Session 4'),
            cell('table-experience', 0, 5, 'Learning Session 5'),
          ],
        },
        {
          index: 1,
          cells: [
            cell('table-experience', 1, 0, 'Observe'),
            cell('table-experience', 1, 1, 'MT-S1-OBSERVE Learners compare two safe samples.'),
            cell('table-experience', 1, 2, 'MT-S2-OBSERVE Learners inspect an evidence card.'),
            cell('table-experience', 1, 3, 'MT-S3-OBSERVE Learners trace one model arrow.'),
            cell('table-experience', 1, 4, 'MT-S4-OBSERVE Learners test one changed case.'),
            cell('table-experience', 1, 5, 'MT-S5-OBSERVE Learners rank three claims.'),
          ],
        },
        {
          index: 2,
          cells: [
            cell('table-experience', 2, 0, 'Practice'),
            cell('table-experience', 2, 1, 'MT-S1-PRACTICE Learners record one comparison.'),
            cell('table-experience', 2, 2, 'MT-S2-PRACTICE Learners write one evidence sentence.'),
            cell('table-experience', 2, 3, 'MT-S3-PRACTICE Learners revise one model note.'),
            cell('table-experience', 2, 4, 'MT-S4-PRACTICE Learners explain one prediction.'),
            cell('table-experience', 2, 5, 'MT-S5-PRACTICE Learners defend the selected claim.'),
          ],
        },
        {
          index: 3,
          cells: [
            cell('table-experience', 3, 0, 'Flow to help learners meet the learning objectives'),
            cell('table-experience', 3, 1, 'MT-S1-FLOW Learners connect the comparison to the claim.'),
            cell('table-experience', 3, 2, 'MT-S2-FLOW Learners connect evidence to the pattern.'),
            cell('table-experience', 3, 3, 'MT-S3-FLOW Learners connect model parts to the cause.'),
            cell('table-experience', 3, 4, 'MT-S4-FLOW Learners connect the changed case to a prediction.'),
            cell('table-experience', 3, 5, 'MT-S5-FLOW Learners connect ranked claims to the defense.'),
          ],
        },
        {
          index: 4,
          cells: [
            cell('table-experience', 4, 0, 'Learning Resources for reaching our objectives'),
            cell('table-experience', 4, 1, 'Reusable card set A.'),
            cell('table-experience', 4, 2, 'Reusable card set B.'),
            cell('table-experience', 4, 3, 'Reusable model cards.'),
            cell('table-experience', 4, 4, 'Reusable prediction cards.'),
            cell('table-experience', 4, 5, 'Reusable claim cards.'),
          ],
        },
      ],
    },
  ],
};

export const REPEATED_MISSING_OBJECTIVE_DOCUMENT: StructuredSourceDocument = {
  ...FIVE_SESSION_MATRIX_DOCUMENT,
  fileName: 'sanitized-repeated-missing-objectives.docx',
  sourceHash: 'fixture-repeated-missing-objectives-source-hash',
  plainText: 'Sanitized source with one objective and repeated missing objective units.',
  tables: [
    {
      id: 'table-missing-objectives',
      sourceOrder: 1,
      rows: [
        {
          index: 0,
          cells: [
            cell('table-missing-objectives', 0, 0, 'Field'),
            cell('table-missing-objectives', 0, 1, 'Learning Session 1'),
            cell('table-missing-objectives', 0, 2, 'Learning Session 2'),
            cell('table-missing-objectives', 0, 3, 'Learning Session 3'),
            cell('table-missing-objectives', 0, 4, 'Learning Session 4'),
          ],
        },
        {
          index: 1,
          cells: [
            cell('table-missing-objectives', 1, 0, 'Learning Objectives'),
            cell('table-missing-objectives', 1, 1, 'RM-S1-OBJ Identify one classroom-safe observation.'),
            cell('table-missing-objectives', 1, 2, ''),
            cell('table-missing-objectives', 1, 3, ''),
            cell('table-missing-objectives', 1, 4, ''),
          ],
        },
        {
          index: 2,
          cells: [
            cell('table-missing-objectives', 2, 0, 'Activity'),
            cell('table-missing-objectives', 2, 1, 'RM-S1-ACT Compare one card pair.'),
            cell('table-missing-objectives', 2, 2, 'RM-S2-ACT Sort two evidence cards.'),
            cell('table-missing-objectives', 2, 3, 'RM-S3-ACT Explain one model arrow.'),
            cell('table-missing-objectives', 2, 4, 'RM-S4-ACT Defend one revision.'),
          ],
        },
      ],
    },
  ],
};

export const FOUR_A_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-4a.txt',
  sourceHash: 'fixture-four-a-source-hash',
  byteLength: 4000,
  plainText: '',
  blocks: [
    { id: 'b001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'b001' } },
    { id: 'b002', kind: 'paragraph', text: 'Objective: D1-OBJ-A Identify the claim in a short scenario.', sourceOrder: 2, sourceLocation: { blockId: 'b002' } },
    { id: 'b003', kind: 'paragraph', text: 'Activity: D1-ACTIVITY-A Match claim cards to evidence cards.', sourceOrder: 3, sourceLocation: { blockId: 'b003' } },
    { id: 'b004', kind: 'paragraph', text: 'Analysis: D1-ANALYSIS-A Explain why one evidence card fits.', sourceOrder: 4, sourceLocation: { blockId: 'b004' } },
    { id: 'b005', kind: 'paragraph', text: 'Abstraction: D1-ABSTRACTION-A State the rule for evidence fit.', sourceOrder: 5, sourceLocation: { blockId: 'b005' } },
    { id: 'b006', kind: 'paragraph', text: 'Application: D1-APPLICATION-A Apply the rule to a new scenario.', sourceOrder: 6, sourceLocation: { blockId: 'b006' } },
    { id: 'b007', kind: 'heading', text: 'Day 2', sourceOrder: 7, sourceLocation: { blockId: 'b007' } },
    { id: 'b008', kind: 'paragraph', text: 'Objective: D2-OBJ-B Build a claim with matching evidence.', sourceOrder: 8, sourceLocation: { blockId: 'b008' } },
    { id: 'b009', kind: 'paragraph', text: 'Launch: D2-LAUNCH-B Compare two draft answers.', sourceOrder: 9, sourceLocation: { blockId: 'b009' } },
    { id: 'b010', kind: 'paragraph', text: 'Practice: D2-PRACTICE-B Revise the claim with a partner.', sourceOrder: 10, sourceLocation: { blockId: 'b010' } },
  ],
  tables: [],
};

export const MULTI_OBJECTIVE_UNIT_DOCUMENT: StructuredSourceDocument = {
  format: 'txt',
  fileName: 'sanitized-multi-objective.txt',
  sourceHash: 'fixture-multi-objective-source-hash',
  byteLength: 3600,
  plainText: '',
  blocks: [
    { id: 'm001', kind: 'heading', text: 'Day 1', sourceOrder: 1, sourceLocation: { blockId: 'm001' } },
    { id: 'm002', kind: 'paragraph', text: 'Objective: M1-OBJ-A Identify one reliable observation.', sourceOrder: 2, sourceLocation: { blockId: 'm002' } },
    { id: 'm003', kind: 'paragraph', text: 'Objective: M1-OBJ-B Use the observation to support a claim.', sourceOrder: 3, sourceLocation: { blockId: 'm003' } },
    { id: 'm004', kind: 'paragraph', text: 'Investigation: M1-INVESTIGATE-A Test two cards and record evidence.', sourceOrder: 4, sourceLocation: { blockId: 'm004' } },
    { id: 'm005', kind: 'heading', text: 'Day 2', sourceOrder: 5, sourceLocation: { blockId: 'm005' } },
    { id: 'm006', kind: 'paragraph', text: 'Objective: M2-OBJ-A Revise a claim after peer evidence.', sourceOrder: 6, sourceLocation: { blockId: 'm006' } },
    { id: 'm007', kind: 'paragraph', text: 'Synthesis: M2-SYNTHESIS-A Defend the revised claim.', sourceOrder: 7, sourceLocation: { blockId: 'm007' } },
  ],
  tables: [],
};

export const MISSING_AND_BLANK_DOCUMENT: StructuredSourceDocument = {
  ...FIVE_SESSION_MATRIX_DOCUMENT,
  sourceHash: 'fixture-missing-blank-source-hash',
  tables: [
    {
      ...FIVE_SESSION_MATRIX_DOCUMENT.tables[0],
      rows: FIVE_SESSION_MATRIX_DOCUMENT.tables[0].rows.map((row) => {
        if (row.index !== 8) return row;
        return {
          ...row,
          cells: [
            cell('table-001', 8, 0, 'Reflection'),
            cell('table-001', 8, 1, ''),
            cell('table-001', 8, 2, 'S2-REFLECTION-PRESENT Teacher records reteach note.'),
            cell('table-001', 8, 3, ''),
            cell('table-001', 8, 4, ''),
          ],
        };
      }),
    },
  ],
};

export const AMBIGUOUS_OBJECTIVE_DOCUMENT: StructuredSourceDocument = {
  ...FIVE_SESSION_MATRIX_DOCUMENT,
  sourceHash: 'fixture-ambiguous-objective-source-hash',
  tables: [
    {
      ...FIVE_SESSION_MATRIX_DOCUMENT.tables[0],
      rows: FIVE_SESSION_MATRIX_DOCUMENT.tables[0].rows.map((row) => {
        if (row.index !== 1) return row;
        return {
          ...row,
          cells: [
            cell('table-001', 1, 0, 'Objective'),
            cell('table-001', 1, 1, 'One broad objective spans several sessions without split.', 5),
          ],
        };
      }),
    },
  ],
};

export const UNSUPPORTED_SCANNED_DOCUMENT: StructuredSourceDocument = {
  format: 'pdf',
  fileName: 'sanitized-scanned.pdf',
  sourceHash: 'fixture-scanned-source-hash',
  byteLength: 8000,
  plainText: '',
  blocks: [],
  tables: [],
  isScanned: true,
};
