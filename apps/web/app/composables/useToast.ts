export type ToastItem = {
  id: number;
  message: string;
  tone?: "default" | "success" | "danger";
};

export function useToast() {
  const toasts = useState<ToastItem[]>("toasts", () => []);
  let seq = 0;

  function push(message: string, tone: ToastItem["tone"] = "default", ms = 2200) {
    const id = ++seq;
    toasts.value = [...toasts.value, { id, message, tone }];
    if (import.meta.client) {
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, ms);
    }
  }

  return { toasts, push };
}
