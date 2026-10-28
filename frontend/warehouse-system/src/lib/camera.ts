// Shared camera stream management to guarantee complete hardware release
export const activeMediaStreams = new Set<MediaStream>();

export function registerCameraStream(stream: MediaStream): void {
  activeMediaStreams.add(stream);
}

export function unregisterCameraStream(stream: MediaStream): void {
  activeMediaStreams.delete(stream);
}

export function stopAllCameraStreams(): void {
  activeMediaStreams.forEach((stream) => {
    try {
      stream.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
    } catch {}
  });
  activeMediaStreams.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    stopAllCameraStreams();
  });
}
