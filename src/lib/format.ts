const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const shortDate = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const number = new Intl.NumberFormat("ru");

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelativeTime(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const delta = unixSeconds - Date.now() / 1000;
  const absolute = Math.abs(delta);

  for (const [unit, seconds] of UNITS) {
    if (absolute >= seconds) {
      return relative.format(Math.round(delta / seconds), unit);
    }
  }
  return "только что";
}

export function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return dateTime.format(new Date(unixSeconds * 1000));
}

export function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  return shortDate.format(new Date(unixSeconds * 1000));
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
