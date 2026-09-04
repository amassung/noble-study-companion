// /ink-lab is a dev-only bench for the handwriting engine (see the route).
// The route itself refuses to render outside dev, so listing it here exposes
// nothing in production.
export const AUTH_PUBLIC_PATHS = ["/login", "/signup", "/ink-lab"] as const;

export type AuthPublicPath = (typeof AUTH_PUBLIC_PATHS)[number];

export function isAuthPublicPath(pathname: string): pathname is AuthPublicPath {
  return (AUTH_PUBLIC_PATHS as readonly string[]).includes(pathname);
}
