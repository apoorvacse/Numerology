import { forwardRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/api/client";
import type { Lead } from "@/domain/lead";
import { leadFormSchema, type LeadFormValues } from "@/domain/schemas";
import { useCreateLead, useUpdateLead } from "@/hooks/useLeads";
import { useToast } from "./Toaster";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { cn } from "@/utils/cn";

interface LeadFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the dialog is in edit mode for this lead. Otherwise create. */
  lead?: Lead | null;
  onCreated?: (lead: Lead) => void;
  onUpdated?: (lead: Lead) => void;
}

/**
 * Form dialog for create/edit. Shared so the surface stays consistent and
 * we don't end up with two divergent forms. Status is intentionally NOT
 * editable from this form — transitions go through StatusMenu, which knows
 * the rules. This keeps validation focused on the editable subset.
 */
export function LeadFormDialog({
  open,
  onClose,
  lead,
  onCreated,
  onUpdated,
}: LeadFormDialogProps) {
  const isEdit = Boolean(lead);
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isValid, isDirty, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      source: "",
    },
  });

  // Re-seed form when opening or switching record.
  useEffect(() => {
    if (!open) return;
    reset({
      name: lead?.name ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      source: lead?.source ?? "",
    });
  }, [open, lead, reset]);

  const submit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      source: values.source?.trim() || undefined,
    };

    try {
      if (isEdit && lead) {
        const updated = await updateMutation.mutateAsync({
          id: lead.id,
          input: payload,
        });
        toast({
          message: "Lead updated",
          description: updated.name,
          variant: "success",
        });
        onUpdated?.(updated);
      } else {
        const created = await createMutation.mutateAsync(payload);
        toast({
          message: "Lead created",
          description: created.name,
          variant: "success",
        });
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      // Map server field errors back into the form. Anything else surfaces
      // as a toast — never as a raw JSON dump.
      if (err instanceof ApiError && err.fields) {
        for (const [field, message] of Object.entries(err.fields)) {
          if (field === "name" || field === "email" || field === "phone" || field === "source") {
            setError(field, { type: "server", message });
          }
        }
        toast({
          message: "Couldn't save lead",
          description: err.message,
          variant: "error",
        });
      } else {
        toast({
          message: "Couldn't save lead",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "error",
        });
      }
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit lead" : "New lead"}
      description={
        isEdit
          ? "Update the lead's contact details. Status changes are managed separately."
          : "Capture a new lead. Status changes happen later from the row menu."
      }
      dismissable={!isSubmitting}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="lead-form"
            className="btn-primary"
            disabled={!isValid || isSubmitting || (isEdit && !isDirty)}
          >
            {isSubmitting && <Spinner size={14} />}
            {isEdit ? "Save changes" : "Create lead"}
          </button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Name"
          required
          error={errors.name?.message}
          autoFocus
          {...register("name")}
        />
        <Field
          label="Email"
          required
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Phone"
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <Field
            label="Source"
            placeholder="e.g. website, referral"
            error={errors.source?.message}
            {...register("source")}
          />
        </div>
      </form>
    </Modal>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
}

/**
 * Forwarded ref because react-hook-form's `register` writes a ref into
 * the input. Inline error rendering with aria-describedby for SR support.
 */
const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, required, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `field-${rest.name}`;
  const errorId = error ? `${inputId}-err` : undefined;
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          "input",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});
