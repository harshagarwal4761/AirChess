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
import {
  matchHands,
  reachablePoint,
  type HandId,
  type Observation,
} from "../lib/air-controls";
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
  handId: HandId;
  x: number;
  y: number;
};
export function useHandTracking(
  onEvent: (event: AirEvent) => void,
  reachAssist = true,
) {
  const reachRef = useRef(reachAssist);
  reachRef.current = reachAssist;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "off" | "loading" | "searching" | "tracking" | "error"
  >("off");
  const [error, setError] = useState("");
  const [fps, setFps] = useState(0);
  const [handCount, setHandCount] = useState(0);
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
    cursorRef.current
      ?.querySelectorAll<HTMLElement>(".air-cursor")
      .forEach((cursor) => (cursor.style.display = "none"));
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    document
      .querySelectorAll(".air-dwell")
      .forEach((e) => e.classList.remove("air-dwell"));
    for (const handId of [0, 1] as const)
      callback.current({ type: "cancel", handId, x: 0, y: 0 });
    setStatus("off");
    setFps(0);
    setHandCount(0);
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
        numHands: 2,
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
      const freshTrack = () => ({
        state: initialGesture(),
        observation: null as Observation | null,
        lastSeen: 0,
        smooth: null as Point | null,
        dwell: null as HTMLElement | null,
        dwellSince: 0,
        fired: null as HTMLElement | null,
      });
      const tracks = [freshTrack(), freshTrack()];
      let lastTime = -1,
        lastInference = 0,
        count = 0,
        fpsSince = performance.now(),
        lastCount = -1;
      const clickedAt = new WeakMap<HTMLElement, number>();
      const resetTrack = (handId: HandId) => {
        callback.current({ type: "cancel", handId, x: 0, y: 0 });
        tracks[handId] = freshTrack();
      };
      const tick = (now: number) => {
        if (r.generation !== generation) return;
        r.frame = requestAnimationFrame(tick);
        if (now - lastInference < 40) return;
        // A stalled video or background tab must never retain a pickup.
        if (
          document.hidden ||
          video.readyState < 2 ||
          video.currentTime === lastTime
        ) {
          if (now - lastInference > 180) {
            for (const handId of [0, 1] as const) {
              resetTrack(handId);
            }
            cursorRef.current
              ?.querySelectorAll<HTMLElement>(".air-cursor")
              .forEach((c) => (c.style.display = "none"));
            document
              .querySelectorAll(".air-dwell")
              .forEach((e) => e.classList.remove("air-dwell"));
          }
          return;
        }
        lastInference = now;
        lastTime = video.currentTime;
        try {
          const result = model.detectForVideo(video, now);
          const canvas = canvasRef.current!,
            context = canvas.getContext("2d")!;
          if (canvas.width !== innerWidth) canvas.width = innerWidth;
          if (canvas.height !== innerHeight) canvas.height = innerHeight;
          context.clearRect(0, 0, canvas.width, canvas.height);
          for (const id of [0, 1] as const)
            if (tracks[id].observation && now - tracks[id].lastSeen > 180)
              resetTrack(id);
          const observations = result.landmarks.map((points, i) => ({
            wrist: points[0],
            label: result.handedness[i]?.[0]?.categoryName ?? "",
          }));
          const matches = matchHands(
            tracks.map((t) => t.observation),
            observations,
          );
          if (observations.length && matches.every((index) => index === null)) {
            resetTrack(0);
            resetTrack(1);
          }
          const trackedCount = matches.filter((index) => index !== null).length;
          if (trackedCount !== lastCount) {
            lastCount = trackedCount;
            setHandCount(trackedCount);
            setStatus(trackedCount ? "tracking" : "searching");
          }
          let didActivate = false;
          for (const handId of [0, 1] as const) {
            if (r.generation !== generation) return;
            const index = matches[handId];
            const cursor = cursorRef.current!.children[handId] as HTMLElement;
            if (index === null) {
              cursor.style.display = "none";
              tracks[handId].dwell = null;
              tracks[handId].fired = null;
              continue;
            }
            const observation = observations[index];
            const prev = tracks[handId].observation;
            if (
              prev &&
              Math.hypot(
                prev.wrist.x - observation.wrist.x,
                prev.wrist.y - observation.wrist.y,
              ) > 0.35
            )
              resetTrack(handId);
            const track = tracks[handId],
              landmarks = result.landmarks[index];
            track.observation = observation;
            track.lastSeen = now;
            const mapped = landmarks.map((p) =>
              projectPoint(
                p,
                { width: video.videoWidth, height: video.videoHeight },
                { width: canvas.width, height: canvas.height },
              ),
            );
            const color = handId === 0 ? "#bfead6" : "#efd0a8";
            context.strokeStyle = color + "90";
            context.lineWidth = 2;
            for (const [a, b] of connections) {
              context.beginPath();
              context.moveTo(mapped[a].x, mapped[a].y);
              context.lineTo(mapped[b].x, mapped[b].y);
              context.stroke();
            }
            context.fillStyle = color;
            for (const p of mapped) {
              context.beginPath();
              context.arc(p.x, p.y, 3, 0, Math.PI * 2);
              context.fill();
            }
            const target = reachRef.current
              ? reachablePoint(mapped[8], {
                  width: canvas.width,
                  height: canvas.height,
                })
              : mapped[8];
            track.smooth = track.smooth
              ? {
                  x: track.smooth.x + (target.x - track.smooth.x) * 0.4,
                  y: track.smooth.y + (target.y - track.smooth.y) * 0.4,
                }
              : target;
            const pointer = track.smooth;
            cursor.style.display = "block";
            cursor.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
            const next = advanceGesture(
              track.state,
              pinchRatio(landmarks),
              now,
            );
            track.state = next.state;
            cursor.dataset.pinched = String(track.state.pinched);
            if (next.event)
              callback.current({ type: next.event, handId, ...pointer });
            const element =
              document
                .elementFromPoint(pointer.x, pointer.y)
                ?.closest<HTMLElement>("[data-air]") ?? null;
            // Suppress menus while either hand is carrying a piece.
            if (
              tracks.some((t) => t.state.pinched) ||
              !track.state.armed ||
              !element ||
              element.matches(":disabled")
            ) {
              track.dwell = null;
              if (!element) track.fired = null;
            } else if (element !== track.dwell) {
              track.dwell = element;
              track.dwellSince = now;
              if (track.fired !== element) track.fired = null;
            } else if (
              !didActivate &&
              now - track.dwellSince > 1300 &&
              track.fired !== element &&
              now - (clickedAt.get(element) ?? -Infinity) > 1600
            ) {
              track.fired = element;
              track.dwell = null;
              clickedAt.set(element, now);
              didActivate = true;
              element.click();
            }
          }
          const dwelling = new Set(
            tracks
              .filter((t) => t.dwell && t.fired !== t.dwell)
              .map((t) => t.dwell),
          );
          document.querySelectorAll(".air-dwell").forEach((e) => {
            if (!dwelling.has(e as HTMLElement))
              e.classList.remove("air-dwell");
          });
          dwelling.forEach((e) => e?.classList.add("air-dwell"));
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
  return {
    videoRef,
    canvasRef,
    cursorRef,
    start,
    stop,
    status,
    error,
    fps,
    handCount,
  };
}
