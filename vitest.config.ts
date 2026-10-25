export default {
  resolve: {
    alias: { '@art': `${process.cwd()}/resources/art` }
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1
  }
}
