import type { SourceDocumentFormat, SourceFieldState, SourceLocation } from './lessonSourceManifest.ts';

export type SourceDocumentBlock = {
  id: string;
  kind: 'heading' | 'paragraph' | 'list-item' | 'page-marker';
  text: string;
  sourceOrder: number;
  sourceLocation: SourceLocation;
};

export type SourceTableCell = {
  text: string;
  state: Exclude<SourceFieldState, 'ambiguous'>;
  rowSpan: number;
  columnSpan: number;
  sourceLocation: SourceLocation;
};

export type SourceTableRow = {
  index: number;
  cells: SourceTableCell[];
};

export type SourceDocumentTable = {
  id: string;
  sourceOrder: number;
  rows: SourceTableRow[];
};

export type StructuredSourceDocument = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  plainText: string;
  blocks: SourceDocumentBlock[];
  tables: SourceDocumentTable[];
  isScanned?: boolean;
};

export type BuildPlainTextSourceDocumentInput = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  text: string;
};

export type BuildTableSourceDocumentInput = {
  format: SourceDocumentFormat;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  rows: Array<Array<string | undefined>>;
};

export type BuildHtmlSourceDocumentInput = {
  format: Extract<SourceDocumentFormat, 'docx'>;
  fileName: string;
  sourceHash: string;
  byteLength: number;
  html: string;
  fallbackText?: string;
};

const normalizeSourceText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const isUnitHeadingText = (text: string): boolean => (
  /^(?:learning\s+session|session|day|araw|custom\s+unit|lesson)\s+\d+\b/i.test(text)
);

const cellState = (text: string): Exclude<SourceFieldState, 'ambiguous'> => (
  text.trim() ? 'present' : 'blank'
);

export const buildPlainTextSourceDocument = (
  input: BuildPlainTextSourceDocumentInput,
): StructuredSourceDocument => {
  const lines = input.text.split(/\r?\n/);
  const blocks = lines
    .map((line, index): SourceDocumentBlock | null => {
      const text = line.trim();
      if (!text) return null;
      const id = `block-${String(index + 1).padStart(3, '0')}`;
      const withoutMarkdownHeading = text.replace(/^#{1,6}\s+/, '');
      const isHeading = /^#{1,6}\s+/.test(text) || isUnitHeadingText(withoutMarkdownHeading);
      return {
        id,
        kind: isHeading ? 'heading' : 'paragraph',
        text: withoutMarkdownHeading,
        sourceOrder: index + 1,
        sourceLocation: { blockId: id },
      };
    })
    .filter((block): block is SourceDocumentBlock => Boolean(block));

  return {
    format: input.format,
    fileName: input.fileName,
    sourceHash: input.sourceHash,
    byteLength: input.byteLength,
    plainText: input.text,
    blocks,
    tables: [],
  };
};

export const buildTableSourceDocument = (
  input: BuildTableSourceDocumentInput,
): StructuredSourceDocument => {
  const tableId = 'table-001';
  const rows = input.rows.map((row, rowIndex): SourceTableRow => ({
    index: rowIndex,
    cells: row.flatMap((value, columnIndex): SourceTableCell[] => {
      if (value === undefined) return [];
      return [{
        text: value,
        state: cellState(value),
        rowSpan: 1,
        columnSpan: 1,
        sourceLocation: { tableId, rowIndex, columnIndex },
      }];
    }),
  }));

  return {
    format: input.format,
    fileName: input.fileName,
    sourceHash: input.sourceHash,
    byteLength: input.byteLength,
    plainText: input.rows
      .map((row) => row.filter((value): value is string => value !== undefined).join(' '))
      .join('\n'),
    blocks: [],
    tables: [{ id: tableId, sourceOrder: 1, rows }],
  };
};

export const buildHtmlSourceDocument = (
  input: BuildHtmlSourceDocumentInput,
): StructuredSourceDocument => {
  const parser = new DOMParser();
  const document = parser.parseFromString(input.html, 'text/html');
  const blocks: SourceDocumentBlock[] = [];
  const tables: SourceDocumentTable[] = [];
  const plainTextParts: string[] = [];
  let sourceOrder = 1;

  document.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      const text = normalizeSourceText(node.textContent || '');
      if (text) {
        const id = `block-${String(sourceOrder).padStart(3, '0')}`;
        blocks.push({
          id,
          kind: 'paragraph',
          text,
          sourceOrder,
          sourceLocation: { blockId: id },
        });
        plainTextParts.push(text);
        sourceOrder += 1;
      }
      return;
    }

    const element = node as HTMLElement;
    if (element.tagName.toLowerCase() === 'table') {
      const tableId = `table-${String(tables.length + 1).padStart(3, '0')}`;
      const rows = Array.from((element as HTMLTableElement).rows).map((row, rowIndex): SourceTableRow => ({
        index: rowIndex,
        cells: Array.from(row.cells).map((htmlCell, columnIndex): SourceTableCell => {
          const text = normalizeSourceText(htmlCell.textContent || '');
          return {
            text,
            state: cellState(text),
            rowSpan: Math.max(1, htmlCell.rowSpan || 1),
            columnSpan: Math.max(1, htmlCell.colSpan || 1),
            sourceLocation: { tableId, rowIndex, columnIndex },
          };
        }),
      }));
      tables.push({ id: tableId, sourceOrder, rows });
      plainTextParts.push(
        rows
          .map((row) => row.cells.map((cell) => cell.text).join(' '))
          .join('\n'),
      );
      sourceOrder += 1;
      return;
    }

    const text = normalizeSourceText(element.textContent || '');
    if (!text) return;

    const id = `block-${String(sourceOrder).padStart(3, '0')}`;
    const tagName = element.tagName.toLowerCase();
    const sourceLocation: SourceLocation = { blockId: id };
    blocks.push({
      id,
      kind: /h[1-6]/.test(tagName) || isUnitHeadingText(text) ? 'heading' : 'paragraph',
      text,
      sourceOrder,
      sourceLocation,
    });
    plainTextParts.push(text);
    sourceOrder += 1;
  });

  return {
    format: input.format,
    fileName: input.fileName,
    sourceHash: input.sourceHash,
    byteLength: input.byteLength,
    plainText: plainTextParts.join('\n').trim() || input.fallbackText || '',
    blocks,
    tables,
  };
};
