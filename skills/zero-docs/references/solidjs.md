# SolidJS

Zero has built-in support for Solid. Here’s what basic usage looks like:

## Setup

Use the `ZeroProvider` component to setup Zero. It takes care of creating and destroying `Zero` instances reactively:

```tsx

const cacheURL = import.meta.env.VITE_PUBLIC_ZERO_CACHE_URL!

function Root() {
  const session = useSession()
  const userID = session?.userID
  const auth = session?.accessToken
  const context = userID ? {userID} : undefined

  return (
    <ZeroProvider
      {...{
        userID,
        auth,
        context,
        cacheURL,
        schema,
        mutators
      }}
    >
  )
}
```

If you use token auth, pass it with `auth={session?.jwt}`. If you use cookie auth, omit the parameter entirely.

When `auth` changes from one string to another, `ZeroProvider` refreshes auth in place with `zero.connection.connect({auth})`. When `auth` is added or removed, or `userID` changes, it recreates the `Zero` instance.

When the user is logged out, omit the `userID` entirely.

You can also pass a `Zero` instance to the `ZeroProvider` if you want to control the lifecycle of the `Zero` instance yourself:

```tsx
// ZeroProvider just sets up the context, it doesn't manage
// the lifecycle of the Zero instance.
```

When you pass `zero={zero}`, `ZeroProvider` only provides SolidJS Context. It does not manage auth updates for that instance, so if you are using token auth, call `zero.connection.connect({auth: newToken})` yourself or recreate the instance when the user changes.

## Usage

Use `useQuery` to run queries:

```tsx

function App() {
  const [posts] = useQuery(() =>
    queries.posts.byStatus({status: 'draft'})
  )

  return (
      {post => (
        <div key={post.id}>
          {post.title} - ({post.comments.length} comments)
        </div>
      )}
  )
}
```

Use `useZero` to get access to the `Zero` instance, for example to run mutators:

```tsx

function CompleteButton({issueID}: {issueID: string}) {
  const zero = useZero()

  const onClick = () => {
    zero().mutate(mutators.issues.complete({id: issueID}))
  }

  return <button onClick={onClick}>Complete Issue</button>
}
```

## Examples

See the complete quickstart here:

https://github.com/rocicorp/hello-zero-solid
