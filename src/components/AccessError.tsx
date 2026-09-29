import { Button } from '@severn-trent/cwqm-design-system';
import { ApiError } from '../api/client';
import { FullPageMessage } from '../layout/FullPageMessage';

/** Shown when the server refuses a request (403) or can't find the site (404). */
export function accessErrorOf(...errors: (Error | null)[]) {
  return errors.find((e) => e instanceof ApiError && (e.status === 403 || e.status === 404)) as ApiError | undefined;
}

export function AccessError({ error, onReset }: { error: ApiError; onReset: () => void }) {
  return (
    <FullPageMessage title={error.status === 403 ? 'No access to this view' : 'Not found'} text={error.message}
      action={<Button onClick={onReset}>Back to default view</Button>} />
  );
}
