import type { StoredBooking } from "@/lib/platformRepository";

const normalizeGreekDateText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const greekMonthNumbers: Record<string, string> = {
  ιανουαριου: "01",
  φεβρουαριου: "02",
  μαρτιου: "03",
  απριλιου: "04",
  μαιου: "05",
  ιουνιου: "06",
  ιουλιου: "07",
  αυγουστου: "08",
  σεπτεμβριου: "09",
  οκτωβριου: "10",
  νοεμβριου: "11",
  δεκεμβριου: "12",
};

const getReferenceDateMatch = (booking: Pick<StoredBooking, "referenceId">) =>
  booking.referenceId.match(/(?:^|-)BK-(\d{4})(\d{2})(\d{2})(?:-|$)/i)
  || booking.referenceId.match(/(\d{4})(\d{2})(\d{2})/);

export const getBookingDateFromLabelIso = (booking: Pick<StoredBooking, "dateLabel" | "referenceId">) => {
  const normalizedLabel = normalizeGreekDateText(booking.dateLabel).replace(/[.,]/g, " ");
  const match = normalizedLabel.match(/(?:^|\s)(\d{1,2})\s+(ιανουαριου|φεβρουαριου|μαρτιου|απριλιου|μαιου|ιουνιου|ιουλιου|αυγουστου|σεπτεμβριου|οκτωβριου|νοεμβριου|δεκεμβριου)(?:\s|$)/);
  if (!match) return null;

  const explicitYear = normalizedLabel.match(/\b(20\d{2})\b/)?.[1];
  const referenceYear = getReferenceDateMatch(booking)?.[1];
  const year = explicitYear || referenceYear || String(new Date().getFullYear());
  const day = match[1].padStart(2, "0");
  const month = greekMonthNumbers[match[2]];
  if (!month) return null;
  return `${year}-${month}-${day}`;
};

const getBookingDateFromReferenceIso = (booking: Pick<StoredBooking, "referenceId">) => {
  const referenceDate = getReferenceDateMatch(booking);
  if (!referenceDate) return null;
  return `${referenceDate[1]}-${referenceDate[2]}-${referenceDate[3]}`;
};

export const getBookingDateIso = (booking: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId">) =>
  getBookingDateFromLabelIso(booking)
  || booking.dateIso
  || getBookingDateFromReferenceIso(booking);

export const getBookingDateTime = (booking: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time">) => {
  const dateIso = getBookingDateIso(booking);
  if (!dateIso) return null;
  const normalizedTime = /^\d:\d{2}$/.test(booking.time) ? `0${booking.time}` : booking.time || "00:00";
  const date = new Date(`${dateIso}T${normalizedTime}:00`);
  const time = date.getTime();
  if (!Number.isNaN(time)) return time;
  const fallback = new Date(`${dateIso}T00:00:00`).getTime();
  return Number.isNaN(fallback) ? null : fallback;
};

const getBookingComparableTime = (booking: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time" | "createdAt">) => {
  const bookingTime = getBookingDateTime(booking);
  if (bookingTime !== null) return bookingTime;
  const createdAt = new Date(booking.createdAt).getTime();
  return Number.isNaN(createdAt) ? 0 : createdAt;
};

export const sortBookingsNewestFirst = (
  left: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time" | "createdAt">,
  right: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time" | "createdAt">,
) => {
  const timeDelta = getBookingComparableTime(right) - getBookingComparableTime(left);
  if (timeDelta !== 0) return timeDelta;
  return right.referenceId.localeCompare(left.referenceId);
};

export const sortBookingsUpcomingFirst = (
  left: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time" | "createdAt">,
  right: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time" | "createdAt">,
) => {
  const timeDelta = getBookingComparableTime(left) - getBookingComparableTime(right);
  if (timeDelta !== 0) return timeDelta;
  return left.referenceId.localeCompare(right.referenceId);
};

export const isFutureBooking = (
  booking: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time">,
  now = Date.now(),
) => {
  const bookingTime = getBookingDateTime(booking);
  return bookingTime !== null && bookingTime > now;
};

export const formatNextBookingSlot = (booking: Pick<StoredBooking, "dateIso" | "dateLabel" | "referenceId" | "time">) => {
  const bookingTime = getBookingDateTime(booking);
  if (bookingTime === null) return booking.time;
  const date = new Date(bookingTime);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) return `Σήμερα · ${booking.time}`;

  return `${date.toLocaleDateString("el-GR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })} · ${booking.time}`;
};
