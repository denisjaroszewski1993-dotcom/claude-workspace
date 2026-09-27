import type { Recognition } from "../types";

// KI-Erkennung direkt im Browser mit TensorFlow.js:
// - MobileNet v2 erkennt das Hauptmotiv (1000 Klassen, z. B. Küste, Pizza, Kirche)
// - COCO-SSD findet einzelne Objekte (Personen, Hunde, Autos, Tassen …)
// Die Modelle liegen neben der App (public/models) – es verlässt kein Bild das Gerät.

type TF = typeof import("@tensorflow/tfjs-core");
type MobileNet = import("@tensorflow-models/mobilenet").MobileNet;
type CocoSsd = import("@tensorflow-models/coco-ssd").ObjectDetection;

interface Models {
  tf: TF;
  mobilenet: MobileNet;
  detector: CocoSsd;
  classes: Record<number, string>;
  backend: string;
}

let loading: Promise<Models> | undefined;

function modelUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}models/${path}`, document.baseURI).href;
}

export function loadModels(): Promise<Models> {
  loading ??= (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-webgl");
    await import("@tensorflow/tfjs-backend-cpu");
    let backend = "webgl";
    try {
      if (!(await tf.setBackend("webgl"))) throw new Error("kein WebGL");
    } catch {
      backend = "cpu";
      await tf.setBackend("cpu");
    }
    await tf.ready();
    const [mobilenetLib, cocoLib, classesLib] = await Promise.all([
      import("@tensorflow-models/mobilenet"),
      import("@tensorflow-models/coco-ssd"),
      import("@tensorflow-models/mobilenet/dist/imagenet_classes"),
    ]);
    const [mobilenet, detector] = await Promise.all([
      mobilenetLib.load({ version: 2, alpha: 1.0, modelUrl: modelUrl("mobilenet/model.json"), inputRange: [0, 1] }),
      cocoLib.load({ base: "lite_mobilenet_v2", modelUrl: modelUrl("coco-ssd/model.json") }),
    ]);
    return { tf, mobilenet, detector, classes: classesLib.IMAGENET_CLASSES, backend };
  })();
  loading.catch(() => {
    loading = undefined; // später erneut versuchen dürfen
  });
  return loading;
}

export async function recognize(canvas: HTMLCanvasElement): Promise<Recognition> {
  const { tf, mobilenet, detector, classes } = await loadModels();

  const { values, indices } = tf.tidy(() => {
    const logits = mobilenet.infer(canvas) as import("@tensorflow/tfjs-core").Tensor2D;
    return tf.topk(tf.softmax(logits), 5);
  });
  const [probs, idx] = await Promise.all([values.data(), indices.data()]);
  values.dispose();
  indices.dispose();
  const labels = Array.from(idx).map((index, i) => ({ index, name: classes[index] ?? `#${index}`, prob: probs[i] }));

  const area = canvas.width * canvas.height;
  const detections = await detector.detect(canvas, 20, 0.35);
  const objects = detections.map((d) => ({
    name: d.class,
    score: Math.round(d.score * 1000) / 1000,
    area: Math.round(((d.bbox[2] * d.bbox[3]) / area) * 1000) / 1000,
  }));

  return { labels, objects };
}
