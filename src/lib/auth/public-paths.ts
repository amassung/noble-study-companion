export const AUTH_PUBLIC_PATHS = ["/login", "/signup"] as const;

export type AuthPublicPath = (typeof AUTH_PUBLIC_PATHS)[number];

export function isAuthPublicPath(pathname: string): pathname is AuthPublicPath {
  return (AUTH_PUBLIC_PATHS as readonly string[]).includes(pathname);
}
