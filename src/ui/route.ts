/** The page a path asks for. */
export type Route = 'm03' | 'm04';

/**
 * Which module page `location.pathname` asks for. `/` is M04, the lab that was here first. The
 * host answers every unknown path with index.html (`not_found_handling` in wrangler.jsonc), so a
 * path that is nothing in particular also gets M04 rather than an empty page.
 */
export function routeFor(pathname: string): Route {
  return pathname === '/m03' || pathname === '/m03/' ? 'm03' : 'm04';
}
