export function resolveThemeHost(element: HTMLElement | null) {
  return element?.closest("main") ?? document.documentElement;
}

export function readThemeVar(
  element: HTMLElement | null,
  variableName: string,
  fallback: string,
) {
  const value = window
    .getComputedStyle(resolveThemeHost(element))
    .getPropertyValue(variableName)
    .trim();

  return value || fallback;
}
