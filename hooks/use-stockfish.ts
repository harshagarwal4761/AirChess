"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Color } from "chess.js";
import {
  DIFFICULTY_PRESETS,
  parseBestMove,
  parseUciInfo,
  type DifficultyPreset,
  type EvalScore,
  type ParsedMove,
} from "../lib/stockfish";

type SearchJob = {
  id: number;
  kind: "move" | "eval";
  sideToMove: Color;
  onMove?: (move: ParsedMove) => void;
};

export function useStockfish(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [evalScore, setEvalScore] = useState<EvalScore | null>(null);
  const [bestHint, setBestHint] = useState<ParsedMove | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const jobRef = useRef<SearchJob | null>(null);
  const nextIdRef = useRef(1);
  const pendingCommandRef = useRef<{ kind: "move" | "eval"; run: (worker: Worker) => void } | null>(null);

  const stopWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    readyRef.current = false;
    jobRef.current = null;
    pendingCommandRef.current = null;
    setReady(false);
    setThinking(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        stopWorker();
        setEvalScore(null);
        setBestHint(null);
        setError("");
      });
      return;
    }

    let cancelled = false;
    try {
      const wasmSupported =
        typeof WebAssembly === "object" &&
        WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      if (!wasmSupported) {
        queueMicrotask(() => setError("WebAssembly is required for Stockfish analysis."));
        return;
      }
      const worker = new Worker("/stockfish/stockfish.wasm.js");
      workerRef.current = worker;

      worker.onerror = () => {
        if (cancelled) return;
        setError("Chess engine could not start in this browser.");
        setThinking(false);
      };

      worker.onmessage = (event: MessageEvent<string>) => {
        if (cancelled || typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line === "uciok") {
          worker.postMessage("isready");
          return;
        }
        if (line === "readyok") {
          readyRef.current = true;
          setReady(true);
          setError("");
          const pending = pendingCommandRef.current;
          pendingCommandRef.current = null;
          pending?.run(worker);
          return;
        }

        const job = jobRef.current;
        if (!job) return;

        if (line.startsWith("info ")) {
          const parsed = parseUciInfo(line, job.sideToMove);
          if (parsed?.score) setEvalScore(parsed.score);
          if (parsed?.bestMove && job.kind === "eval") setBestHint(parsed.bestMove);
          return;
        }

        if (line.startsWith("bestmove ")) {
          const move = parseBestMove(line);
          const finishedJob = jobRef.current;
          jobRef.current = null;
          if (finishedJob?.kind === "move") {
            setThinking(false);
            if (move) finishedJob.onMove?.(move);
          } else if (move && finishedJob?.kind === "eval") {
            setBestHint(move);
          }
        }
      };

      worker.postMessage("uci");
    } catch {
      queueMicrotask(() => setError("Chess engine could not start."));
    }

    return () => {
      cancelled = true;
      stopWorker();
    };
  }, [enabled, stopWorker]);

  const dispatch = useCallback((kind: "move" | "eval", run: (worker: Worker) => void) => {
    const worker = workerRef.current;
    if (!worker) return;
    if (!readyRef.current) {
      if (kind === "eval" && pendingCommandRef.current?.kind === "move") return;
      pendingCommandRef.current = {
        kind,
        run: (activeWorker) => {
          if (workerRef.current === activeWorker) run(activeWorker);
        },
      };
      return;
    }
    run(worker);
  }, []);

  const cancelSearch = useCallback(() => {
    jobRef.current = null;
    pendingCommandRef.current = null;
    setThinking(false);
    if (workerRef.current && readyRef.current) {
      workerRef.current.postMessage("stop");
    }
  }, []);

  const requestMove = useCallback(
    (
      fen: string,
      sideToMove: Color,
      difficulty: DifficultyPreset,
      onMove: (move: ParsedMove) => void,
    ) => {
      const preset = DIFFICULTY_PRESETS[difficulty];
      const id = nextIdRef.current++;
      setThinking(true);
      dispatch("move", (worker) => {
        if (jobRef.current) worker.postMessage("stop");
        jobRef.current = { id, kind: "move", sideToMove, onMove };
        worker.postMessage(`setoption name Skill Level value ${preset.skill}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${preset.depth} movetime ${preset.movetime}`);
      });
      return id;
    },
    [dispatch],
  );

  const evaluatePosition = useCallback(
    (fen: string, sideToMove: Color) => {
      const id = nextIdRef.current++;
      dispatch("eval", (worker) => {
        if (jobRef.current?.kind === "move") return;
        if (jobRef.current) worker.postMessage("stop");
        jobRef.current = { id, kind: "eval", sideToMove };
        worker.postMessage("setoption name Skill Level value 20");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage("go depth 12 movetime 650");
      });
    },
    [dispatch],
  );

  return {
    ready,
    thinking,
    error,
    evalScore,
    bestHint,
    setEvalScore,
    setBestHint,
    cancelSearch,
    requestMove,
    evaluatePosition,
  };
}
