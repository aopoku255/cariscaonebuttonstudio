"use client";

import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PackageCategory } from "@/generated/prisma/enums";
import {
  deletePackage,
  savePackage,
  togglePackageActive,
} from "@/app/admin/(dashboard)/packages/actions";
import { cn, formatDuration, formatMoney, minorToMajorString, slugify } from "@/lib/utils";

export interface AdminPackage {
  id: string;
  name: string;
  slug: string;
  category: string;
  summary: string | null;
  description: string | null;
  priceMinor: number;
  durationMinutes: number;
  imageUrl: string | null;
  isActive: boolean;
  isPopular: boolean;
  studentOnly: boolean;
  sortOrder: number;
  includedHours: number | null;
  extraHourDiscountPercent: number | null;
  validityDays: number | null;
  priorityBooking: boolean;
  features: string[];
  bookingCount: number;
  membershipCount: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  STUDIO_RENTAL: "Studio Rental",
  MEMBERSHIP: "Membership",
  PRODUCTION: "Production",
  CORPORATE: "Corporate",
  STUDENT: "Student",
  OTHER: "Other",
};

interface FormState {
  name: string;
  slug: string;
  category: string;
  summary: string;
  description: string;
  priceMajor: string;
  durationMinutes: string;
  imageUrl: string;
  isActive: boolean;
  isPopular: boolean;
  studentOnly: boolean;
  sortOrder: string;
  features: string[];
  includedHours: string;
  extraHourDiscountPercent: string;
  validityDays: string;
  priorityBooking: boolean;
}

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    category: PackageCategory.STUDIO_RENTAL,
    summary: "",
    description: "",
    priceMajor: "",
    durationMinutes: "60",
    imageUrl: "",
    isActive: true,
    isPopular: false,
    studentOnly: false,
    sortOrder: "0",
    features: [""],
    includedHours: "",
    extraHourDiscountPercent: "",
    validityDays: "30",
    priorityBooking: false,
  };
}

function toForm(pkg: AdminPackage): FormState {
  return {
    name: pkg.name,
    slug: pkg.slug,
    category: pkg.category,
    summary: pkg.summary ?? "",
    description: pkg.description ?? "",
    priceMajor: minorToMajorString(pkg.priceMinor),
    durationMinutes: String(pkg.durationMinutes),
    imageUrl: pkg.imageUrl ?? "",
    isActive: pkg.isActive,
    isPopular: pkg.isPopular,
    studentOnly: pkg.studentOnly,
    sortOrder: String(pkg.sortOrder),
    features: pkg.features.length ? pkg.features : [""],
    includedHours: pkg.includedHours !== null ? String(pkg.includedHours) : "",
    extraHourDiscountPercent:
      pkg.extraHourDiscountPercent !== null ? String(pkg.extraHourDiscountPercent) : "",
    validityDays: pkg.validityDays !== null ? String(pkg.validityDays) : "30",
    priorityBooking: pkg.priorityBooking,
  };
}

