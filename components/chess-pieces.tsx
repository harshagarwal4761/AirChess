"use client";
import type { Color } from "chess.js";

type Props = {
  type: string;
  color: Color;
  small?: boolean;
};

/** Custom Staunton-inspired SVG chess pieces so rendering is crisp and consistent across OSes. */
export function ChessPiece({ type, color, small = false }: Props) {
  const tone = color === "w" ? "ivory" : "obsidian";
  return (
    <span
      aria-hidden="true"
      className={`piece ${tone} ${small ? "small-piece" : ""}`}
    >
      <svg viewBox="0 0 45 45" className="piece-svg" role="presentation">
        {type === "p" && (
          <path
            className="piece-body"
            d="M22.5 9a4 4 0 0 0-4 4c0 1.35.67 2.54 1.7 3.26a6.48 6.48 0 0 0-3.2 5.59c0 2.04.95 3.86 2.43 5.04-2.97 1.07-6.93 5.05-6.93 11.61h20c0-6.56-3.96-10.54-6.93-11.61A6.47 6.47 0 0 0 28 21.85a6.48 6.48 0 0 0-3.2-5.59A4 4 0 0 0 26.5 13a4 4 0 0 0-4-4Z"
          />
        )}
        {type === "r" && (
          <g className="piece-body">
            <path d="M9 39h27v-3H9v3ZM12 36v-4h21v4H12ZM11 14V9h4v2h5V9h5v2h5V9h4v5" />
            <path d="M34 14l-3 3H14l-3-3" />
            <path d="M31 17v12.5H14V17" />
            <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
            <path className="piece-detail" d="M11 14h23M14 17h17M14 29.5h17" />
          </g>
        )}
        {type === "n" && (
          <g className="piece-body">
            <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
            <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" />
            <circle className="piece-accent" cx="15" cy="15.5" r="0.9" />
            <path className="piece-detail" d="M16 36.5h19" />
          </g>
        )}
        {type === "b" && (
          <g className="piece-body">
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2Z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2Z" />
            <circle cx="22.5" cy="8" r="2.5" />
            <path className="piece-detail" d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" />
          </g>
        )}
        {type === "q" && (
          <g className="piece-body">
            <circle cx="6" cy="12" r="2.4" />
            <circle cx="14" cy="9" r="2.4" />
            <circle cx="22.5" cy="8" r="2.4" />
            <circle cx="31" cy="9" r="2.4" />
            <circle cx="39" cy="12" r="2.4" />
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-13.5V25L7 14l2 12Z" />
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0Z" />
            <path className="piece-detail" d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" />
          </g>
        )}
        {type === "k" && (
          <g className="piece-body">
            <path className="piece-detail" d="M22.5 11.63V6M20 8h5" />
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
            <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37Z" />
            <path className="piece-detail" d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" />
          </g>
        )}
      </svg>
    </span>
  );
}
