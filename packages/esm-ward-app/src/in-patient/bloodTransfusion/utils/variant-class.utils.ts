/** CSS-module class for a variant, e.g. `variantClass(styles, 'level', 'high')` → `styles.levelHigh`. */
export function variantClass(
  styles: Record<string, string>,
  prefix: string,
  variant: string | null | undefined,
): string | undefined {
  if (!variant) {
    return undefined;
  }
  return styles[`${prefix}${variant.charAt(0).toUpperCase()}${variant.slice(1)}`];
}
