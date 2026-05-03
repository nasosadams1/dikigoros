export const availabilityBusinessHours = {
  start: "08:00",
  end: "22:00",
  startMinutes: 8 * 60,
  endMinutes: 22 * 60,
  minimumSessionMinutes: 20,
} as const;

export type AvailabilityValidationCode =
  | "valid"
  | "closed"
  | "invalid_format"
  | "outside_business_hours"
  | "end_before_start"
  | "too_short";

export interface AvailabilitySlotLike {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AvailabilitySlotValidation {
  valid: boolean;
  code: AvailabilityValidationCode;
  startMinutes: number | null;
  endMinutes: number | null;
}

export const parseAvailabilityTime = (value: string | null | undefined) => {
  const match = String(value || "").trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatAvailabilityTime = (minutes: number) => {
  const normalizedMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const normalizeSessionDurationMinutes = (value: unknown, fallback = 30) => {
  const numericValue = Number(value);
  const candidate = Number.isFinite(numericValue) ? Math.floor(numericValue) : fallback;
  return Math.max(availabilityBusinessHours.minimumSessionMinutes, candidate);
};

export const normalizeBufferMinutes = (value: unknown, fallback = 0) => {
  const numericValue = Number(value);
  const candidate = Number.isFinite(numericValue) ? Math.floor(numericValue) : fallback;
  return Math.max(0, candidate);
};

export const validateAvailabilitySlot = (
  slot: AvailabilitySlotLike,
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
): AvailabilitySlotValidation => {
  if (!slot.enabled) {
    return { valid: true, code: "closed", startMinutes: null, endMinutes: null };
  }

  const startMinutes = parseAvailabilityTime(slot.start);
  const endMinutes = parseAvailabilityTime(slot.end);
  if (startMinutes === null || endMinutes === null) {
    return { valid: false, code: "invalid_format", startMinutes, endMinutes };
  }

  if (endMinutes <= startMinutes) {
    return { valid: false, code: "end_before_start", startMinutes, endMinutes };
  }

  if (
    startMinutes < availabilityBusinessHours.startMinutes ||
    endMinutes > availabilityBusinessHours.endMinutes
  ) {
    return { valid: false, code: "outside_business_hours", startMinutes, endMinutes };
  }

  if (endMinutes - startMinutes < normalizeSessionDurationMinutes(sessionMinutes)) {
    return { valid: false, code: "too_short", startMinutes, endMinutes };
  }

  return { valid: true, code: "valid", startMinutes, endMinutes };
};

export const isValidAvailabilitySlot = (
  slot: AvailabilitySlotLike,
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
) => validateAvailabilitySlot(slot, sessionMinutes).valid;

export const getAvailabilityValidationMessage = (
  validation: AvailabilitySlotValidation,
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
) => {
  if (validation.valid) return "";
  if (validation.code === "invalid_format") return "Συμπληρώστε ώρα στη μορφή ΩΩ:ΛΛ.";
  if (validation.code === "outside_business_hours") {
    return `Η διαθεσιμότητα επιτρέπεται μόνο ${availabilityBusinessHours.start}-${availabilityBusinessHours.end}.`;
  }
  if (validation.code === "end_before_start") return "Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.";
  if (validation.code === "too_short") {
    return `Το άνοιγμα πρέπει να χωρά τουλάχιστον ένα ραντεβού ${normalizeSessionDurationMinutes(sessionMinutes)} λεπτών.`;
  }
  return "Το ωράριο δεν είναι διαθέσιμο.";
};

export const countValidAvailabilityDays = (
  availability: AvailabilitySlotLike[],
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
) => availability.filter((slot) => slot.enabled && isValidAvailabilitySlot(slot, sessionMinutes)).length;

export const hasMinimumBookableAvailability = (
  availability: AvailabilitySlotLike[],
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
  minimumDays = 3,
) =>
  countValidAvailabilityDays(availability, sessionMinutes) >= minimumDays &&
  availability.every((slot) => !slot.enabled || isValidAvailabilitySlot(slot, sessionMinutes));

export const validateAvailabilitySchedule = (
  availability: AvailabilitySlotLike[],
  sessionMinutes = availabilityBusinessHours.minimumSessionMinutes,
  minimumDays = 3,
) => {
  const normalizedSessionMinutes = normalizeSessionDurationMinutes(sessionMinutes);
  const invalidSlot = availability.find((slot) => slot.enabled && !isValidAvailabilitySlot(slot, normalizedSessionMinutes));
  const validDays = countValidAvailabilityDays(availability, normalizedSessionMinutes);

  if (invalidSlot) {
    return {
      valid: false,
      validDays,
      message: getAvailabilityValidationMessage(validateAvailabilitySlot(invalidSlot, normalizedSessionMinutes), normalizedSessionMinutes),
    };
  }

  if (validDays < minimumDays) {
    return {
      valid: false,
      validDays,
      message: `Ορίστε τουλάχιστον ${minimumDays} διαθέσιμες ημέρες με ώρες ${availabilityBusinessHours.start}-${availabilityBusinessHours.end}.`,
    };
  }

  return { valid: true, validDays, message: "" };
};
