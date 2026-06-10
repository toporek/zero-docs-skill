# Ad-Hoc Queries (Deprecated)

> 😵 **This API is deprecated**: It will be removed in a future release of Zero. Please move to the new [queries](../queries.md) API.

## Overview

Zero generates a query API for every table you sync. To enable, set the `enableLegacyQueries` option to `true` in your schema:

```ts
const schema = createSchema({
  // ...
  enableLegacyQueries: true
})
```

Once enabled, queries are available at `z.query.<tablename>`.

```tsx
const zero = new Zero(...);
const issues = await zero.query.issue.where('priority', 'high').run();
```

Each table is a ZQL builder object. See [ZQL](../zql.md) for details.

**For AI agents**: to view all the available documentation, visit https://zero.rocicorp.dev/llms.txt
