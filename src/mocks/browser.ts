import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { qualityHandlers } from './qualityHandlers';

export const worker = setupWorker(...handlers, ...qualityHandlers);
