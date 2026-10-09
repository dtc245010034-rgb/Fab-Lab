// The shipped SimService and runRecipe, with `compute` wrapped in performance.mark so that a Chrome
// trace can be lined up with every run (mark names run-start-N / run-end-N, N counting from 1 over
// warm-up and benchmark runs together). Nothing here changes what is computed.
import { warmUpRecipes } from '../../src/sim/cases';
import { runRecipe, type Recipe } from '../../src/sim/recipe';
import { SimService } from '../../src/workers/simService';

/** `options`: warm=0 turns the warm-up off. */
export function makeService(options: URLSearchParams): SimService {
  let n = 0;
  return new SimService({
    warmUp: options.get('warm') === '0' ? [] : warmUpRecipes(),
    compute: (recipe: Recipe) => {
      const i = ++n;
      performance.mark(`run-start-${i}`);
      const result = runRecipe(recipe);
      performance.mark(`run-end-${i}`);
      return result;
    },
  });
}
