/** Minimal toast store for in-app action feedback (aria-live region renders it). */

export interface Toast {
  id: number;
  tone: 'success' | 'info' | 'warning';
  message: string;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let seq = 1;

function emit() {
  listeners.forEach((l) => l());
}

export function pushToast(message: string, tone: Toast['tone'] = 'success'): void {
  const toast: Toast = { id: seq++, tone, message };
  toasts = [...toasts, toast];
  emit();
  window.setTimeout(() => dismissToast(toast.id), 4600);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getToasts(): Toast[] {
  return toasts;
}
