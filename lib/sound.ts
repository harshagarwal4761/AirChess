export type SoundKind = "move" | "capture" | "castle" | "check" | "promote" | "end";

function tone(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  delay = 0,
  volume = 0.055,
  type: OscillatorType = "sine",
) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(startFreq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + duration);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.015);
}

/** Play subtle synthesized feedback for chess events without external audio assets. */
export function playChessSound(ctx: AudioContext, kind: SoundKind) {
  void ctx.resume();
  switch (kind) {
    case "capture":
      tone(ctx, 420, 150, 0.11, 0, 0.07, "triangle");
      tone(ctx, 640, 260, 0.06, 0.02, 0.035, "sine");
      break;
    case "castle":
      tone(ctx, 460, 240, 0.08, 0, 0.05);
      tone(ctx, 560, 310, 0.08, 0.07, 0.05);
      break;
    case "promote":
      tone(ctx, 520, 780, 0.1, 0, 0.055);
      tone(ctx, 780, 1040, 0.12, 0.06, 0.045);
      break;
    case "check":
      tone(ctx, 720, 480, 0.11, 0, 0.06, "triangle");
      tone(ctx, 880, 620, 0.12, 0.05, 0.045, "sine");
      break;
    case "end":
      tone(ctx, 523.25, 392, 0.14, 0, 0.055);
      tone(ctx, 659.25, 523.25, 0.18, 0.1, 0.055);
      break;
    case "move":
    default:
      tone(ctx, 520, 260, 0.11, 0, 0.055);
      break;
  }
}
