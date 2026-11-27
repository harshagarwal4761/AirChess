import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

type DelegateChoice = "GPU" | "CPU";

let model: HandLandmarker | undefined;
let visionFiles: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | undefined;
let workerOrigin = "";
let activeDelegate: DelegateChoice = "GPU";
let currentNumHands = 1;

async function initModel(preferred: "auto" | DelegateChoice, numHands: number) {
  if (!visionFiles) {
    visionFiles = await FilesetResolver.forVisionTasks(`${workerOrigin}/mediapipe/wasm`);
  }
  model?.close?.();
  model = undefined;
  currentNumHands = numHands === 2 ? 2 : 1;

  const baseOptions = {
    modelAssetPath: `${workerOrigin}/models/hand_landmarker.task`,
  };
  const shared = {
    runningMode: "VIDEO" as const,
    numHands: currentNumHands,
    minHandDetectionConfidence: 0.52,
    minHandPresenceConfidence: 0.42,
    minTrackingConfidence: 0.38,
  };

  if (preferred === "CPU") {
    activeDelegate = "CPU";
    model = await HandLandmarker.createFromOptions(visionFiles, {
      ...shared,
      baseOptions: { ...baseOptions, delegate: "CPU" },
    });
    return;
  }

  try {
    activeDelegate = "GPU";
    model = await HandLandmarker.createFromOptions(visionFiles, {
      ...shared,
      baseOptions: { ...baseOptions, delegate: "GPU" },
    });
  } catch {
    activeDelegate = "CPU";
    model = await HandLandmarker.createFromOptions(visionFiles, {
      ...shared,
      baseOptions: { ...baseOptions, delegate: "CPU" },
    });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  try {
    if (data.type === "init") {
      workerOrigin = String(data.origin ?? "");
      await initModel(
        data.delegate === "CPU" || data.delegate === "GPU" ? data.delegate : "auto",
        data.numHands === 2 ? 2 : 1,
      );
      self.postMessage({ type: "ready", delegate: activeDelegate });
    } else if (data.type === "switch-delegate") {
      const target: DelegateChoice = data.delegate === "CPU" ? "CPU" : "GPU";
      if (target !== activeDelegate || !model) {
        await initModel(target, data.numHands === 2 ? 2 : currentNumHands);
      }
      self.postMessage({ type: "delegate-switched", delegate: activeDelegate });
    } else if (data.type === "config") {
      currentNumHands = data.numHands === 2 ? 2 : 1;
      if (model) {
        await model.setOptions({ numHands: currentNumHands });
      }
    } else if (data.type === "frame") {
      try {
        if (!model) throw new Error("Hand model is not ready.");
        const t0 = performance.now();
        const result = model.detectForVideo(data.bitmap, data.timestamp);
        const inferenceMs = performance.now() - t0;
        self.postMessage({
          type: "result",
          landmarks: result.landmarks,
          handedness: result.handedness,
          timestamp: data.timestamp,
          inferenceMs,
        });
      } finally {
        data.bitmap.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Hand tracking failed.",
    });
  }
};
