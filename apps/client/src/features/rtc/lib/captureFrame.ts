/**
 * Captures the current frame from a live MediaStream as a JPEG File.
 *
 * Creates a temporary offscreen <video> element, draws the current frame
 * to a <canvas>, and exports it as a JPEG blob. The original stream is
 * not affected (MediaStream reference is shared, not cloned).
 */
export async function captureFrameFromStream(
  stream: MediaStream,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.pause();
      video.srcObject = null;
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Frame capture timed out"));
    }, 5000);

    video.onloadeddata = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error("Failed to capture frame"));
              return;
            }
            const file = new File([blob], `frame-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            resolve(file);
          },
          "image/jpeg",
          0.85,
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Failed to load video stream for capture"));
    };

    video.play().catch((err) => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error(`Failed to play video for capture: ${err.message}`));
    });
  });
}
