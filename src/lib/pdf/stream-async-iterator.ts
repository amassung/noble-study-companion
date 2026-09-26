/**
 * Let `for await (… of stream)` work in Safari.
 *
 * pdf.js reads page text with `for await (const value of readableStream)`.
 * Async iteration over a ReadableStream is standard and implemented in Chrome
 * and Firefox, but not in Safari — so on iPad the loop finds no
 * Symbol.asyncIterator and throws "undefined is not a function", which is how
 * importing any PDF failed on device while working in every browser used to
 * develop it.
 *
 * Patching the prototype rather than avoiding the call is deliberate: pdf.js
 * iterates streams in more than one place, and a fix that only covered the
 * text path would leave the next one to be discovered by a student.
 *
 * Safe to call repeatedly, and a no-op wherever the browser already has it.
 */
export function ensureStreamAsyncIterator(): void {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: unknown;
  };
  if (typeof proto[Symbol.asyncIterator] === "function") return;

  Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: function <T>(this: ReadableStream<T>) {
      const reader = this.getReader();
      return {
        next: () => reader.read(),
        // Called when the loop is left early — by a break, a return, or a
        // throw. Releasing the reader here is what stops an abandoned parse
        // holding the stream open.
        return: async (value?: unknown) => {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
          return { done: true as const, value };
        },
        throw: async (err?: unknown) => {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
          throw err;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },
  });
}
