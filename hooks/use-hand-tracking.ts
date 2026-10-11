"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import {
  advanceGesture,
  initialGesture,
  pinchRatio,
  projectPoint,
  type Point,
} from "../lib/gestures";
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
export type AirEvent = {
  type: "grab" | "release" | "cancel";
  x: number;
  y: number;
};
export function useHandTracking(onEvent: (event: AirEvent) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "off" | "loading" | "searching" | "tracking" | "error"
  >("off");
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const resources = useRef<{
    model?: HandLandmarker;
    stream?: MediaStream;
    frame?: number;
    generation: number;
  }>({ generation: 0 });
  const stop = useCallback(() => {
    const r = resources.current;
    r.generation++;
    if (r.frame) cancelAnimationFrame(r.frame);
    r.stream?.getTracks().forEach((t) => t.stop());
    r.model?.close();
    r.model = undefined;
    r.stream = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (cursorRef.current) cursorRef.current.style.display = "none";
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    document
      .querySelectorAll(".air-dwell")
      .forEach((e) => e.classList.remove("air-dwell"));
    callback.current({ type: "cancel", x: 0, y: 0 });
    setStatus("off");
    setFps(0);
  }, []);
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  const start = useCallback(async () => {
    stop();
    const r = resources.current;
    const generation = r.generation;
    setStatus("loading");
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera access needs HTTPS or localhost. Open a secure link in your browser.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
      const { FilesetResolver, HandLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const options = {
        baseOptions: { modelAssetPath: "/models/hand_landmarker.task" },
        runningMode: "VIDEO" as const,
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.65,
      };
      let model: HandLandmarker;
      try {
        model = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        model = await HandLandmarker.createFromOptions(vision, options);
      }
      if (r.generation !== generation) {
        model.close();
        return;
      }
      r.model = model;
      let state = initialGesture(),
        lastTime = -1,
        lastInference = 0,
        lastSeen = 0,
        smooth: Point | null = null;
      let dwell: HTMLElement | null = null,
        dwellSince = 0,
        fired: HTMLElement | null = null,
        lastStatus = "",
        count = 0,
        fpsSince = performance.now();
      const clearDwell = () => {
        dwell?.classList.remove("air-dwell");
        dwell = null;
      };
      const tick = (now: number) => {
        if (r.generation !== generation) return;
        r.frame = requestAnimationFrame(tick);
        if (
          now - lastInference < 40 ||
          video.currentTime === lastTime ||
          video.readyState < 2
        )
          return;
        lastInference = now;
        lastTime = video.currentTime;
        try {
          const result = model.detectForVideo(video, now);
          const landmarks = document.hidden ? undefined : result.landmarks[0];
          const canvas = canvasRef.current!,
            context = canvas.getContext("2d")!;
          if (canvas.width !== window.innerWidth)
            canvas.width = window.innerWidth;
          if (canvas.height !== window.innerHeight)
            canvas.height = window.innerHeight;
          context.clearRect(0, 0, canvas.width, canvas.height);
          const cursor = cursorRef.current!;
          if (!landmarks) {
            clearDwell();
            fired = null;
            cursor.style.display = "none";
            if (now - lastSeen > 180) {
              const next = advanceGesture(state, null, now);
              state = next.state;
              smooth = null;
              callback.current({ type: "cancel", x: 0, y: 0 });
            }
            if (lastStatus !== "searching") {
              setStatus("searching");
              lastStatus = "searching";
            }
            return;
          }
          lastSeen = now;
          if (lastStatus !== "tracking") {
            setStatus("tracking");
            lastStatus = "tracking";
          }
          const mapped = landmarks.map((p) =>
            projectPoint(
              p,
              { width: video.videoWidth, height: video.videoHeight },
              { width: canvas.width, height: canvas.height },
            ),
          );
          context.strokeStyle = "#b9ead480";
          context.lineWidth = 2;
          for (const [a, b] of connections) {
            context.beginPath();
            context.moveTo(mapped[a].x, mapped[a].y);
            context.lineTo(mapped[b].x, mapped[b].y);
            context.stroke();
          }
          context.fillStyle = "#d4f6e5";
          for (const p of mapped) {
            context.beginPath();
            context.arc(p.x, p.y, 3, 0, Math.PI * 2);
            context.fill();
          }
          const target = mapped[8];
          smooth = smooth
            ? {
                x: smooth.x + (target.x - smooth.x) * 0.4,
                y: smooth.y + (target.y - smooth.y) * 0.4,
              }
            : target;
          cursor.style.display = "block";
          cursor.style.transform = `translate(${smooth.x}px, ${smooth.y}px)`;
          const next = advanceGesture(state, pinchRatio(landmarks), now);
          state = next.state;
          cursor.dataset.pinched = String(state.pinched);
          if (next.event) callback.current({ type: next.event, ...smooth });
          const element =
            document
              .elementFromPoint(smooth.x, smooth.y)
              ?.closest<HTMLElement>("[data-air]") ?? null;
          if (state.pinched || !state.armed || !element || element.matches(":disabled")) {
            clearDwell();
            if (!element) fired = null;
          } else if (element !== dwell) {
            clearDwell();
            dwell = element;
            dwellSince = now;
            if (fired !== element) {
              fired = null;
              element.classList.add("air-dwell");
            }
          } else if (now - dwellSince > 1300 && fired !== element) {
            fired = element;
            clearDwell();
            element.click();
          }
          count++;
          if (now - fpsSince > 1000) {
            setFps(Math.round((count * 1000) / (now - fpsSince)));
            fpsSince = now;
            count = 0;
          }
        } catch (e) {
          stop();
          setStatus("error");
          setError(
            e instanceof Error
              ? e.message
              : "Tracking stopped. Try restarting the camera.",
          );
        }
      };
      setStatus("searching");
      r.frame = requestAnimationFrame(tick);
    } catch (e) {
      if (r.generation !== generation) return;
      stop();
      setStatus("error");
      const name = e instanceof Error ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser, then try again."
          : name === "NotFoundError"
            ? "No camera was found. Connect a webcam, or explore using your mouse."
            : name === "NotReadableError"
              ? "Your camera is busy. Close other apps using it and try again."
              : e instanceof Error
                ? e.message
                : "Could not start the camera.",
      );
    }
  }, [stop]);
  return { videoRef, canvasRef, cursorRef, start, stop, status, error, fps };
}
