import * as Comlink from 'comlink';
import { SimService } from './simService';

Comlink.expose(new SimService());
