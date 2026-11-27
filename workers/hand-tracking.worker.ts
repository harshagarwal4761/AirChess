import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let model: HandLandmarker | undefined;
self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        `${data.origin}/mediapipe/wasm`,
      );
      const options = {
        baseOptions: {
          modelAssetPath: `${data.origin}/models/hand_landmarker.task`,
        },
        runningMode: "VIDEO" as const,
        numHands: data.numHands === 2 ? 2 : 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      };
      let delegate: "GPU" | "CPU" = "GPU";
      try {
        model = await HandLandmarker.createFromOptions(files, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "GPU" },
        });
      } catch {
        delegate = "CPU";
        model = await HandLandmarker.createFromOptions(files, options);
      }
      self.postMessage({ type: "ready", delegate });
    } else if (data.type === "config") {
      if (model) {
        await model.setOptions({ numHands: data.numHands === 2 ? 2 : 1 });
      }
    } else if (data.type === "frame") {
      try {
        if (!model) throw new Error("Hand model is not ready.");
        const result = model.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({
          type: "result",
          landmarks: result.landmarks,
          handedness: result.handedness,
          timestamp: data.timestamp,
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
