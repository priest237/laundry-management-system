export function money(value: string | number | null | undefined) {
  const amount = Math.round(Number(value || 0));
  const formatted = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formatted} CFA`;
}

export function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}
