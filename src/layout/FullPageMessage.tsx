import type { ReactNode } from 'react';

export function FullPageMessage({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-2xl">
      <div className="max-w-[32rem] space-y-sm text-center">
        <h1 className="text-2xl font-extrabold text-content-heading">{title}</h1>
        {text && <p className="text-md text-content-subtle">{text}</p>}
        {action}
      </div>
    </div>
  );
}
