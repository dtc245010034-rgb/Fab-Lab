import * as Comlink from 'comlink';
import { makeService } from './service';

// The page passes its query string as the worker's name (a Worker URL must stay static for Vite).
const service = makeService(new URLSearchParams(self.name));
Comlink.expose(service);
service.startWarmUp();
