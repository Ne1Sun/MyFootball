export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: "data:text/javascript,const mockD1 = { prepare: () => ({ bind: () => mockD1.prepare(), first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true, meta: { changes: 0 } }), raw: async () => [] }), batch: async (s) => s.map(() => ({ success: true, meta: { changes: 0 } })), exec: async () => ({ count: 0, duration: 0 }) }; export const env = { DB: mockD1 };",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
