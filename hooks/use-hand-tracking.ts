"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceGesture,
  initialGesture,
  pinchRatio,
  type Point,
} from "../lib/gestures";
import {
  cameraPoint,
  exceededPalmJump,
  followPointer,
  HOVER_MS,
  hoverSelect,
  newHover,
  resolveControllerHand,
  type AimMode,
  type CameraRect,
  type PointerState,
} from "../lib/air-pointer";
import { reachablePoint } from "../lib/air-controls";
import {
  classifyGesture,
  GestureSmoother,
  type RecordedGestureSample,
} from "../lib/gesture-classifier";
import type { GestureLabel } from "../lib/gesture-features";
import {
  centerTarget,
  newDoublePinch,
  openPalm,
  palmPoint,
  stepDoublePinch,
} from "../lib/double-pinch";
import type { TrackingDelegateMode, TrackingResolution } from "../lib/preferences";

export type AirEvent = { type: "confirm"; square: string } | { type: "cancel" };
export type HandTrackingOptions = {
  delegateMode?: TrackingDelegateMode;
  resolution?: TrackingResolution;
  hoverMs?: number;
};

type Feedback = {
  target: string | null;
  count: number;
  ready: boolean;
  locked: boolean;
  controllerReady: boolean;
  helper: boolean;
  progress: number;
  pinched: boolean;
  gesture: GestureLabel;
  gestureConfidence: number;
  message: string;
};

const AUTO_DELEGATE_CACHE_KEY = "airchess.autoDelegate.v1";

function readCachedAutoDelegate(): "GPU" | "CPU" | null {
  try {
    const val = typeof localStorage !== "undefined" ? localStorage.getItem(AUTO_DELEGATE_CACHE_KEY) : null;
    return val === "GPU" || val === "CPU" ? val : null;
  } catch {
    return null;
  }
}

