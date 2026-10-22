import type { ReactNode } from 'react';

/** What the model leaves out, in one place and closed until the learner opens it. */
export default function ModelLimits({ children }: { children: ReactNode }) {
  return (
    <details className="limits">
      <summary>Giới hạn của mô hình</summary>
      <div className="limits-body">{children}</div>
    </details>
  );
}
