"use client";

import { memo } from "react";

interface Props {
  text: string;
  active: boolean;
  fontSize?: string;
  color?: string;
  fontWeight?: number;
}

function WaveTextInner({ text, active, fontSize = "1.5rem", color, fontWeight = 600 }: Props) {
  if (!active) {
    return (
      <span style={{ fontSize, fontWeight, color, display: "inline-block" }}>
        {text}
      </span>
    );
  }

  const chars = Array.from(text);
  const len = chars.length;

  return (
    <span
      style={{ fontSize, fontWeight, color, display: "inline-block", whiteSpace: "pre-wrap" }}
      aria-label={text}
    >
      {chars.map((ch, i) => {
        const ratio = len <= 1 ? 0.5 : i / (len - 1);
        const amplitude = 0.6 * Math.sin(ratio * Math.PI);
        const peak = 1 + 0.15 + amplitude * 0.2;
        const delay = i * 60;
        const duration = 500 + amplitude * 300;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              animation: `wave-char ${duration}ms cubic-bezier(0.36, 0, 0.12, 1) ${delay}ms both`,
              ["--wave-peak" as string]: `${peak}`,
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      })}
    </span>
  );
}

export const WaveText = memo(WaveTextInner);
