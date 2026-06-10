# React Native

Zero has built-in support for React Native and Expo.

Usage is identical to [React on the web](react.md), except you must provide a `kvStore` implementation. Choose the storage adapter you prefer:

**expo-sqlite**

```tsx
import {ZeroProvider} from '@rocicorp/zero/react'
import {expoSQLiteStoreProvider} from '@rocicorp/zero/expo-sqlite'

export function RootLayout() {
  return (
    <ZeroProvider
      // ...
      kvStore={
        // On native, use expo-sqlite; on web, use IndexedDB
        Platform.OS !== 'web'
          ? expoSQLiteStoreProvider()
          : 'idb'
      }
    >
      <App />
    </ZeroProvider>
  )
}
```

**op-sqlite**

```tsx
import {ZeroProvider} from '@rocicorp/zero/react'
import {opSQLiteStoreProvider} from '@rocicorp/zero/op-sqlite'

export default function RootLayout() {
  return (
    <ZeroProvider
      // ...
      kvStore={opSQLiteStoreProvider()}
    >
      <App />
    </ZeroProvider>
  )
}
```

For a complete example, see [zslack](samples.md#zslack).

> 🤓 **If you like speed…**: `op-sqlite` is much faster than `expo-sqlite` but does not work with [Expo Go](https://expo.dev/go). However, it is supported with `expo prebuild` and development builds.

**For AI agents**: to view all the available documentation, visit https://zero.rocicorp.dev/llms.txt
