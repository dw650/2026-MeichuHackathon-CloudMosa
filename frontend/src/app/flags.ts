/** Dev and demo builds include the debug pages and the Demo settings row (F18).
 *  Both values are replaced at build time, so production bundles drop that code. */
export const IS_DEMO_BUILD: boolean = import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true'
