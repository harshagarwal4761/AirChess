"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceGesture,
  initialGesture,
  pinchRatio,
  projectPoint,
  type Point,
} from "../lib/gestures";
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
  message: string;
};
const idleFeedback: Feedback = {
  target: null,
  count: 0,
  ready: false,
  locked: false,
  controllerReady: false,
  helper: false,
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
) {
  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null),
    cursorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "off" | "loading" | "searching" | "tracking" | "error"
  >("off");
  const [error, setError] = useState(""),
    [fps, setFps] = useState(0),
    [handCount, setHandCount] = useState(0),
    [feedback, setFeedback] = useState<Feedback>(idleFeedback);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const options = useRef({ reachAssist, interactionKey });
  options.current = { reachAssist, interactionKey };
  const resources = useRef<{
    worker?: Worker;
    stream?: MediaStream;
    frame?: number;
    generation: number;
    recalibrate?: () => void;
  }>({ generation: 0 });
  const stop = useCallback(() => {
    const r = resources.current;
    r.generation++;
    if (r.frame) cancelAnimationFrame(r.frame);
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
        smooth: Point | null = null,
        controller: string | null = null;
      let calibrationLabel = "",
        calibrationSince = 0,
        helperSince = 0,
        hadController = false,
        lastPalm: Point | null = null;
      let lastKey = options.current.interactionKey,
        lastSeen = 0,
        lastInference = 0,
        lastVideo = -1,
        inFlight = false,
        ready = false,
        count = 0,
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
        smooth = null;
        lastPalm = null;
        clearDwell();
        fired = null;
        if (cancelSelection) callback.current({ type: "cancel" });
      };
      const lose = () => {
        clearAttempt(hadController);
        hadController = false;
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
      const timeout = setTimeout(() => {
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
        if (document.hidden || performance.now() - data.timestamp > 400) {
          lose();
          return;
        }
        const now = performance.now();
        lastSeen = now;
        const landmarks = data.landmarks as Point[][],
          labels = (data.handedness as { categoryName: string }[][]).map(
            (h) => h[0]?.categoryName ?? "",
          );
        setHandCount(landmarks.length);
        setStatus(landmarks.length ? "tracking" : "searching");
        const canvas = canvasRef.current!,
          ctx = canvas.getContext("2d")!;
        if (canvas.width !== innerWidth) canvas.width = innerWidth;
        if (canvas.height !== innerHeight) canvas.height = innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const mapped = landmarks.map((hand) =>
          hand.map((p) =>
            projectPoint(
              p,
              { width: video.videoWidth, height: video.videoHeight },
              { width: canvas.width, height: canvas.height },
            ),
          ),
        );
        if (!controller) {
          if (
            landmarks.length === 1 &&
            labels[0] &&
            openPalm(mapped[0]) &&
            pinchRatio(landmarks[0], video.videoWidth / video.videoHeight) >
              0.65
          ) {
            if (calibrationLabel !== labels[0]) {
              calibrationLabel = labels[0];
              calibrationSince = now;
            } else if (now - calibrationSince >= 500) {
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
        if (!helperOpen) helperSince = 0;
        else if (!helperSince) helperSince = now;
        const helper = helperOpen && now - helperSince > 250;
        if (lastKey !== options.current.interactionKey) {
          lastKey = options.current.interactionKey;
          clearAttempt();
        }
        hadController = true;
        const points = mapped[primary],
          palm = palmPoint(points);
        if (
          lastPalm &&
          Math.hypot(palm.x - lastPalm.x, palm.y - lastPalm.y) >
            Math.min(canvas.width, canvas.height) * 0.15
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
              width: canvas.width,
              height: canvas.height,
            })
          : points[8];
        // Only steer with fingers open. Pinch curl must not move the aim point.
        if (!smooth) smooth = raw;
        else if (ratio > 0.65 && !sequence.locked) {
          const alpha = 0.3;
          smooth = {
            x: smooth.x + (raw.x - smooth.x) * alpha,
            y: smooth.y + (raw.y - smooth.y) * alpha,
          };
        }
        const pointer = smooth;
        const element = document
          .elementFromPoint(pointer.x, pointer.y)
          ?.closest<HTMLElement>("[data-air-square]");
        const target = element
          ? centerTarget(
              element.dataset.airSquare!,
              element.getBoundingClientRect(),
              pointer,
            )
          : null;
        const next = advanceGesture(state, ratio, now);
        state = next.state;
        const stepped = stepDoublePinch(sequence, {
          now,
          target,
          palm,
          edge: next.event,
          visible: true,
          open: ratio > 0.65 && !state.pinched,
        });
        sequence = stepped.state;
        const display = sequence.locked ?? pointer;
        const cursor = cursorRef.current!.children[0] as HTMLElement;
        cursor.style.display = "block";
        cursor.style.transform = `translate(${display.x}px,${display.y}px)`;
        cursor.dataset.pinched = String(state.pinched);
        cursor.dataset.progress = String(sequence.count);
        const stable = Boolean(
          sequence.hover && now - sequence.hoverSince >= 320,
        );
        publish({
          target: sequence.locked?.square ?? sequence.hover?.square ?? null,
          count: sequence.count,
          ready: stable,
          locked: Boolean(sequence.locked),
          controllerReady: true,
          helper,
          message: stepped.cancelled
            ? "Aim moved — try again."
            : sequence.locked
              ? `${sequence.locked.square}: ${sequence.count}/2 pinches. Keep your hand still.`
              : stable
                ? `${sequence.hover!.square} ready — pinch twice.`
                : "Aim at the center of a piece or highlighted destination.",
        });
        if (stepped.confirmed) {
          clearDwell();
          fired = null;
          callback.current({ type: "confirm", square: stepped.confirmed });
          return;
        }
        const button =
          document
            .elementFromPoint(pointer.x, pointer.y)
            ?.closest<HTMLElement>("[data-air]") ?? null;
        if (
          state.pinched ||
          ratio < 0.65 ||
          sequence.locked ||
          !state.armed ||
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
        count++;
        if (now - fpsSince > 1000) {
          setFps(Math.round((count * 1000) / (now - fpsSince)));
          fpsSince = now;
          count = 0;
        }
      };
      worker.postMessage({ type: "init", origin: location.origin });
      const tick = (now: number) => {
        if (r.generation !== generation) {
          clearTimeout(timeout);
          return;
        }
        r.frame = requestAnimationFrame(tick);
        if (lastSeen && now - lastSeen > 400) {
          lose();
          lastSeen = 0;
        }
        if (
          !ready ||
          inFlight ||
          document.hidden ||
          video.readyState < 2 ||
          video.currentTime === lastVideo ||
          now - lastInference < 50
        )
          return;
        lastVideo = video.currentTime;
        lastInference = now;
        inFlight = true;
        createImageBitmap(video)
          .then((bitmap) => {
            if (r.generation !== generation) {
              bitmap.close();
              return;
            }
            worker.postMessage({ type: "frame", bitmap, timestamp: now }, [
              bitmap,
            ]);
          })
          .catch(() => {
            inFlight = false;
            fail("Camera frames could not be read. Restart the camera.");
          });
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
    handCount,
    feedback,
  };
}
