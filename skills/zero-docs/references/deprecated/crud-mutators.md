# CRUD Mutators (Deprecated)

> 💀 **This API is deprecated**: It will be removed in a future release of Zero. Please move to the new [mutator](../mutators.md) API.

## Overview

Zero generates basic CRUD mutators for every table you sync. To enable, set the `enableLegacyMutators` option to `true` in your schema:

```ts
const schema = createSchema({
  // ...
  enableLegacyMutators: true
})
```

Once enabled, mutators are available at `z.mutate.<tablename>`:

```tsx
const zero = new Zero(...);
zero.mutate.user.insert({
	id: crypto.randomUUID(),
	username: 'abby',
	language: 'en-us',
});
```

See [Writing Data with Mutators](../mutators.md#writing-data) for more information. `z.mutate` contains the same methods as `tx.mutate` but is available on the `Zero` instance instead of the `Transaction` instance.

**For AI agents**: to view all the available documentation, visit https://zero.rocicorp.dev/llms.txt