export function PackagesManager({ packages }: { packages: AdminPackage[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<AdminPackage | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminPackage | null>(null);

  const open = creating || editing !== null;
  const isMembership = form.category === PackageCategory.MEMBERSHIP;

  function openCreate() {
    setForm(emptyForm());
    setErrors({});
    setCreating(true);
    setEditing(null);
  }

  function openEdit(pkg: AdminPackage) {
    setForm(toForm(pkg));
    setErrors({});
    setEditing(pkg);
    setCreating(false);
  }

  function close() {
    setCreating(false);
    setEditing(null);
    setErrors({});
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setErrors({});

    const result = await savePackage(editing?.id ?? null, {
      name: form.name,
      slug: form.slug || slugify(form.name),
      category: form.category,
      summary: form.summary,
      description: form.description,
      priceMajor: form.priceMajor,
      durationMinutes: form.durationMinutes,
      imageUrl: form.imageUrl,
      isActive: form.isActive,
      isPopular: form.isPopular,
      studentOnly: form.studentOnly,
      sortOrder: form.sortOrder,
      features: form.features.filter((feature) => feature.trim()),
      includedHours: form.includedHours || undefined,
      extraHourDiscountPercent: form.extraHourDiscountPercent
        ? Number(form.extraHourDiscountPercent)
        : undefined,
      validityDays: form.validityDays || undefined,
      priorityBooking: form.priorityBooking,
    });

    setSaving(false);

    if (!result.ok) {
      setErrors(result.errors ?? {});
      toast.error("Could not save", result.message);
      return;
    }

    toast.success(result.message ?? "Saved");
    close();
    router.refresh();
  }

  function handleToggle(pkg: AdminPackage) {
    startTransition(async () => {
      const result = await togglePackageActive(pkg.id, !pkg.isActive);
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
      const result = await deletePackage(target.id);
      if (result.ok) {
        toast.success("Done", result.message);
        router.refresh();
      } else {
        toast.error("Could not delete", result.message);
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4" aria-hidden />
          New package
        </Button>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          title="No packages yet"
          description="Create your first package and it will appear on the public website immediately."
          action={<Button onClick={openCreate}>Create a package</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden rounded-xl border border-line bg-surface md:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Package</Th>
                    <Th>Category</Th>
                    <Th>Price</Th>
                    <Th>Duration</Th>
                    <Th>Bookings</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <Tr key={pkg.id}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{pkg.name}</span>
                          {pkg.studentOnly ? <Badge tone="brand">Student</Badge> : null}
                          {pkg.isPopular ? <Badge tone="accent">Popular</Badge> : null}
                        </div>
                        <span className="text-[12px] text-muted">/{pkg.slug}</span>
                      </Td>
                      <Td>{CATEGORY_LABELS[pkg.category] ?? pkg.category}</Td>
                      <Td className="font-medium text-ink">{formatMoney(pkg.priceMinor)}</Td>
                      <Td>
                        {pkg.category === PackageCategory.MEMBERSHIP
                          ? `${pkg.includedHours ?? 0} hrs / month`
                          : formatDuration(pkg.durationMinutes)}
                      </Td>
                      <Td>{pkg.bookingCount}</Td>
                      <Td>
                        <Badge tone={pkg.isActive ? "success" : "neutral"}>
                          {pkg.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <IconAction label="Edit" onClick={() => openEdit(pkg)}>
                            <Pencil className="size-4" aria-hidden />
                          </IconAction>
                          <IconAction
                            label={pkg.isActive ? "Disable" : "Enable"}
                            onClick={() => handleToggle(pkg)}
                            disabled={pending}
                          >
                            <Power className="size-4" aria-hidden />
                          </IconAction>
                          <IconAction
                            label="Delete"
                            danger
                            onClick={() => setConfirmDelete(pkg)}
                            disabled={pending}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </IconAction>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {packages.map((pkg) => (
              <MobileRowCard
                key={pkg.id}
                title={pkg.name}
                subtitle={`/${pkg.slug}`}
                badges={
                  <Badge tone={pkg.isActive ? "success" : "neutral"}>
                    {pkg.isActive ? "Active" : "Disabled"}
                  </Badge>
                }
                rows={[
                  { label: "Category", value: CATEGORY_LABELS[pkg.category] ?? pkg.category },
                  { label: "Price", value: formatMoney(pkg.priceMinor) },
                  {
                    label: "Duration",
                    value:
                      pkg.category === PackageCategory.MEMBERSHIP
                        ? `${pkg.includedHours ?? 0} hrs`
                        : formatDuration(pkg.durationMinutes),
                  },
                  { label: "Bookings", value: String(pkg.bookingCount) },
                ]}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(pkg)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggle(pkg)}
                      disabled={pending}
                    >
                      {pkg.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(pkg)}
                      disabled={pending}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </>
      )}

      {/* Create / edit */}
      <Modal
        open={open}
        onClose={close}
        title={editing ? `Edit ${editing.name}` : "New package"}
        description="Changes go live on the public website as soon as you save."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create package"}
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
                invalid={Boolean(errors.name)}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((current) => ({
                    ...current,
                    name,
                    // Keep the slug in step while creating, but never rewrite an
                    // existing package's slug from under a live URL.
                    slug: editing ? current.slug : slugify(name),
                  }));
                }}
                placeholder="3 Hours"
              />
            )}
          </Field>

          <Field label="Slug" required error={errors.slug} description="Used in links.">
            {(props) => (
              <Input
                {...props}
                value={form.slug}
                invalid={Boolean(errors.slug)}
                onChange={(event) => set("slug", slugify(event.target.value))}
                placeholder="studio-3-hours"
              />
            )}
          </Field>

          <Field label="Category" required error={errors.category}>
            {(props) => (
              <Select
                {...props}
                value={form.category}
                onChange={(event) => set("category", event.target.value)}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label={isMembership ? "Monthly price (GH₵)" : "Price (GH₵)"}
            required
            error={errors.priceMajor}
          >
            {(props) => (
              <Input
                {...props}
                value={form.priceMajor}
                invalid={Boolean(errors.priceMajor)}
                onChange={(event) => set("priceMajor", event.target.value)}
                placeholder="550"
                inputMode="decimal"
              />
            )}
          </Field>

          {isMembership ? (
            <>
              <Field label="Included hours" required error={errors.includedHours}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.includedHours}
                    onChange={(event) => set("includedHours", event.target.value)}
                    placeholder="8"
                    inputMode="numeric"
                  />
                )}
              </Field>
              <Field
                label="Discount on additional hours (%)"
                error={errors.extraHourDiscountPercent}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={form.extraHourDiscountPercent}
                    onChange={(event) => set("extraHourDiscountPercent", event.target.value)}
                    placeholder="15"
                    inputMode="numeric"
                  />
                )}
              </Field>
              <Field
                label="Validity (days)"
                error={errors.validityDays}
                description="How long the prepaid hours stay usable."
              >
                {(props) => (
                  <Input
                    {...props}
                    value={form.validityDays}
                    onChange={(event) => set("validityDays", event.target.value)}
                    placeholder="30"
                    inputMode="numeric"
                  />
                )}
              </Field>
            </>
          ) : (
            <Field label="Duration (minutes)" required error={errors.durationMinutes}>
              {(props) => (
                <Input
                  {...props}
                  value={form.durationMinutes}
                  invalid={Boolean(errors.durationMinutes)}
                  onChange={(event) => set("durationMinutes", event.target.value)}
                  placeholder="180"
                  inputMode="numeric"
                />
              )}
            </Field>
          )}

          <Field label="Sort order" error={errors.sortOrder} description="Lower shows first.">
            {(props) => (
              <Input
                {...props}
                value={form.sortOrder}
                onChange={(event) => set("sortOrder", event.target.value)}
                inputMode="numeric"
              />
            )}
          </Field>

          <Field label="Image URL" className="sm:col-span-2" error={errors.imageUrl}>
            {(props) => (
              <Input
                {...props}
                value={form.imageUrl}
                onChange={(event) => set("imageUrl", event.target.value)}
                placeholder="https://… (optional)"
              />
            )}
          </Field>

          <Field
            label="Short summary"
            className="sm:col-span-2"
            error={errors.summary}
            description="One line, shown on the package card."
          >
            {(props) => (
              <Input
                {...props}
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
                placeholder="Room to record a full episode without rushing."
              />
            )}
          </Field>

          <Field label="Description" className="sm:col-span-2" error={errors.description}>
            {(props) => (
              <Textarea
                {...props}
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                rows={3}
              />
            )}
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold text-ink-soft">What is included</p>
            <div className="space-y-2">
              {form.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={feature}
                    onChange={(event) => {
                      const next = [...form.features];
                      next[index] = event.target.value;
                      set("features", next);
                    }}
                    placeholder="Studio access"
                    aria-label={`Feature ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "features",
                        form.features.filter((_, position) => position !== index),
                      )
                    }
                    className="shrink-0 rounded-lg border border-line-strong px-2.5 text-muted transition-colors hover:bg-paper-deep hover:text-ink"
                    aria-label={`Remove feature ${index + 1}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => set("features", [...form.features, ""])}
            >
              <Plus className="size-4" aria-hidden />
              Add feature
            </Button>
          </div>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              label="Active"
              description="Inactive packages are hidden from the website and cannot be booked."
              checked={form.isActive}
              onChange={(event) => set("isActive", event.target.checked)}
            />
            <Checkbox
              label="Mark as popular"
              description="Highlights this package on the pricing cards."
              checked={form.isPopular}
              onChange={(event) => set("isPopular", event.target.checked)}
            />
            <Checkbox
              label="Student Studio only"
              description="Only bookable by verified KNUST students. Shown with a KNUST Student badge and only offered first on the booking flow when the customer selects that category."
              checked={form.studentOnly}
              onChange={(event) => set("studentOnly", event.target.checked)}
            />
            {isMembership ? (
              <Checkbox
                label="Priority booking"
                description="Members on this plan are flagged for priority in the calendar."
                checked={form.priorityBooking}
                onChange={(event) => set("priorityBooking", event.target.checked)}
              />
            ) : null}
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
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
              Delete package
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {confirmDelete && confirmDelete.bookingCount > 0 ? (
            <>
              This package has{" "}
              <strong className="font-semibold text-ink">
                {confirmDelete.bookingCount} booking(s)
              </strong>{" "}
              attached, so it will be disabled rather than deleted. It will disappear from
              the website, and the booking history stays intact.
            </>
          ) : (
            "This package has no bookings, so it will be removed completely. This cannot be undone."
          )}
        </p>
      </Modal>
    </>
  );
}

function IconAction({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-lg p-1.5 transition-colors disabled:opacity-40",
        danger
          ? "text-muted hover:bg-danger-50 hover:text-danger-700"
          : "text-muted hover:bg-paper-deep hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
