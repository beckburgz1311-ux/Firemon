(() => {
  "use strict";

  if (!window.pako || !window.TransformStream) {
    throw new Error("Firemon compatibility layer could not load.");
  }

  const nativeAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    window.__firemonStarted = true;
    return nativeAnimationFrame(callback);
  };

  class FiremonDecompressionStream {
    constructor(format) {
      if (format !== "gzip") throw new TypeError("Only gzip is supported.");
      const chunks = [];
      const stream = new TransformStream({
        transform(chunk) {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
        },
        flush(controller) {
          const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
          const input = new Uint8Array(length);
          let offset = 0;
          for (const chunk of chunks) {
            input.set(chunk, offset);
            offset += chunk.length;
          }
          controller.enqueue(window.pako.ungzip(input));
        }
      });
      this.readable = stream.readable;
      this.writable = stream.writable;
    }
  }

  window.DecompressionStream = FiremonDecompressionStream;
})();
