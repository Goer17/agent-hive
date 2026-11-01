export type ToastTone = "error" | "success";

export interface ToastDetail {
  message: string;
  tone: ToastTone;
}

export const TOAST_EVENT = "hive:toast";

export function toast(message: string, tone: ToastTone = "error"): void {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, tone } }),
  );
}