"use client";

import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CustomerType } from "@/generated/prisma/enums";
import {
  deleteDiscountRule,
  saveDiscountRule,
  toggleDiscountRule,
} from "@/app/admin/(dashboard)/discounts/actions";
import { CUSTOMER_TYPE_LABELS } from "@/lib/customer-types";

interface DiscountRow {
  id: string;
  name: string;
  description: string | null;
  percentOff: number;
  eligibleUserTypes: string[];
  requiresVerification: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  appliesToAllPackages: boolean;
  packageIds: string[];
}

const ALL_TYPES = Object.values(CustomerType);

interface FormState {
  name: string;
  description: string;
  percentOff: string;
  eligibleUserTypes: string[];
  requiresVerification: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  appliesToAllPackages: boolean;
  packageIds: string[];
}

const EMPTY: FormState = {
  name: "",
  description: "",
  percentOff: "10",
  eligibleUserTypes: [CustomerType.STUDENT, CustomerType.RESEARCHER],
  requiresVerification: false,
  startsAt: "",
  endsAt: "",
  isActive: true,
  appliesToAllPackages: true,
  packageIds: [],
};

export function DiscountsManager({
  rules,
  packages,
}: {
  rules: DiscountRow[];
  packages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<DiscountRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DiscountRow | null>(null);

  const open = creating || editing !== null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setForm(EMPTY);
    setErrors({});
    setCreating(true);
    setEditing(null);
  }

  function openEdit(rule: DiscountRow) {
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      percentOff: String(rule.percentOff),
      eligibleUserTypes: rule.eligibleUserTypes,
      requiresVerification: rule.requiresVerification,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
      isActive: rule.isActive,
      appliesToAllPackages: rule.appliesToAllPackages,
      packageIds: rule.packageIds,
    });
    setErrors({});
    setEditing(rule);
    setCreating(false);
  }

  async function handleSave() {
    setSaving(true);
    setErrors({});
    const result = await saveDiscountRule(editing?.id ?? null, {
      ...form,
      percentOff: Number(form.percentOff),
    });
    setSaving(false);

    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setCreating(false);
      setEditing(null);
      router.refresh();
    } else {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
    }
  }

  function handleToggle(rule: DiscountRow) {
    startTransition(async () => {
      const result = await toggleDiscountRule(rule.id, !rule.isActive);
      if (result.ok) {
        toast.success(result.message ?? "Updated");
        router.refresh();
      } else {
        toast.error("Could not update", result.message);
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    startTransition(async () => {
      const result = await deleteDiscountRule(target.id);
      if (result.ok) {
        toast.success("Deleted", result.message);
        router.refresh();
      } else {
        toast.error("Could not delete", result.message);
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New discount
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No discounts configured"
          description="Create a rule to offer discounted studio time to students, researchers or any other category."
          action={<Button onClick={openCreate}>Create a discount</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-semibold text-ink">{rule.name}</h3>
                  <p className="font-display mt-1 text-[24px] leading-none font-semibold text-accent-600">
                    {rule.percentOff}% off
                  </p>
                </div>
                <Badge tone={rule.isActive ? "success" : "neutral"}>
                  {rule.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>

              {rule.description ? (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  {rule.description}
                </p>
              ) : null}

              <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted">Applies to:</span>
                  {rule.eligibleUserTypes.map((type) => (
                    <Badge key={type} tone="brand">
                      {CUSTOMER_TYPE_LABELS[type as CustomerType] ?? type}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted">
                  Verification required:{" "}
                  <span className="font-medium text-ink">
                    {rule.requiresVerification ? "Yes" : "No"}
                  </span>
                </p>
                <p className="text-muted">
                  Packages:{" "}
                  <span className="font-medium text-ink">
                    {rule.appliesToAllPackages
                      ? "All packages"
                      : `${rule.packageIds.length} selected`}
                  </span>
                </p>
                <p className="text-muted">
                  Window:{" "}
                  <span className="font-medium text-ink">
                    {rule.startsAt || rule.endsAt
                      ? `${rule.startsAt || "any time"} → ${rule.endsAt || "no end"}`
                      : "Always"}
                  </span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggle(rule)}
                  disabled={pending}
                >
                  <Power className="size-3.5" aria-hidden />
                  {rule.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(rule)}
                  disabled={pending}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New discount"}
        description="The booking engine applies the single best discount a customer qualifies for: discounts never stack."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create discount"}
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            {(props) => (
              <Input
                {...props}
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Student & Researcher rate"
                invalid={Boolean(errors.name)}
              />
            )}
          </Field>

          <Field label="Percentage off" required error={errors.percentOff}>
            {(props) => (
              <Input
                {...props}
                value={form.percentOff}
                onChange={(event) => set("percentOff", event.target.value)}
                inputMode="numeric"
                placeholder="10"
                invalid={Boolean(errors.percentOff)}
              />
            )}
          </Field>

          <Field label="Description" className="sm:col-span-2" error={errors.description}>
            {(props) => (
              <Textarea
                {...props}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                rows={2}
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">
              Who qualifies <span className="text-danger-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ALL_TYPES.map((type) => (
                <Checkbox
                  key={type}
                  label={CUSTOMER_TYPE_LABELS[type]}
                  checked={form.eligibleUserTypes.includes(type)}
                  onChange={(event) =>
                    set(
                      "eligibleUserTypes",
                      event.target.checked
                        ? [...form.eligibleUserTypes, type]
                        : form.eligibleUserTypes.filter((entry) => entry !== type),
                    )
                  }
                />
              ))}
            </div>
            {errors.eligibleUserTypes ? (
              <p className="mt-1.5 text-[12.5px] text-danger-500">
                {errors.eligibleUserTypes}
              </p>
            ) : null}
          </div>

          <Field
            label="Starts on"
            error={errors.startsAt}
            description="Leave blank to start immediately."
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={form.startsAt}
                onChange={(event) => set("startsAt", event.target.value)}
              />
            )}
          </Field>

          <Field label="Ends on" error={errors.endsAt} description="Leave blank for no end date.">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={form.endsAt}
                onChange={(event) => set("endsAt", event.target.value)}
              />
            )}
          </Field>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              label="Require verification"
              description="Only customers an admin has marked as verified will get this discount."
              checked={form.requiresVerification}
              onChange={(event) => set("requiresVerification", event.target.checked)}
            />
            <Checkbox
              label="Apply to all packages"
              description="Untick to limit the discount to particular packages."
              checked={form.appliesToAllPackages}
              onChange={(event) => set("appliesToAllPackages", event.target.checked)}
            />
            <Checkbox
              label="Active"
              checked={form.isActive}
              onChange={(event) => set("isActive", event.target.checked)}
            />
          </div>

          {!form.appliesToAllPackages ? (
            <div className="sm:col-span-2">
              <p className="mb-2 text-[13px] font-semibold text-ink-soft">Applicable packages</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {packages.map((pkg) => (
                  <Checkbox
                    key={pkg.id}
                    label={pkg.name}
                    checked={form.packageIds.includes(pkg.id)}
                    onChange={(event) =>
                      set(
                        "packageIds",
                        event.target.checked
                          ? [...form.packageIds, pkg.id]
                          : form.packageIds.filter((id) => id !== pkg.id),
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          Bookings already made keep the discount they were given. This only stops the rule
          applying to new bookings.
        </p>
      </Modal>
    </>
  );
}
