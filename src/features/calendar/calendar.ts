export interface CalendarDay {
  date: Date;
  machineDate: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const isSameLocalDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const toMachineDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const shiftMonth = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

export const buildCalendarDays = (
  viewMonth: Date,
  today: Date,
): CalendarDay[] => {
  const monthStart = startOfMonth(viewMonth);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - monthStart.getDay(),
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return {
      date,
      machineDate: toMachineDate(date),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: isSameLocalDate(date, today),
    };
  });
};
