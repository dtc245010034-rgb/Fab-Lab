import { describe, expect, it } from 'vitest';
import { routeFor } from '../../src/ui/route';

describe('routeFor (location.pathname → module page)', () => {
  it('keeps / on M04: the lab that was there first', () => {
    expect(routeFor('/')).toBe('m04');
    expect(routeFor('')).toBe('m04');
  });

  it('sends /m03 to the lithography page, with or without a trailing slash', () => {
    expect(routeFor('/m03')).toBe('m03');
    expect(routeFor('/m03/')).toBe('m03');
  });

  it('is not fooled by a path that only starts or ends like /m03', () => {
    for (const path of ['/m030', '/m03x', '/x/m03', '/m03/extra', '/m0', '/M03']) {
      expect(routeFor(path), path).toBe('m04');
    }
  });

  it('sends any other path to M04: the host answers every unknown path with index.html', () => {
    for (const path of ['/m04', '/index.html', '/nope', '/m03.html']) {
      expect(routeFor(path), path).toBe('m04');
    }
  });
});
