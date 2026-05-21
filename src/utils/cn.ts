import clsx, { type ClassValue } from "clsx";

/**
 * Tiny class-name utility. We use clsx instead of classnames because it's
 * smaller and supports conditional objects out of the box. Not introducing
 * tailwind-merge — for this app's class surface, controlled prop overrides
 * are enough and the dependency isn't worth its weight.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
