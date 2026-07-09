const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const formatClockTime = (time: Date) =>
  [time.getHours(), time.getMinutes(), time.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

export const formatClockDate = (time: Date) =>
  `${time.getFullYear()}年${time.getMonth() + 1}月${time.getDate()}日(${
    WEEKDAY_LABELS[time.getDay()]
  })`;

export const formatClockSummary = (time: Date) =>
  `${formatClockDate(time)} ${formatClockTime(time)}`;
