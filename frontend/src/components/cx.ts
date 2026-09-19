/** Joins the class names that are set; CSS module lookups may be `undefined`. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}
