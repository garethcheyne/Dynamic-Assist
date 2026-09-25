import * as React from "react"

export type Load<T> = { data: T | null; error: string | null; loading: boolean }

/**
 * Runs `fn` when `deps` change and keeps its answer; `reload` runs it
 * again. The last answer stays while the next one loads. `fn` null: idle.
 */
export function useLoad<T>(fn: (() => Promise<T>) | null, deps: unknown[]) {
  const [nonce, setNonce] = React.useState(0)
  const key = JSON.stringify([...deps, nonce])
  const [state, setState] = React.useState<{
    key: string | null
    data: T | null
    error: string | null
  }>({ key: null, data: null, error: null })

  React.useEffect(() => {
    if (!fn) return
    let live = true
    fn().then(
      (data) => live && setState({ key, data, error: null }),
      (e: unknown) =>
        live &&
        setState({
          key,
          data: null,
          error: e instanceof Error ? e.message : String(e),
        })
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is the deps
  }, [key, !fn])

  const loading = !!fn && state.key !== key
  return {
    data: state.data,
    error: loading ? null : state.error,
    loading,
    reload: () => setNonce((n) => n + 1),
  }
}
