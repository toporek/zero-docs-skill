# ZQL on the Server

The Zero package includes utilities to run ZQL on the server directly against your upstream Postgres database.

This is useful for many reasons:

- It allows [mutators](/docs/mutators) to read data using ZQL to check permissions or invariants.
- You can use ZQL to implement standard REST endpoints, allowing you to share code with mutators.
- In the future ([but not yet implemented](#ssr)), this can support server-side rendering.

> **Note**
>
> `ZQLDatabase` currently does a read of your postgres
>   schema before every transaction. This is fine for most
>   usages, but for high scale it may become a problem. [Let
>   us know](https://bugs.rocicorp.dev/issue/3799) if you need
>   a fix for this.

## Creating a Database

To run ZQL on the server, you will create a `ZQLDatabase` instance. Zero ships with
several built-in factories for popular Postgres libraries and ORMs.

<CodeGroup
  labels={[
    {
      text: 'Drizzle',
      sync: {pgClient: 'drizzle'},
    },
    {
      text: 'Kysely',
      sync: {pgClient: 'kysely'},
    },
    {
      text: 'Prisma',
      sync: {pgClient: 'prisma'},
    },
    {
      text: 'node-postgres',
      sync: {pgClient: 'node-postgres'},
    },
    {
      text: 'postgres.js',
      sync: {pgClient: 'postgres-js'},
    },
  ]}
>

```ts
// app/api/mutate/db-provider.ts

// pass a drizzle client instance. for example:
  schema: drizzleSchema
})

// Register the database provider for type safety
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
```

```ts
// app/api/mutate/db-provider.ts

interface Database {
  user: {
    id: string
    name: string | null
    status: 'active' | 'inactive'
  }
}

const kysely = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.ZERO_UPSTREAM_DB!
    })
  })
})

// Register the database provider for type safety
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
```

```ts
// app/api/mutate/db-provider.ts

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.ZERO_UPSTREAM_DB!
  })
})

// Register the database provider for type safety
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
```

```ts
// app/api/mutate/db-provider.ts

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB!
})

// You can also pass a client instead of a pool:
//
// const client = new Client({
//   connectionString: process.env.ZERO_UPSTREAM_DB!
// })
// await client.connect()
// export const dbProvider = zeroNodePg(schema, client)

// Register the database provider for type safety
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
```

```ts
// app/api/mutate/db-provider.ts

const sql = postgres(process.env.ZERO_UPSTREAM_DB!)

// Register the database provider for type safety
declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
```

Within your mutators, you can access the underlying transaction via `tx.dbTransaction.wrappedTransaction`:

<CodeGroup
  labels={[
    {
      text: 'Drizzle',
      sync: {pgClient: 'drizzle'},
    },
    {
      text: 'Kysely',
      sync: {pgClient: 'kysely'},
    },
    {
      text: 'Prisma',
      sync: {pgClient: 'prisma'},
    },
    {
      text: 'node-postgres',
      sync: {pgClient: 'node-postgres'},
    },
    {
      text: 'postgres.js',
      sync: {pgClient: 'postgres-js'},
    },
  ]}
>

```ts
// mutators.ts
  createUser: defineMutator(
    z.object({id: z.string(), name: z.string()}),
    async ({tx, args: {id, name}}) => {
      if (tx.location === 'server') {
        await tx.dbTransaction.wrappedTransaction
          .insert(drizzleSchema.user)
          .values({id, name})
      }
    }
  )
})
```

```ts
// mutators.ts
  createUser: defineMutator(
    z.object({id: z.string(), name: z.string()}),
    async ({tx, args: {id, name}}) => {
      if (tx.location === 'server') {
        await tx.dbTransaction.wrappedTransaction
          .insertInto('user')
          .values({id, name, status: 'active'})
          .execute()
      }
    }
  )
})
```

```ts
// mutators.ts
  createUser: defineMutator(
    z.object({id: z.string(), name: z.string()}),
    async ({tx, args: {id, name}}) => {
      if (tx.location === 'server') {
        await tx.dbTransaction.wrappedTransaction.user.create(
          {
            data: {
              id,
              name,
              status: 'active'
            }
          }
        )
      }
    }
  )
})
```

```ts
// mutators.ts
  createUser: defineMutator(
    z.object({id: z.string(), name: z.string()}),
    async ({tx, args: {id, name}}) => {
      if (tx.location === 'server') {
        await tx.dbTransaction.wrappedTransaction.query(
          'insert into "user" (id, name) values ($1, $2) returning *',
          [id, name]
        )
      }
    }
  )
})
```

```ts
// mutators.ts
  createUser: defineMutator(
    z.object({id: z.string(), name: z.string()}),
    async ({tx, args: {id, name}}) => {
      if (tx.location === 'server') {
        await tx.dbTransaction.wrappedTransaction<
          {id: string; name: string}[]
        >`insert into "user" (id, name)
          values (${id}, ${name})
          returning *`
      }
    }
  )
})
```

### Custom Database

To implement support for some other Postgres bindings library, you will implement the `DBConnection` interface.

See the implementations for the [existing adapters](https://github.com/rocicorp/mono/tree/main/packages/zero-server/src/adapters) for examples.

## Running ZQL

Once you have an instance of `ZQLDatabase`, use the `transaction()` method to run ZQL:

```ts
await dbProvider.transaction(async tx => {
  // await tx.mutate...
  // await tx.query...
  // await myMutator.fn({tx, ctx, args})
})
```

## SSR

Zero doesn't yet have the wiring setup in its bindings layers to really nicely support server-side rendering ([patches welcome though!](https://bugs.rocicorp.dev/issue/3491)).

For now, we don't recommend using Zero with SSR. Use your framework's recommended pattern to prevent SSR execution:

<CodeGroup
  labels={[
    {text: 'TanStack Start', sync: {api: 'tanstack'}},
    {text: 'Next.js', sync: {api: 'nextjs'}},
    {text: 'SolidStart', sync: {api: 'solid'}},
  ]}
>

```tsx

// Use React lazy to defer loading the ZeroProvider
const ZeroProvider = lazy(() =>
  import('@rocicorp/zero/react').then(mod => ({
    default: mod.ZeroProvider
  }))
)

function Root() {
  return (
  )
}
```

```tsx
// Mark client-only components
'use client'

  return (
  )
}
```

```tsx

const ZeroProvider = clientOnly(async () => {
  // Optionally dynamic import to code-split
  return import('@rocicorp/zero/solid').then(mod => ({
    default: mod.ZeroProvider
  }))
})

  return (
  )
}
```
