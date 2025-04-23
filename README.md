# use-local-storage-safe

[![License](https://img.shields.io/npm/l/use-local-storage-safe)](https://github.com/hoqua/use-local-storage-safe/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/use-local-storage-safe)](https://www.npmjs.com/package/use-local-storage-safe)
[![bundle size](https://img.shields.io/bundlephobia/minzip/use-local-storage-safe)](https://bundlephobia.com/package/use-local-storage-safe)
[![build](https://img.shields.io/github/actions/workflow/status/hoqua/use-local-storage-safe/main.yml?branch=main)](https://github.com/hoqua/use-local-storage-safe/actions/workflows/main.yml)
[![coverage branches](https://raw.githubusercontent.com/hoqua/use-local-storage-safe/main/coverage/badge-branches.svg)](https://github.com/hoqua/use-local-storage-safe)
[![coverage functions](https://raw.githubusercontent.com/hoqua/use-local-storage-safe/main/coverage/badge-functions.svg)](https://github.com/hoqua/use-local-storage-safe)
[![coverage lines](https://raw.githubusercontent.com/hoqua/use-local-storage-safe/main/coverage/badge-lines.svg)](https://github.com/hoqua/use-local-storage-safe)
[![coverage statements](https://raw.githubusercontent.com/hoqua/use-local-storage-safe/main/coverage/badge-statements.svg)](https://github.com/hoqua/use-local-storage-safe)

**Safely persist React state to LocalStorage with SSR compatibility, cross-tab synchronization, and data validation.**

`use-local-storage-safe` is a React hook designed to reliably manage state persistence in LocalStorage. It addresses common requirements such as maintaining state across sessions, ensuring data consistency between browser tabs via synchronization, handling potentially invalid stored data through validation, and supporting server-side rendering, all through a familiar `useState`-like interface.

## Key Features

-   **🛡️ Safe & Validated:** Automatically validates stored data on initialization using your custom logic, preventing crashes from invalid or legacy data.
-   **🔄 Cross-Tab Sync:** Effortlessly synchronizes state across multiple browser tabs or windows using the native StorageEvent API (can be disabled).
-   **✅ SSR Compatible:** Works seamlessly with server-side rendering frameworks (Next.js, Astro, Remix, etc.) by safely returning the default value on the server.
-   **✍️ TypeScript Native:** Written in TypeScript with full type safety for keys and values.
-   **🔧 Customizable:** Provides options for custom serialization (`stringify`), deserialization (`parse`), error logging (`log`), and error suppression (`silent`).
-   **🚀 Lightweight:** Minimal footprint with zero dependencies besides React itself.
-   **⭐ Simple API:** Designed to be a drop-in replacement for `useState` for persistent state.

## Installation

```bash
npm i use-local-storage-safe        # npm
```
```bash
yarn add use-local-storage-safe     # yarn
```
```bash
pnpm i use-local-storage-safe       # pnpm
```

## Why use this hook?

-   **Reliable Persistence:** Simple `useState`-like interface for data that survives page reloads.
-   **Data Integrity:** Protect your application from unexpected errors caused by malformed data in `localStorage` using the `validateInit` option.
-   **Seamless User Experience:** Keep the UI consistent across all open tabs with the built-in `sync` feature.
-   **Universal Compatibility:** Works flawlessly in both client-side and server-side rendered React applications (React `>=16.8.0`).
-   **Modern Tooling:** Supports both ESM (ECMAScript modules) and CJS (CommonJS) formats.

## Usage

#### Basic

```tsx
import { useLocalStorageSafe } from 'use-local-storage-safe'

export default function NameComponent() {
    const [userName, setUserName] = useLocalStorageSafe('name-storage-key', 'default-name')
}
```

#### Advanced

```tsx
import { useLocalStorageSafe } from 'use-local-storage-safe'
// data could be validated with plain JS or any other library
import { z } from "zod";

const User = z.object({
    firstName: z.string().min(1).max(18),
    lastName: z.string().min(1).max(18),
    email: z.string().email(),
});

type User = z.infer<typeof User>

export default function UserComponent() {
    const [user, setUser] = useLocalStorageSafe<User>(
        "user-storage-key",
        {
            firstName: "example name",
            lastName: "example last name",
            email: "example@email.com",
        },
        // Options object
        {
            // Validate stored data on hook initialization using a Zod schema
            validateInit: (value) => User.safeParse(value).success,
            // Optional: Custom logger (defaults to console.log)
            // log: (message) => console.warn('LocalStorage:', message),
            // Optional: Disable cross-tab sync (defaults to true)
            // sync: false,
            // Optional: Throw errors instead of logging them silently (defaults to true)
            // silent: false,
            // Optional: Custom serialization (e.g., for Map, Set, Date)
            // stringify: (value) => SuperJSON.stringify(value),
            // parse: (storedValue) => SuperJSON.parse(storedValue),
        }
    );

    return (
        <div>
            <p>First Name: {user.firstName}</p>
            <p>Last Name: {user.lastName}</p>
            <p>Email: {user.email}</p>

            <button
                onClick={() =>
                    setUser({ firstName: "U", lastName: "Nu", email: "u@mail.com" })
                }
            >
                Set User
            </button>
        </div>
    );
}
```

## API

**Overloads:**

```typescript
// When defaultValue is provided, T is guaranteed
function useLocalStorageSafe<T>(
  key: string,
  defaultValue: T,
  options?: Options<T>
): [T, Dispatch<SetStateAction<T>>];

// When defaultValue is potentially undefined
function useLocalStorageSafe<T>(
  key: string,
  defaultValue?: T,
  options?: Options<T>
): [T | undefined, Dispatch<SetStateAction<T | undefined>>];
```

**Options Interface:**

```typescript
interface Options<T> {
  /** Custom stringify function (e.g., JSON.stringify, SuperJSON.stringify). Defaults to JSON.stringify. */
  stringify?: (value: unknown) => string;
  /** Custom parse function (e.g., JSON.parse, SuperJSON.parse). Must return the expected type T. Defaults to JSON.parse. */
  parse?: (stringValue: string) => T;
  /** Custom logging function for errors. Defaults to console.log. */
  log?: (message: unknown) => void;
  /** Function to validate the stored value on initial load. Return true if valid, false otherwise. If false, the stored item is removed, and the defaultValue is used (if provided). */
  validateInit?: (value: T) => boolean;
  /** Synchronize state across browser tabs/windows via StorageEvent. Defaults to true. */
  sync?: boolean;
  /** Suppress localStorage access errors (e.g., QuotaExceededError) and log them instead. Defaults to true. */
  silent?: boolean;
}
```

### Parameters

-   `key: string` (Required) - A unique key to identify the value in `localStorage`.
-   `defaultValue: T | undefined` (Optional) - The initial value to use if nothing is found in `localStorage` for the given `key`. Also used during server-side rendering.
-   `options: Options<T>` (Optional) - An object to customize behavior:
    -   `stringify`: Customize how your state `T` is converted to a string for storage. Useful for types beyond simple JSON (like `Map`, `Set`, `Date`).
    -   `parse`: Customize how the string retrieved from storage is converted back to your state type `T`. Must correspond to your `stringify` logic.
    -   `log`: Provide a custom function (like `console.warn`, `console.error`, or a custom logger) to handle errors caught during storage access or parsing.
    -   `validateInit`: Provide a function that receives the parsed value from `localStorage` on hook initialization. If it returns `false`, the invalid item is removed from `localStorage`, and the `defaultValue` is used instead. This prevents crashes from malformed or outdated data structures.
    -   `sync`: Set to `false` to prevent the hook from listening to `StorageEvent` and updating its state when the same key is modified in another browser tab or window.
    -   `silent`: Set to `false` to throw errors encountered during `localStorage.setItem` or `localStorage.getItem` (e.g., storage quota exceeded, security restrictions) instead of catching and logging them.

### Return Value

Returns a tuple similar to `React.useState`:

1.  `StoredValue: T | undefined` - The current value of the state. It will be `T` if a `defaultValue` was provided or if a valid value exists in storage. It can be `undefined` if no `defaultValue` was given and nothing is in storage (or if the stored value is explicitly `undefined`).
2.  `setValue: Dispatch<SetStateAction<T | undefined>>` - A function to update the state. It accepts either the new value or a function that receives the previous value and returns the new value.