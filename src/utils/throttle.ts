/**
 * Creates a throttled version of an asynchronous function that ensures the function
 * is only called once within the specified time window, even if it is invoked
 * multiple times during that period. The function returns the same promise for
 * all calls made within the time window.
 *
 * @template T - A function type that returns a Promise.
 * @template A - A tuple type representing the arguments of the function `func`.
 * @template R - The type of the value that the promise resolves to.
 *
 * @param {T} func - The asynchronous function to throttle. This function must return a Promise.
 * @param {number} wait - The time window in milliseconds within which subsequent calls to `func`
 *                        will be throttled.
 *
 * @returns {(...args: A) => Promise<R>} - A new function that, when called, will return a
 *                                         promise which resolves with the value returned by
 *                                         `func`, ensuring that `func` is not called more than
 *                                         once in the specified time window.
 *
 * @example
 * const myAsyncFunction = async (arg: string) => {
 *   console.log(`Function called with ${arg}`);
 *   return `Result for ${arg}`;
 * };
 *
 * const throttledFunction = throttleAsync(myAsyncFunction, 1000);
 *
 * throttledFunction("test1").then(console.log); // Immediately calls myAsyncFunction
 * throttledFunction("test2").then(console.log); // Throttles call, waits for 1 second
 */
export function throttleAsync<T extends (...args: A) => Promise<R>, A extends unknown[], R>(
  func: T,
  wait: number
): (...args: A) => Promise<R> {
  let timerId: number | undefined;
  let lastArgs: A | undefined;
  let promise: Promise<R> | undefined;

  const execute = async () => {
    if (lastArgs) {
      promise = func(...lastArgs);
      lastArgs = undefined;
    }
    timerId = undefined;
  };

  return async (...args: A): Promise<R> => {
    lastArgs = args;

    if (!timerId) {
      promise = func(...args);
      timerId = window.setTimeout(execute, wait);
    }

    if (promise) {
      return promise;
    } else {
      // Handle the case where the promise is undefined
      throw new Error("Promise is undefined.");
    }
  };
}
