import React from 'react';
import type {
  CompiledSlideScene,
  SceneConnectorElement,
  SceneElement,
  SceneFrame,
  SceneImageElement,
  SceneShapeElement,
  SceneTableElement,
  SceneTextElement,
} from '../lib/compiledSlideScene';

type CompiledSlideSceneViewProps = {
  scene: CompiledSlideScene;
  direction: 'next' | 'prev' | null;
};

const frameStyle = (frame: SceneFrame): React.CSSProperties => ({
  left: `${(frame.x / 1280) * 100}%`,
  top: `${(frame.y / 720) * 100}%`,
  width: `${(frame.w / 1280) * 100}%`,
  height: `${(frame.h / 720) * 100}%`,
});

const renderTextElement = (element: SceneTextElement) => (
  <div
    key={element.id}
    className="absolute overflow-hidden whitespace-pre-wrap"
    style={{
      ...frameStyle(element.frame),
      fontSize: `${(element.fontSize / 720) * 100}cqh`,
      lineHeight: `${element.lineHeight / element.fontSize}`,
      textAlign: element.align,
      display: element.valign === 'middle' ? 'flex' : 'block',
      alignItems: element.valign === 'middle' ? 'center' : undefined,
      color: `#${element.runs[0]?.color || '111827'}`,
    }}
  >
    {element.runs.map((run, index) => (
      <span
        key={`${element.id}-run-${index}`}
        style={{
          fontWeight: run.bold ? 800 : 500,
          fontStyle: run.italic ? 'italic' : 'normal',
          color: run.color ? `#${run.color}` : undefined,
        }}
      >
        {run.text}
      </span>
    ))}
  </div>
);

const renderShapeElement = (element: SceneShapeElement) => (
  <div
    key={element.id}
    className="absolute"
    style={{
      ...frameStyle(element.frame),
      backgroundColor: `#${element.fill}`,
      border: `1px solid #${element.stroke || element.fill}`,
      borderRadius: element.shape === 'ellipse'
        ? '50%'
        : element.shape === 'pill'
          ? '999px'
          : `${element.radius ?? 0}px`,
      transform: element.shape === 'diamond' ? 'rotate(45deg) scale(0.7)' : undefined,
      boxShadow: element.elevated ? '0 3px 6px rgba(15, 23, 42, 0.22)' : undefined,
    }}
  />
);

const renderTableElement = (element: SceneTableElement) => (
  <table
    key={element.id}
    className="absolute table-fixed border-collapse overflow-hidden"
    style={{
      ...frameStyle(element.frame),
      fontSize: `${(element.fontSize / 720) * 100}cqh`,
      color: `#${element.textColor}`,
    }}
  >
    <thead>
      <tr>
        {element.headers.map((header, index) => (
          <th
            key={`${element.id}-header-${index}`}
            className="border border-slate-300 px-3 py-2 text-left font-bold"
            style={{ backgroundColor: `#${element.headerFill}`, color: '#FFFFFF' }}
          >
            {header}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {element.rows.map((row, rowIndex) => (
        <tr key={`${element.id}-row-${rowIndex}`}>
          {row.map((cell, cellIndex) => (
            <td
              key={`${element.id}-cell-${rowIndex}-${cellIndex}`}
              className="border border-slate-300 px-3 py-2 align-top"
              style={{ backgroundColor: `#${element.cellFill}` }}
            >
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const renderConnectorElement = (element: SceneConnectorElement) => (
  <svg
    key={element.id}
    className="absolute"
    style={frameStyle(element.frame)}
    viewBox={`0 0 ${Math.max(1, element.frame.w)} ${Math.max(1, element.frame.h)}`}
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <marker id={`${element.id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" fill={`#${element.stroke}`} />
      </marker>
    </defs>
    <line
      x1={element.frame.w >= element.frame.h ? 0 : element.frame.w / 2}
      y1={element.frame.w >= element.frame.h ? element.frame.h / 2 : 0}
      x2={element.frame.w >= element.frame.h ? element.frame.w : element.frame.w / 2}
      y2={element.frame.w >= element.frame.h ? element.frame.h / 2 : element.frame.h}
      stroke={`#${element.stroke}`}
      strokeWidth="2"
      markerStart={element.arrowStart ? `url(#${element.id}-arrow)` : undefined}
      markerEnd={element.arrowEnd ? `url(#${element.id}-arrow)` : undefined}
    />
  </svg>
);

const renderImageElement = (element: SceneImageElement) => (
  <img
    key={element.id}
    src={element.src}
    alt={element.altText}
    className="absolute object-contain"
    style={frameStyle(element.frame)}
    draggable={false}
  />
);

const renderSceneElement = (element: SceneElement) => {
  if (element.kind === 'text') return renderTextElement(element);
  if (element.kind === 'shape') return renderShapeElement(element);
  if (element.kind === 'table') return renderTableElement(element);
  if (element.kind === 'connector') return renderConnectorElement(element);
  if (element.kind === 'image') return renderImageElement(element);
  return null;
};

const CompiledSlideSceneView: React.FC<CompiledSlideSceneViewProps> = ({ scene, direction }) => (
  <div className="w-full aspect-video bg-white rounded-2xl shadow-neumorphic-outset overflow-hidden" style={{ containerType: 'size' }}>
    <div
      className={`relative w-full h-full text-slate-900 select-text ${
        direction === 'next' ? 'animate-slide-in-right' : direction === 'prev' ? 'animate-slide-in-left' : ''
      }`}
      style={{ backgroundColor: `#${scene.background}` }}
    >
      {scene.elements.map(renderSceneElement)}
    </div>
  </div>
);

export default CompiledSlideSceneView;
