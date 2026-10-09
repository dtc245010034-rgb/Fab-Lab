import { useEffect } from 'react';
import { DEFAULT_RECIPE } from '../sim/defaults';
import type { SimClient } from '../workers/simClient';
import { isDebugRequested } from './describe';
import Traveler from './Traveler';
import { useRecipeResult } from './useRecipeResult';
import Viewer from './Viewer';
import ViewerPlaceholder from './ViewerPlaceholder';

/** The course itself: the cross-section Viewer fed by the simulation worker, and the Traveler. */
export default function Lab({ createClient }: { createClient: () => SimClient }) {
  const { shown, pending, error } = useRecipeResult(DEFAULT_RECIPE, createClient);

  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  return (
    <main className="lab">
      {shown ? (
        <Viewer
          recipe={shown.recipe}
          result={shown.result}
          pending={pending}
          failed={error !== null}
          debug={isDebugRequested(window.location.search)}
        />
      ) : (
        <ViewerPlaceholder failed={error !== null} />
      )}
      <Traveler />
    </main>
  );
}
