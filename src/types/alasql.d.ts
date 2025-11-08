declare module 'alasql' {
  type Params = unknown[] | Record<string, unknown>

  interface AlaSQL {
    (sql: string, params?: Params): unknown
  }

  const alasql: AlaSQL
  export default alasql
}
