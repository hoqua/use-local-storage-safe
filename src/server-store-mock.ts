/**
 * A void function that does nothing - useful for mock implementations
 */
const voidFunction = () => void 0;

/**
 * Returns a mock implementation of the storage functions for server-side rendering
 * where localStorage is not available.
 * @returns An object with stubbed storage methods
 */
export const getStoreMock = () => ({
  subscribe: () => voidFunction,
  getSnapshot: voidFunction,
  setItem: voidFunction,
});