function writeCachedAutoDelegate(value: "GPU" | "CPU" | null) {
  try {
    if (typeof localStorage === "undefined") return;
    if (value) localStorage.setItem(AUTO_DELEGATE_CACHE_KEY, value);
    else localStorage.removeItem(AUTO_DELEGATE_CACHE_KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}

const idleFeedback: Feedback = {
  target: null,
  count: 0,
  ready: false,
  locked: false,
  controllerReady: false,
  helper: false,
  progress: 0,
  pinched: false,
  gesture: "open",
  gestureConfidence: 0,
  message: "Show only your control hand, open, to begin.",
};

const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

export function useHandTracking(
  onEvent: (event: AirEvent) => void,
  reachAssist = false,
  interactionKey = "",
  mode: AimMode = "hover",
  twoHandPause = false,
  trackingOptions: HandTrackingOptions = {},
) {
  const delegateMode = trackingOptions.delegateMode ?? "auto";
  const resolution = trackingOptions.resolution ?? "fast";
  const hoverMs = trackingOptions.hoverMs ?? HOVER_MS;

  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    cursorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "off" | "loading" | "searching" | "tracking" | "error"
  >("off");
  const [error, setError] = useState(""),
    [fps, setFps] = useState(0),
    [latency, setLatency] = useState(0),
    [handCount, setHandCount] = useState(0),
    [delegate, setDelegate] = useState<"" | "GPU" | "CPU">(""),
    [feedback, setFeedback] = useState<Feedback>(idleFeedback);
  const callback = useRef(onEvent);
  const options = useRef({
    reachAssist,
    interactionKey,
    mode,
    twoHandPause,
    delegateMode,
    resolution,
    hoverMs,
  });
  const resources = useRef<{
    worker?: Worker;
    stream?: MediaStream;
    frame?: number;
    videoFrame?: number;
    removeLayoutListener?: () => void;
    generation: number;
    recalibrate?: () => void;
    timeout?: ReturnType<typeof setTimeout>;
    latestLandmarks?: { points: Point[]; aspect: number } | null;
  }>({ generation: 0 });

  useEffect(() => {
    callback.current = onEvent;
    options.current = {
      reachAssist,
      interactionKey,
      mode,
      twoHandPause,
      delegateMode,
      resolution,
      hoverMs,
    };
  }, [onEvent, reachAssist, interactionKey, mode, twoHandPause, delegateMode, resolution, hoverMs]);

  useEffect(() => {
    resources.current.worker?.postMessage({
      type: "config",
      numHands: twoHandPause ? 2 : 1,
    });
  }, [twoHandPause]);

  useEffect(() => {
    const worker = resources.current.worker;
    if (!worker) return;
    if (delegateMode === "auto") {
      writeCachedAutoDelegate(null);
      return;
    }
    worker.postMessage({
      type: "switch-delegate",
      delegate: delegateMode,
      numHands: options.current.twoHandPause ? 2 : 1,
    });
  }, [delegateMode]);

  const stop = useCallback(() => {
    const r = resources.current;
    r.generation++;
    if (r.frame) cancelAnimationFrame(r.frame);
    if (r.videoFrame !== undefined) videoRef.current?.cancelVideoFrameCallback?.(r.videoFrame);
    r.videoFrame = undefined;
    r.removeLayoutListener?.();
    r.removeLayoutListener = undefined;
    clearTimeout(r.timeout);
    r.worker?.terminate();
    r.stream?.getTracks().forEach((t) => t.stop());
    r.worker = undefined;
    r.stream = undefined;
    r.recalibrate = undefined;
    r.latestLandmarks = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    cursorRef.current
      ?.querySelectorAll<HTMLElement>(".air-cursor")
      .forEach((c) => (c.style.display = "none"));
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    document
      .querySelectorAll(".air-dwell")
      .forEach((e) => e.classList.remove("air-dwell"));
    callback.current({ type: "cancel" });
    setStatus("off");
    setFps(0);
    setLatency(0);
    setHandCount(0);
    setDelegate("");
    setFeedback(idleFeedback);
  }, []);

  useEffect(() => () => stop(), [stop]);
  const recalibrate = useCallback(() => resources.current.recalibrate?.(), []);
  const captureSample = useCallback((label: GestureLabel): RecordedGestureSample | null => {
    const latest = resources.current.latestLandmarks;
    if (!latest) return null;
    return {
      label,
      aspect: latest.aspect,
      points: latest.points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      capturedAt: Date.now(),
    };
  }, []);

  const start = useCallback(async () => {
    stop();
    const r = resources.current,
      generation = r.generation;
    setStatus("loading");
    setError("");
    const fail = (message: string) => {
      if (r.generation !== generation) return;
      stop();
      setStatus("error");
      setError(message);
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera access needs HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          frameRate: { ideal: 60, min: 24 },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      if (r.generation !== generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      r.stream = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (r.generation !== generation) return;
      const worker = new Worker("/hand-tracking-worker.js");
      r.worker = worker;

      let state = initialGesture(),
        sequence = newDoublePinch(),
        pointerState: PointerState = null,
        hover = newHover(),
        controller: string | null = null;
      let calibrationLabel = "",
        calibrationSince = 0,
        helperLastSeen = -Infinity,
        paused = false,
        lastPalm: Point | null = null,
        lastPalmAt = 0,
        fistSince = 0,
        fistCancelled = false;
      const smoother = new GestureSmoother();
      let lastKey = options.current.interactionKey + options.current.mode,
        lastSeen = 0,
        lastTrack = 0,
        lastVideo = -1,
        inFlight = false,
        frameSentAt = 0,
        ready = false,
        count = 0,
        latencyTotal = 0,
        fpsSince = performance.now();
      let dwell: HTMLElement | null = null,
        dwellSince = 0,
        fired: HTMLElement | null = null,
        lastFeedback = "",
        lastFeedbackAt = 0;

      let lastStatusSent: "searching" | "tracking" | "" = "";
      let lastHandCountSent = -1;
      let lastCursorVisible = false;
      let lastPinchedAttr = "";
      let lastProgressAttr = "";
      let lastProgressDeg = -1;

      const cachedRect: CameraRect = { left: 0, top: 0, width: 0, height: 0 };
      let cachedVw = 0;
      let cachedVh = 0;
      const syncGeometry = () => {
        const rect = video.getBoundingClientRect();
        cachedRect.left = rect.left;
        cachedRect.top = rect.top;
        cachedRect.width = rect.width;
        cachedRect.height = rect.height;
        cachedVw = document.documentElement.clientWidth;
        cachedVh = innerHeight;
      };
      syncGeometry();

      // Auto GPU-vs-CPU benchmark state (only active when delegateMode === "auto" without cached winner).
      const cachedWinner = options.current.delegateMode === "auto" ? readCachedAutoDelegate() : null;
      let benchPhase: "done" | "measure-gpu" | "switching" | "measure-cpu" =
        options.current.delegateMode === "auto" && !cachedWinner ? "measure-gpu" : "done";
      let benchWarmup = 0;
      const gpuSamples: number[] = [];
      let cpuSamples: number[] = [];

      const publish = (value: Feedback, force = false) => {
        const key = JSON.stringify(value);
        const t = performance.now();
        if (key !== lastFeedback && (force || t - lastFeedbackAt > 90 || value.progress === 0 || value.progress === 1)) {
          lastFeedback = key;
          lastFeedbackAt = t;
          setFeedback(value);
        }
      };
      const clearDwell = () => {
        dwell?.classList.remove("air-dwell");
        dwell = null;
      };
      const clearAttempt = (cancelSelection = false) => {
        state = initialGesture();
        sequence = newDoublePinch();
        pointerState = null;
        hover = newHover(hover.blocked);
        lastPalm = null;
        lastPalmAt = 0;
        fistSince = 0;
        fistCancelled = false;
        smoother.reset();
        clearDwell();
        fired = null;
        if (cancelSelection) callback.current({ type: "cancel" });
      };
      const layoutChanged = () => {
        syncGeometry();
        clearAttempt();
      };
      window.addEventListener("airchess-layout-change", layoutChanged);
      window.addEventListener("resize", syncGeometry);
      video.addEventListener("resize", syncGeometry);
      r.removeLayoutListener = () => {
        window.removeEventListener("airchess-layout-change", layoutChanged);
        window.removeEventListener("resize", syncGeometry);
        video.removeEventListener("resize", syncGeometry);
      };

      const hideCursor = () => {
        if (!lastCursorVisible) return;
        lastCursorVisible = false;
        const cursor = cursorRef.current?.children[0] as HTMLElement | undefined;
        if (cursor) cursor.style.display = "none";
      };

      const lose = () => {
        // Detection dropouts cancel pending input, never the selected chess piece.
        clearAttempt();
        hideCursor();
        publish({
          ...idleFeedback,
          controllerReady: Boolean(controller),
          message: controller
            ? "Control hand lost. Open it in view to resume."
            : idleFeedback.message,
        });
      };

      r.recalibrate = () => {
        controller = null;
        calibrationLabel = "";
        calibrationSince = 0;
        clearAttempt(true);
        publish(idleFeedback);
      };

      const timeout = (r.timeout = setTimeout(() => {
        if (!ready)
          fail(
            "The hand model took too long to load. Check your connection and restart the camera.",
          );
      }, 45000));

      worker.onerror = () => {
        clearTimeout(timeout);
        fail(
          "Hand tracking could not start in this browser. Try an up-to-date Chrome or Edge browser.",
        );
      };

      worker.onmessage = (event: MessageEvent) => {
        if (r.generation !== generation) return;
        const data = event.data;
        if (data.type === "ready") {
          clearTimeout(timeout);
          ready = true;
          const activeDel = data.delegate === "CPU" ? "CPU" : "GPU";
          setDelegate(activeDel);
          if (activeDel === "CPU" && benchPhase === "measure-gpu") {
            // Device fell back to CPU immediately; no benchmark needed.
            benchPhase = "done";
          }
          lastStatusSent = "searching";
          setStatus("searching");
          return;
        }
        if (data.type === "delegate-switched") {
          setDelegate(data.delegate === "CPU" ? "CPU" : "GPU");
          if (benchPhase === "switching") {
            benchPhase = data.delegate === "CPU" ? "measure-cpu" : "done";
            benchWarmup = 0;
          }
          fpsSince = performance.now();
          count = 0;
          latencyTotal = 0;
          return;
        }
        if (data.type === "error") {
          clearTimeout(timeout);
          fail(data.message);
          return;
        }
        if (data.type !== "result") return;
        inFlight = false;
        const now = performance.now();
        if (document.hidden || now - data.timestamp > 900) {
          lose();
          return;
        }
        lastSeen = now;
        count++;
        latencyTotal += now - data.timestamp;
        if (now - fpsSince > 1000) {
          setFps(Math.round((count * 1000) / (now - fpsSince)));
          setLatency(Math.round(latencyTotal / count));
          fpsSince = now;
          count = 0;
          latencyTotal = 0;
        }

        // Auto GPU-vs-CPU latency check using real worker inference timing.
        if (
          options.current.delegateMode === "auto" &&
          benchPhase !== "done" &&
          benchPhase !== "switching" &&
          typeof data.inferenceMs === "number"
        ) {
          if (benchWarmup < 3) {
            benchWarmup++;
          } else if (benchPhase === "measure-gpu") {
            gpuSamples.push(data.inferenceMs);
            if (gpuSamples.length >= 10) {
              const gpuAvg = gpuSamples.reduce((a, b) => a + b, 0) / gpuSamples.length;
              if (gpuAvg <= 50) {
                writeCachedAutoDelegate("GPU");
                benchPhase = "done";
              } else {
                benchPhase = "switching";
                cpuSamples = [];
                worker.postMessage({
                  type: "switch-delegate",
                  delegate: "CPU",
                  numHands: options.current.twoHandPause ? 2 : 1,
                });
              }
            }
          } else if (benchPhase === "measure-cpu") {
            cpuSamples.push(data.inferenceMs);
            if (cpuSamples.length >= 10) {
              const gpuAvg = gpuSamples.reduce((a, b) => a + b, 0) / gpuSamples.length;
              const cpuAvg = cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length;
              const winner: "GPU" | "CPU" = cpuAvg <= gpuAvg * 1.05 ? "CPU" : "GPU";
              writeCachedAutoDelegate(winner);
              benchPhase = "done";
              if (winner === "GPU") {
                worker.postMessage({
                  type: "switch-delegate",
                  delegate: "GPU",
                  numHands: options.current.twoHandPause ? 2 : 1,
                });
              }
            }
          }
        }

        if (document.documentElement.dataset.layoutDragging) {
          clearAttempt();
          hideCursor();
          publish({
            ...idleFeedback,
            controllerReady: Boolean(controller),
            message: "Moving a panel. Release the handle to resume controls.",
          });
          return;
        }

        const landmarks = data.landmarks as Point[][],
          labels = (data.handedness as { categoryName: string }[][]).map(
            (h) => h[0]?.categoryName ?? "",
          );
        if (landmarks.length !== lastHandCountSent) {
          lastHandCountSent = landmarks.length;
          setHandCount(landmarks.length);
        }
        const nextStatus = landmarks.length ? "tracking" : "searching";
        if (nextStatus !== lastStatusSent) {
          lastStatusSent = nextStatus;
          setStatus(nextStatus);
        }

        if (cachedRect.width === 0) syncGeometry();
        const vw = cachedVw || document.documentElement.clientWidth;
        const vh = cachedVh || innerHeight;
        const videoRect = cachedRect.width ? cachedRect : video.getBoundingClientRect();

        const mapped = landmarks.map((hand) =>
          hand.map((p) =>
            cameraPoint(
              p,
              { width: video.videoWidth, height: video.videoHeight },
              videoRect,
            ),
          ),
        );

        const aspect = video.videoWidth / Math.max(1, video.videoHeight);
        if (!controller) {
          if (
            landmarks.length === 1 &&
            labels[0] &&
            pinchRatio(landmarks[0], aspect) > 0.54
          ) {
            if (calibrationLabel !== labels[0]) {
              calibrationLabel = labels[0];
              calibrationSince = now;
            } else if (now - calibrationSince >= 280) {
              controller = labels[0];
              clearAttempt();
            }
          } else {
            calibrationLabel = "";
            calibrationSince = 0;
          }
        }

        const singlePalm = mapped[0] ? palmPoint(mapped[0]) : null;
        const primary = resolveControllerHand(
          labels,
          controller,
          options.current.twoHandPause,
          singlePalm,
          lastPalm,
          Math.max(vw, vh) * 0.38,
        );

        // Render skeleton cleanly after mapping.
        const canvas = canvasRef.current!,
          ctx = canvas.getContext("2d")!;
        if (canvas.width !== vw) canvas.width = vw;
        if (canvas.height !== vh) canvas.height = vh;
        ctx.clearRect(0, 0, vw, vh);
        for (let i = 0; i < mapped.length; i++) {
          ctx.strokeStyle = i === primary ? "#bfead6a8" : "#efd0a850";
          ctx.lineWidth = i === primary ? 2 : 1;
          ctx.beginPath();
          for (const [a, b] of connections) {
            ctx.moveTo(mapped[i][a].x, mapped[i][a].y);
            ctx.lineTo(mapped[i][b].x, mapped[i][b].y);
          }
          ctx.stroke();
          if (i === primary) {
            ctx.fillStyle = "#ceffe5";
            ctx.beginPath();
            ctx.arc(mapped[i][8].x, mapped[i][8].y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (primary < 0) {
          // Hold active hover state briefly across short detection dropouts.
          if (lastTrack && now - lastTrack < 280) return;
          lose();
          return;
        }
        lastTrack = now;

        const helperOpen = mapped.some(
          (points, i) => i !== primary && openPalm(points),
        );
        if (helperOpen) helperLastSeen = now;
        const helper = now - helperLastSeen < 350;
        if (helper) {
          if (!paused) clearAttempt();
          paused = true;
          hideCursor();
          publish({
            ...idleFeedback,
            controllerReady: true,
            helper: true,
            message: "Paused by your second hand. Lower it to resume.",
          });
          return;
        }
        if (paused) {
          paused = false;
          clearAttempt();
        }
        if (lastKey !== options.current.interactionKey + options.current.mode) {
          lastKey = options.current.interactionKey + options.current.mode;
          clearAttempt();
        }

        const points = mapped[primary],
          palm = palmPoint(points);
        if (
          exceededPalmJump(
            palm,
            lastPalm,
            lastPalmAt ? now - lastPalmAt : 33,
            Math.min(vw, vh),
            options.current.twoHandPause || landmarks.length > 1,
          )
        ) {
          lose();
          return;
        }
        lastPalm = palm;
        lastPalmAt = now;

        r.latestLandmarks = { points: landmarks[primary], aspect };
        const gesturePred = smoother.update(classifyGesture(landmarks[primary], aspect));
        if (gesturePred.label === "fist" && gesturePred.confidence >= 0.86) {
          if (!fistSince) fistSince = now;
          if (!fistCancelled && now - fistSince >= 450) {
            fistCancelled = true;
            clearAttempt(true);
            publish(
              {
                ...idleFeedback,
                controllerReady: true,
                gesture: "fist",
                gestureConfidence: Math.round(gesturePred.confidence * 100),
                message: "Fist hold — selection cancelled.",
              },
              true,
            );
            return;
          }
        } else {
          fistSince = 0;
          fistCancelled = false;
        }

        const rawRatio = pinchRatio(landmarks[primary], aspect);
        // Fuse geometric ratio with tilt-invariant MLP probability for more reliable pinches.
        const ratio =
          gesturePred.probabilities.pinch > 0.88 && rawRatio < 0.52
            ? Math.min(rawRatio, 0.32)
            : gesturePred.probabilities.open > 0.88 && rawRatio > 0.48
              ? Math.max(rawRatio, 0.72)
              : rawRatio;
        const raw = options.current.reachAssist
          ? reachablePoint(points[8], {
              width: vw,
              height: vh,
            })
          : points[8];
        // A curled thumb must not freeze the cursor. Aim always follows the index.
        pointerState = followPointer(pointerState, raw, now);
        const pointer = pointerState!.point;
        const isHover = options.current.mode === "hover";

        // Perform all DOM hit-testing reads before mutating cursor/dwell styles.
        const hit = document.elementFromPoint(pointer.x, pointer.y);
        const element = hit?.closest<HTMLElement>("[data-air-square]") ?? null;
        let target = element
          ? centerTarget(
              element.dataset.airSquare!,
              element.getBoundingClientRect(),
              pointer,
              isHover ? 0.0 : 0.06,
            )
          : null;
        if (isHover && !target && hover.target) {
          const prevEl = document.querySelector<HTMLElement>(
            `[data-air-square="${hover.target.square}"]`,
          );
          if (prevEl) {
            const rect = prevEl.getBoundingClientRect();
            const pad = Math.max(8, Math.round(rect.width * 0.12));
            if (
              pointer.x >= rect.left - pad &&
              pointer.x <= rect.right + pad &&
              pointer.y >= rect.top - pad &&
              pointer.y <= rect.bottom + pad
            ) {
              target = {
                square: hover.target.square,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                size: Math.min(rect.width, rect.height),
              };
            }
          }
        }
        const button = hit?.closest<HTMLElement>("[data-air]") ?? null;
        const buttonDisabled = Boolean(button?.matches(":disabled"));

        let confirmed: string | null = null;
        let progress = 0;
        let cancelled = false;
        let aim: typeof target = target;
        if (isHover) {
          const hovering = hoverSelect(hover, target, now, options.current.hoverMs);
          hover = hovering.state;
          confirmed = hovering.confirmed;
          progress = hovering.progress;
        } else {
          const next = advanceGesture(state, ratio, now);
          state = next.state;
          const stepped = stepDoublePinch(sequence, {
            now,
            target,
            palm,
            edge: next.event,
            visible: true,
            // Retain the pre-pinch target while the fingertip curls, not the cursor.
            open: ratio > 0.65 && !state.pinched && !state.candidate,
          });
          sequence = stepped.state;
          confirmed = stepped.confirmed;
          cancelled = stepped.cancelled;
          progress = sequence.count / 2;
          aim = sequence.locked ?? sequence.hover;
        }

        const cursor = cursorRef.current!.children[0] as HTMLElement;
        if (!lastCursorVisible) {
          lastCursorVisible = true;
          cursor.style.display = "block";
        }
        cursor.style.transform = `translate3d(${pointer.x.toFixed(1)}px,${pointer.y.toFixed(1)}px,0)`;
        const nextPinchedAttr = String(!isHover && state.pinched);
        if (nextPinchedAttr !== lastPinchedAttr) {
          lastPinchedAttr = nextPinchedAttr;
          cursor.dataset.pinched = nextPinchedAttr;
        }
        const nextProgressAttr = String(isHover ? 0 : sequence.count);
        if (nextProgressAttr !== lastProgressAttr) {
          lastProgressAttr = nextProgressAttr;
          cursor.dataset.progress = nextProgressAttr;
        }
        const nextDeg = Math.round(progress * 360);
        if (nextDeg !== lastProgressDeg) {
          lastProgressDeg = nextDeg;
          cursor.style.setProperty("--air-progress", `${nextDeg}deg`);
        }

        const stable = Boolean(!isHover && sequence.hover && now - sequence.hoverSince >= 160);
        publish({
          target: aim?.square ?? null,
          count: isHover ? 0 : sequence.count,
          ready: isHover ? Boolean(target) : stable,
          locked: !isHover && Boolean(sequence.locked),
          controllerReady: true,
          helper: false,
          progress: Math.round(progress * 10) / 10,
          pinched: !isHover && state.pinched,
          gesture: gesturePred.label,
          gestureConfidence: Math.round(gesturePred.confidence * 100),
          message: confirmed
            ? `${confirmed} confirmed. Move to your next square.`
            : isHover
              ? target
                ? hover.blocked === target.square
                  ? "Selected. Move to a highlighted destination."
                  : `Hold on ${target.square} · ${Math.round(progress * 10) * 10}%`
                : "Point at a piece, then hold for the ring to fill."
              : cancelled
                ? "Attempt cancelled. Aim and try again."
                : sequence.locked
                  ? `${sequence.locked.square}: ${sequence.count}/2 pinches. Open between pinches.`
                  : stable
                    ? `${sequence.hover!.square} ready — pinch twice.`
                    : "Point at a piece or highlighted destination, then pinch twice.",
        });

        if (confirmed) {
          clearDwell();
          fired = null;
          callback.current({ type: "confirm", square: confirmed });
          return;
        }

        if (
          (!isHover && (state.pinched || state.candidate || Boolean(sequence.locked))) ||
          !button ||
          buttonDisabled
        ) {
          clearDwell();
          if (!button) fired = null;
        } else if (button !== dwell) {
          clearDwell();
          dwell = button;
          dwellSince = now;
          if (fired !== button) {
            fired = null;
            button.classList.add("air-dwell");
          }
        } else if (now - dwellSince > 1300 && fired !== button) {
          fired = button;
          clearDwell();
          button.click();
        }
      };

      const initialDelegate =
        options.current.delegateMode === "auto"
          ? cachedWinner ?? "auto"
          : options.current.delegateMode;
      worker.postMessage({
        type: "init",
        origin: location.origin,
        numHands: options.current.twoHandPause ? 2 : 1,
        delegate: initialDelegate,
      });

      // Capture each fresh camera frame when the model is ready. Never build a queue.
      const capture = (now: number, mediaTime: number) => {
        if (!ready || inFlight || document.hidden || video.readyState < 2 || mediaTime === lastVideo) return;
        lastVideo = mediaTime;
        inFlight = true;
        frameSentAt = now;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const targetWidth = options.current.resolution === "balanced" ? 512 : 384;
        const bitmapPromise =
          vw > targetWidth && vh > 0
            ? createImageBitmap(video, {
                resizeWidth: targetWidth,
                resizeHeight: Math.max(1, Math.round((targetWidth * vh) / vw)),
                resizeQuality: "low",
              })
            : createImageBitmap(video);
        bitmapPromise
          .then((bitmap) => {
            if (r.generation !== generation) {
              bitmap.close();
              return;
            }
            worker.postMessage({ type: "frame", bitmap, timestamp: now }, [bitmap]);
          })
          .catch(() => {
            inFlight = false;
            frameSentAt = 0;
            fail("Camera frames could not be read. Restart the camera.");
          });
      };

      const hasVideoFrames = typeof video.requestVideoFrameCallback === "function";
      if (hasVideoFrames) {
        const onVideoFrame: VideoFrameRequestCallback = (now, metadata) => {
          if (r.generation !== generation) return;
          r.videoFrame = video.requestVideoFrameCallback(onVideoFrame);
          capture(now, metadata.mediaTime);
        };
        r.videoFrame = video.requestVideoFrameCallback(onVideoFrame);
      }

      // RAF supplies the loss watchdog and a compatibility fallback for older browsers.
      const tick = (now: number) => {
        if (r.generation !== generation) return;
        r.frame = requestAnimationFrame(tick);
        if (inFlight && frameSentAt && now - frameSentAt > 2500) {
          inFlight = false;
          frameSentAt = 0;
        }
        if (lastSeen && now - lastSeen > 900) {
          lose();
          lastSeen = 0;
        }
        if (!hasVideoFrames) capture(now, video.currentTime);
      };
      r.frame = requestAnimationFrame(tick);
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      fail(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access, then retry."
          : name === "NotFoundError"
            ? "No webcam was found."
            : e instanceof Error
              ? e.message
              : "Could not start the camera.",
      );
    }
  }, [stop]);

  return {
    videoRef,
    canvasRef,
    cursorRef,
    start,
    stop,
    recalibrate,
    captureSample,
    status,
    error,
    fps,
    latency,
    handCount,
    delegate,
    feedback,
  };
}
