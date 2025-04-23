import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
// import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim'
// This doesn't work in ESM, because use-sync-external-store only exposes CJS.
// See: https://github.com/pmndrs/valtio/issues/452
// The following is a workaround until ESM is supported.
import useSyncExternalStoreExports from "use-sync-external-store/shim/index.js";
import { getStoreMock } from "./server-store-mock";
const { useSyncExternalStore } = useSyncExternalStoreExports;

/**
 * Configuration options for useLocalStorageSafe hook
 */
interface Options<T> {
  /** Custom stringify function to serialize values (default: JSON.stringify) */
  stringify?: (value: unknown) => string;
  /** Custom parse function to deserialize values (default: JSON.parse) */
  parse?: (stringValue: string) => T;
  /** Custom logging function (default: console.log) */
  log?: (message: unknown) => void;
  /** Function to validate initial stored value */
  validateInit?: (value: T) => boolean;
  /** Whether to sync with other browser tabs (default: true) */
  sync?: boolean;
  /** Whether to silently handle errors (default: true) */
  silent?: boolean;
}

/**
 * A custom React hook that allows safe access and manipulation of values in local storage.
 * @template T - The type of the state value.
 * @param {string} key - The key under which the state value will be stored in the local storage.
 * @param {T} [defaultValue] - The initial value for the state. If the key does not exist in the local storage, this value will be used as the default.
 * @param {Options<T>} [options] - An object containing additional customization options for the hook.
 * @returns {[T, SetStateAction<T>]} - A tuple with the current state value and a function to update it.
 */
export function useLocalStorageSafe<T>(
  key: string,
  defaultValue: T,
  options?: Options<T>,
): [T, Dispatch<SetStateAction<T>>];

/**
 * A custom React hook that allows safe access and manipulation of values in local storage.
 * @template T - The type of the state value.
 * @param {string} key - The key under which the state value will be stored in the local storage.
 * @param {T} [defaultValue] - The initial value for the state. If the key does not exist in the local storage, this value will be used as the default.
 * @param {Options<T>} [options] - An object containing additional customization options for the hook.
 * @returns {[T | undefined, SetStateAction<T | undefined>]} - A tuple with the current state value and a function to update it.
 */
export function useLocalStorageSafe<T>(
  key: string,
  defaultValue?: T,
  options?: Options<T>,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>];

export function useLocalStorageSafe<T>(
  key: string,
  defaultValue?: T,
  options?: Options<T>,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
  const store = useMemo(
    () =>
      typeof window === "undefined"
        ? getStoreMock()
        : new ExternalStore<T>(key, defaultValue, options),
    [key, defaultValue, options],
  );

  const storageValue = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener, key), [store, key]),
    useCallback(() => store.getSnapshot(key), [store, key]),
    useCallback(() => defaultValue, [defaultValue]),
  );

  return [
    storageValue,
    useCallback(
      (value: SetStateAction<T | undefined>) => store.setItem(key, value),
      [key, store],
    ),
  ];
}

export class ExternalStore<T> {
  public static readonly listeners: Map<string, Set<VoidFunction>> = new Map();
  public static readonly inMemory: Map<string, unknown> = new Map();
  public static readonly validatedKeys: Set<string> = new Set();

  private readonly stringify: (value: unknown) => string = JSON.stringify;
  private readonly parse: (stringValue: string) => T = JSON.parse;
  private readonly log: (message: unknown) => void = console.log;
  private readonly sync: boolean = true;
  private readonly silent: boolean = true;

  public constructor(key: string, defaultValue?: T, options?: Options<T>) {
    if (options?.log) this.log = options.log;
    if (options?.parse) this.parse = options.parse;
    if (options?.stringify) this.stringify = options.stringify;
    if (options?.sync === false) this.sync = options.sync;
    if (options?.silent === false) this.silent = options.silent;

    if (!this.canGetStoreValue(key)) {
      this.setItem(key, defaultValue as T);
      return;
    }

    if (
      typeof options?.validateInit !== "function" ||
      ExternalStore.validatedKeys.has(key)
    ) {
      return;
    }

    const storedValue = this.getParseableStorageItem<T>(key) as T;
    const isValid = options.validateInit(storedValue);

    if (!isValid && defaultValue !== undefined) {
      this.setStorageItem<T>(key, defaultValue);
    } else if (!isValid) {
      localStorage.removeItem(key);
    }

    ExternalStore.validatedKeys.add(key);
  }

  public setItem(key: string, valueOrFunction: SetStateAction<T | undefined>) {
    const value = isFunction<T | undefined>(valueOrFunction)
      ? valueOrFunction(this.getSnapshot(key))
      : valueOrFunction;

    this.setStorageItem(key, value);
    ExternalStore.inMemory.set(key, value);
    this.notifyListeners(key);
  }

  public getSnapshot(key: string): T | undefined {
    if (!ExternalStore.inMemory.has(key)) {
      const storedValue = this.getParseableStorageItem<T>(key);
      ExternalStore.inMemory.set(key, storedValue);
      return storedValue as T | undefined;
    }

    return ExternalStore.inMemory.get(key) as T | undefined;
  }

  /**
   * Subscribe to changes for a specific key in localStorage
   * @param listener Function to call when the value changes
   * @param key Storage key to listen for changes
   * @returns Unsubscribe function
   */
  public subscribe(listener: () => void, key: string) {
    // Handle changes from other browser tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === localStorage && event.key === key) {
        ExternalStore.inMemory.set(key, this.getParseableStorageItem(key));
        this.notifyListeners(key);
      }
    };

    // Register the listener
    if (ExternalStore.listeners.has(key)) {
      ExternalStore.listeners.get(key)!.add(listener);
    } else {
      ExternalStore.listeners.set(key, new Set([listener]));
    }

    // Add storage event listener if sync is enabled
    if (this.sync) {
      window.addEventListener("storage", handleStorageChange);
    }

    // Return unsubscribe function
    return () => {
      window.removeEventListener("storage", handleStorageChange);

      if (ExternalStore.listeners.has(key)) {
        ExternalStore.listeners.get(key)!.delete(listener);
      }
    };
  }

  /**
   * Notify all registered listeners for a specific key
   * @param key The storage key whose listeners should be notified
   */
  private notifyListeners(key: string) {
    const listeners = ExternalStore.listeners.get(key);
    if (!listeners || listeners.size === 0) return;

    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        this.log(`Error in listener for key ${key}: ${error}`);
      }
    }
  }

  /**
   * Safely set an item in localStorage
   * @param key The key to store the value under
   * @param value The value to store
   * @returns void
   */
  private setStorageItem<T>(key: string, value: T | undefined): void {
    try {
      localStorage.setItem(key, this.stringify(value));
    } catch (error) {
      this.log(error);
      if (!this.silent) throw error;
    }
  }

  private getParseableStorageItem<T>(key: string): T | null | undefined {
    let value = null;

    try {
      value = localStorage.getItem(key);
    } catch (error) {
      this.log(error);
      if (!this.silent) throw error;
      return undefined;
    }

    if (value === null || value === "undefined") return undefined;

    try {
      return this.parse(value) as unknown as T;
    } catch (error) {
      this.log(error);
      localStorage.removeItem(key);
      return null;
    }
  }

  private canGetStoreValue(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      this.log(error);
      if (!this.silent) throw error;
      return false;
    }
  }
}

function isFunction<T>(
  valueOrFunction: unknown,
): valueOrFunction is (value: T) => T {
  return typeof valueOrFunction === "function";
}
