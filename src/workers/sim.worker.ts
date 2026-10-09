import * as Comlink from 'comlink';
import { warmUpRecipes } from '../sim/cases';
import { SimService } from './simService';

const service = new SimService({ warmUp: warmUpRecipes() });
Comlink.expose(service);
// Once the worker is up: run the three regression cases a few times at idle (see SimService).
service.startWarmUp();
