import { Fragment, useState } from "react";
import { mentionsDataGap, paragraphs, segmentFigures, splitSentences } from "../lib/prose";

/** Figures set in the mono face and brighter than the prose around them,
 * so the numbers a paragraph rests on can be picked out at a glance. */
export function WithFigures({ text }: { text: string }) {
  return (
    <>
      {segmentFigures(text).map((seg, i) =>
        seg.figure ? (
          <span key={i} className="tabular whitespace-nowrap font-mono text-[0.9em] font-medium text-accent">
            {seg.text}
          </span>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

/** The model's narrative, re-flowed for reading (2026-09-25):
 * - the first sentence is the lead, set larger;
 * - the rest is split into two-sentence paragraphs with room between them;
 * - figures are highlighted, and sentences saying data was missing get a
 *   caution marker in the margin;
 * - long text is clamped with "Read more".
 * Plain text only — never rendered as HTML (CLAUDE.md Rule 5). */
export function Prose({
  text,
  lead = true,
  clampAfter = 3,
}: {
  text: string;
  lead?: boolean;
  /** Paragraphs shown (after the lead) before "Read more"; 0 = no clamp. */
  clampAfter?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;

  const [first, ...rest] = lead ? sentences : ["", ...sentences];
  const paras = paragraphs(rest);
  const clamped = clampAfter > 0 && !expanded && paras.length > clampAfter;
  const shown = clamped ? paras.slice(0, clampAfter) : paras;
  const hiddenSentences = paras.slice(clampAfter).flat().length;

  return (
    <div className="max-w-[72ch] space-y-3">
      {lead && first && (
        <p className="text-[15px] font-medium leading-relaxed text-ink">
          <WithFigures text={first} />
        </p>
      )}
      {shown.map((para, i) => (
        <p key={i} className="text-sm leading-7 text-ink-muted">
          {para.map((sentence, j) => (
            <Fragment key={j}>
              {j > 0 && " "}
              {mentionsDataGap(sentence) ? (
                <span
                  className="rounded-sm bg-caution-subtle/70 px-0.5 text-ink [box-decoration-break:clone]"
                  title="The analysis says data was missing here"
                >
                  <WithFigures text={sentence} />
                </span>
              ) : (
                <WithFigures text={sentence} />
              )}
            </Fragment>
          ))}
        </p>
      ))}
      {clampAfter > 0 && paras.length > clampAfter && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          {expanded ? "Show less" : `Read more (${hiddenSentences} more sentence${hiddenSentences === 1 ? "" : "s"})`}
        </button>
      )}
    </div>
  );
}
