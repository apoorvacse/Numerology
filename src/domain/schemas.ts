import { z } from "zod";
import { LEAD_STATUSES } from "./lead";

/**
 * Form / input validation. We keep the rules here (not inline in the form)
 * so the same schema can be reused if we ever swap UI libraries — and so
 * the mock API can validate POST/PATCH payloads against the same schema
 * as the form, ensuring client-side and server-side rules don't drift.
 */

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`);

export const leadFormSchema = z.object({
  name: trimmedString(120).min(1, "Name is required"),
  email: trimmedString(254)
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  phone: trimmedString(40).optional().or(z.literal("")),
  source: trimmedString(60).optional().or(z.literal("")),
  status: z.enum(LEAD_STATUSES).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

/** Accepts the same shape as leadFormSchema but every field is optional. */
export const leadPatchSchema = leadFormSchema.partial();
