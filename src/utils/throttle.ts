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
