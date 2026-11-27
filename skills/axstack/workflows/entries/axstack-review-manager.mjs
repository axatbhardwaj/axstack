import { reviewManager } from '../review-manager-workflow.mjs';
import { reviewRuntime } from '../review-manager-runtime.mjs';

const base = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '');
export default reviewManager(reviewRuntime(base));
