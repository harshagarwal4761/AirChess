"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceGesture,
  initialGesture,
  pinchRatio,
  type Point,
} from "../lib/gestures";
import { cameraPoint, followPointer, hoverSelect, newHover, type AimMode, type PointerState } from "../lib/air-pointer";
import { reachablePoint } from "../lib/air-controls";
import {
  centerTarget,
  controllerIndex,
  newDoublePinch,
  openPalm,
  palmPoint,
  stepDoublePinch,
} from "../lib/double-pinch";
export type AirEvent = { type: "confirm"; square: string } | { type: "cancel" };
type Feedback = {
  target: string | null;
  count: number;
  ready: boolean;
  locked: boolean;
  controllerReady: boolean;
  helper: boolean;
  progress: number;
  pinched: boolean;
  message: string;
};
const idleFeedback: Feedback = {
  target: null,
  count: 0,
  ready: false,
  locked: false,
  controllerReady: false,
  helper: false,
  progress: 0,
  pinched: false,
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
) {
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
    [feedback, setFeedback] = useState<Feedback>(idleFeedback);
  const callback = useRef(onEvent);
  const options = useRef({ reachAssist, interactionKey, mode });
  useEffect(() => {
    callback.current = onEvent;
    options.current = { reachAssist, interactionKey, mode };
  }, [onEvent, reachAssist, interactionKey, mode]);
  const resources = useRef<{
    worker?: Worker;
    stream?: MediaStream;
    frame?: number;
    videoFrame?: number;
    removeLayoutListener?: () => void;
    generation: number;
    recalibrate?: () => void;
    timeout?: ReturnType<typeof setTimeout>;
  }>({ generation: 0 });
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
    setFeedback(idleFeedback);
  }, []);
  useEffect(() => () => stop(), [stop]);
  const recalibrate = useCallback(() => resources.current.recalibrate?.(), []);
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
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 960 },
          height: { ideal: 540 },
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
      const worker = new Worker(
        "/hand-tracking-worker.js",
      );
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
        lastPalm: Point | null = null;
      let lastKey = options.current.interactionKey + options.current.mode,
        lastSeen = 0,
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
        lastFeedback = "";
      const publish = (value: Feedback) => {
        const key = JSON.stringify(value);
        if (key !== lastFeedback) {
          lastFeedback = key;
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
        clearDwell();
        fired = null;
        if (cancelSelection) callback.current({ type: "cancel" });
      };
      const layoutChanged = () => clearAttempt();
      window.addEventListener("airchess-layout-change", layoutChanged);
      r.removeLayoutListener = () => window.removeEventListener("airchess-layout-change", layoutChanged);
      const lose = () => {
        // Detection dropouts cancel pending input, never the selected chess piece.
        clearAttempt();
        const cursor = cursorRef.current?.children[0] as
          | HTMLElement
          | undefined;
        if (cursor) cursor.style.display = "none";
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
      const timeout = r.timeout = setTimeout(() => {
        if (!ready)
          fail(
            "The hand model took too long to load. Check your connection and restart the camera.",
          );
      }, 45000);
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
          setStatus("searching");
          return;
        }
        if (data.type === "error") {
          clearTimeout(timeout);
          fail(data.message);
          return;
        }
        if (data.type !== "result") return;
        inFlight = false;
        if (document.hidden || performance.now() - data.timestamp > 750) {
          lose();
          return;
        }
        const now = performance.now();
        lastSeen = now;
        count++;
        latencyTotal += now - data.timestamp;
        if (now - fpsSince > 1000) {
          setFps(Math.round((count * 1000) / (now - fpsSince)));
          setLatency(Math.round(latencyTotal / count));
          fpsSince = now; count = 0; latencyTotal = 0;
        }
        if (document.documentElement.dataset.layoutDragging) {
          clearAttempt();
          const cursor = cursorRef.current?.children[0] as HTMLElement | undefined;
          if (cursor) cursor.style.display = "none";
          publish({ ...idleFeedback, controllerReady: Boolean(controller), message: "Moving a panel. Release the handle to resume controls." });
          return;
        }
        const landmarks = data.landmarks as Point[][],
          labels = (data.handedness as { categoryName: string }[][]).map(
            (h) => h[0]?.categoryName ?? "",
          );
        setHandCount(landmarks.length);
        setStatus(landmarks.length ? "tracking" : "searching");
        const canvas = canvasRef.current!,
          ctx = canvas.getContext("2d")!;
        const vw = document.documentElement.clientWidth,
          vh = innerHeight,
          dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(vw * dpr)) canvas.width = Math.round(vw * dpr);
        if (canvas.height !== Math.round(vh * dpr)) canvas.height = Math.round(vh * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, vw, vh);
        const videoRect = video.getBoundingClientRect();
        const mapped = landmarks.map((hand) =>
          hand.map((p) =>
            cameraPoint(
              p,
              { width: video.videoWidth, height: video.videoHeight },
              videoRect,
            ),
          ),
        );
        if (!controller) {
          if (
            landmarks.length === 1 &&
            labels[0] &&
            pinchRatio(landmarks[0], video.videoWidth / video.videoHeight) >
              0.65
          ) {
            if (calibrationLabel !== labels[0]) {
              calibrationLabel = labels[0];
              calibrationSince = now;
            } else if (now - calibrationSince >= 300) {
              controller = labels[0];
              clearAttempt();
            }
          } else {
            calibrationLabel = "";
            calibrationSince = 0;
          }
        }
        const primary = controllerIndex(labels, controller);
        for (let i = 0; i < mapped.length; i++) {
          ctx.strokeStyle = i === primary ? "#bfead6a0" : "#efd0a850";
          ctx.lineWidth = i === primary ? 2 : 1;
          for (const [a, b] of connections) {
            ctx.beginPath();
            ctx.moveTo(mapped[i][a].x, mapped[i][a].y);
            ctx.lineTo(mapped[i][b].x, mapped[i][b].y);
            ctx.stroke();
          }
        }
        if (primary < 0) {
          lose();
          return;
        }
        const helperOpen = mapped.some(
          (points, i) => i !== primary && openPalm(points),
        );
        if (helperOpen) helperLastSeen = now;
        const helper = now - helperLastSeen < 350;
        if (helper) {
          if (!paused) clearAttempt();
          paused = true;
          const cursor = cursorRef.current?.children[0] as HTMLElement | undefined;
          if (cursor) cursor.style.display = "none";
          publish({ ...idleFeedback, controllerReady: true, helper: true, message: "Paused by your second hand. Lower it to resume." });
          return;
        }
        if (paused) { paused = false; clearAttempt(); }
        if (lastKey !== options.current.interactionKey + options.current.mode) {
          lastKey = options.current.interactionKey + options.current.mode;
          clearAttempt();
        }
        const points = mapped[primary],
          palm = palmPoint(points);
        if (
          lastPalm &&
          Math.hypot(palm.x - lastPalm.x, palm.y - lastPalm.y) >
            Math.min(vw, vh) * 0.15
        ) {
          lose();
          return;
        }
        lastPalm = palm;
        const ratio = pinchRatio(
          landmarks[primary],
          video.videoWidth / video.videoHeight,
        );
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
        const element = document
          .elementFromPoint(pointer.x, pointer.y)
          ?.closest<HTMLElement>("[data-air-square]");
        const target = element
          ? centerTarget(
              element.dataset.airSquare!,
              element.getBoundingClientRect(),
              pointer,
              isHover ? 0.015 : 0.06,
            )
          : null;
        let confirmed: string | null = null;
        let progress = 0;
        let cancelled = false;
        let aim: typeof target = target;
        if (isHover) {
          const hovering = hoverSelect(hover, target, now);
          hover = hovering.state;
          confirmed = hovering.confirmed;
          progress = hovering.progress;
        } else {
          const next = advanceGesture(state, ratio, now);
          state = next.state;
          const stepped = stepDoublePinch(sequence, {
            now, target, palm, edge: next.event, visible: true,
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
        cursor.style.display = "block";
        cursor.style.transform = `translate(${pointer.x}px,${pointer.y}px)`;
        cursor.dataset.pinched = String(!isHover && state.pinched);
        cursor.dataset.progress = String(isHover ? 0 : sequence.count);
        cursor.style.setProperty("--air-progress", `${progress * 360}deg`);
        const stable = Boolean(!isHover && sequence.hover && now - sequence.hoverSince >= 160);
        publish({
          target: aim?.square ?? null,
          count: isHover ? 0 : sequence.count,
          ready: isHover ? Boolean(target) : stable,
          locked: !isHover && Boolean(sequence.locked),
          controllerReady: true, helper: false,
          progress: Math.round(progress * 10) / 10, pinched: !isHover && state.pinched,
          message: confirmed ? `${confirmed} confirmed. Move to your next square.`
            : isHover
              ? target ? hover.blocked === target.square
                ? "Selected. Move to a highlighted destination."
                : `Hold on ${target.square} · ${Math.round(progress * 10) * 10}%`
                : "Point at a piece, then hold for the ring to fill."
              : cancelled ? "Attempt cancelled. Aim and try again."
                : sequence.locked ? `${sequence.locked.square}: ${sequence.count}/2 pinches. Open between pinches.`
                : stable ? `${sequence.hover!.square} ready — pinch twice.`
                : "Point at a piece or highlighted destination, then pinch twice.",
        });
        if (confirmed) {
          clearDwell(); fired = null;
          callback.current({ type: "confirm", square: confirmed });
          return;
        }
        const button =
          document
            .elementFromPoint(pointer.x, pointer.y)
            ?.closest<HTMLElement>("[data-air]") ?? null;
        if (
          (!isHover && (state.pinched || state.candidate || Boolean(sequence.locked))) ||
          !button ||
          button.matches(":disabled")
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
      worker.postMessage({ type: "init", origin: location.origin });
      // Capture each fresh camera frame when the model is ready. Never build a queue.
      const capture = (now: number, mediaTime: number) => {
        if (!ready || inFlight || document.hidden || video.readyState < 2 || mediaTime === lastVideo) return;
        lastVideo = mediaTime;
        inFlight = true;
        frameSentAt = now;
        createImageBitmap(video)
          .then((bitmap) => {
            if (r.generation !== generation) { bitmap.close(); return; }
            worker.postMessage({ type: "frame", bitmap, timestamp: now }, [bitmap]);
          })
          .catch(() => { inFlight = false; frameSentAt = 0; fail("Camera frames could not be read. Restart the camera."); });
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
        if (lastSeen && now - lastSeen > 750) { lose(); lastSeen = 0; }
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
    status,
    error,
    fps,
    latency,
    handCount,
    feedback,
  };
}
