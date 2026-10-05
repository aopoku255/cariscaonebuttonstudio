"use client";

import { Eye, FilePlus2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { PolicyBlocks } from "@/components/policies/policy-content";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { PolicyStatus } from "@/generated/prisma/enums";
import { parsePolicy } from "@/lib/policies/markdown";
import { createTokenResolver } from "@/lib/policies/tokens";
import { allowedPolicyActions, type PolicyAction } from "@/lib/policies/workflow";
import { cn } from "@/lib/utils";
import {
  createPolicy,
  savePolicyDraft,
  startDraft,
  transitionPolicyVersion,
} from "@/app/admin/(dashboard)/policies/actions";

/* -------------------------------------------------------------------------- */
/* New policy                                                                  */
/* -------------------------------------------------------------------------- */

export function NewPolicyButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await createPolicy({ title, summary });
      if (!result.ok || !result.data) {
        setErrors(result.errors ?? {});
        toast.error("Policy not created", result.message);
        return;
      }
      toast.success(result.message ?? "Policy created.");
      setOpen(false);
      router.push(`/admin/policies/${result.data.id}/${result.data.versionId}`);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        New policy
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New policy"
        description="Creates an empty first draft. Nothing is shown on the website until the draft has been reviewed, approved and published."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending}>
              Create draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required error={errors.title}>
            {(props) => (
              <Input {...props} value={title} onChange={(event) => setTitle(event.target.value)} />
            )}
          </Field>
          <Field
            label="Summary"
            description="One sentence shown under the title on the public page."
            error={errors.summary}
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Start a new draft                                                           */
/* -------------------------------------------------------------------------- */

export function StartDraftButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startDraft(policyId);
          if (!result.ok || !result.data) {
            toast.error("Draft not started", result.message);
            return;
          }
          toast.success(result.message ?? "Draft created.");
          router.push(`/admin/policies/${policyId}/${result.data.versionId}`);
        })
      }
    >
      <FilePlus2 className="size-4" aria-hidden />
      Start a new version
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

export interface PolicyEditorVersion {
  id: string;
  version: string;
  title: string;
  content: string;
  status: PolicyStatus;
  effectiveDate: string;
  lastUpdatedDate: string;
  changeReason: string;
}

const ACTION_LABELS: Record<Exclude<PolicyAction, "edit">, string> = {
  submit: "Send for review",
  returnToDraft: "Return to draft",
  approve: "Approve",
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  delete: "Delete draft",
};

const CONFIRMATIONS: Partial<Record<PolicyAction, string>> = {
  publish:
    "Publishing makes this the version the public sees and the version customers accept at checkout. The version currently published will be archived.",
  unpublish: "The policy will no longer be shown on the website until a version is published again.",
  delete: "This draft will be removed permanently.",
  archive: "This version will be archived and can no longer be published.",
};

export function PolicyEditor({
  policyId,
  version: initial,
  canManage,
  canPublish,
  requiredAtCheckout,
  settings,
}: {
  policyId: string;
  version: PolicyEditorVersion;
  canManage: boolean;
  canPublish: boolean;
  requiredAtCheckout: boolean;
  settings: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"write" | "preview">(initial.status === "DRAFT" ? "write" : "preview");
  const [confirming, setConfirming] = useState<Exclude<PolicyAction, "edit"> | null>(null);
  const [pending, startTransition] = useTransition();

  const actions = allowedPolicyActions(initial.status, { canManage, canPublish, requiredAtCheckout });
  const editable = actions.includes("edit");
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const document = useMemo(
    () => parsePolicy(values.content, createTokenResolver(settings)),
    [values.content, settings],
  );

  const set = (key: keyof PolicyEditorVersion) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function save(after?: () => void) {
    startTransition(async () => {
      const result = await savePolicyDraft(initial.id, {
        title: values.title,
        version: values.version,
        content: values.content,
        effectiveDate: values.effectiveDate,
        lastUpdatedDate: values.lastUpdatedDate,
        changeReason: values.changeReason,
      });
      if (!result.ok) {
        setErrors(result.errors ?? {});
        toast.error("Draft not saved", result.message);
        return;
      }
      setErrors({});
      toast.success(result.message ?? "Draft saved.");
      router.refresh();
      after?.();
    });
  }

  function run(action: Exclude<PolicyAction, "edit">) {
    startTransition(async () => {
      const result = await transitionPolicyVersion(initial.id, action);
      setConfirming(null);
      if (!result.ok) {
        toast.error("That did not work", result.message);
        return;
      }
      toast.success(result.message ?? "Done.");
      if (action === "delete") router.push(`/admin/policies/${policyId}`);
      else router.refresh();
    });
  }

  function request(action: Exclude<PolicyAction, "edit">) {
    if (editable && dirty) {
      toast.error("Save your changes first", "This draft has changes that have not been saved.");
      return;
    }
    if (CONFIRMATIONS[action]) setConfirming(action);
    else run(action);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Version details"
          description={
            editable
              ? "The effective date and last updated date are shown on the public page. Leave them blank until they are confirmed: a blank date shows as a placeholder."
              : "This version is not a draft, so it is read-only."
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Title" required error={errors.title} className="sm:col-span-2">
            {(props) => (
              <Input
                {...props}
                value={values.title}
                disabled={!editable}
                onChange={(event) => set("title")(event.target.value)}
              />
            )}
          </Field>
          <Field label="Version" required error={errors.version}>
            {(props) => (
              <Input
                {...props}
                value={values.version}
                disabled={!editable}
                onChange={(event) => set("version")(event.target.value)}
              />
            )}
          </Field>
          <div className="hidden lg:block" />
          <Field label="Effective date" error={errors.effectiveDate}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={values.effectiveDate}
                disabled={!editable}
                onChange={(event) => set("effectiveDate")(event.target.value)}
              />
            )}
          </Field>
          <Field label="Last updated" error={errors.lastUpdatedDate}>
            {(props) => (
              <Input
                {...props}
                type="date"
                value={values.lastUpdatedDate}
                disabled={!editable}
                onChange={(event) => set("lastUpdatedDate")(event.target.value)}
              />
            )}
          </Field>
          <Field
            label="Reason for this update"
            description="Kept in the version history."
            error={errors.changeReason}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={values.changeReason}
                disabled={!editable}
                onChange={(event) => set("changeReason")(event.target.value)}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Content"
          description="Use ## for a numbered section, ### for a sub-heading, - for a list item, > for a note, **bold** and [link text](/address). Write {{setting.name}} to quote a value from Settings."
          action={
            <div className="flex rounded-lg border border-line p-0.5">
              {(["write", "preview"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors",
                    tab === key ? "bg-brand-800 text-white" : "text-ink-soft hover:bg-paper-deep",
                  )}
                >
                  {key === "write" ? (
                    <Pencil className="size-3.5" aria-hidden />
                  ) : (
                    <Eye className="size-3.5" aria-hidden />
                  )}
                  {key === "write" ? (editable ? "Write" : "Source") : "Preview"}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          {tab === "write" ? (
            <Field error={errors.content}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={28}
                  value={values.content}
                  readOnly={!editable}
                  spellCheck
                  className="font-mono text-[13px] leading-relaxed"
                  onChange={(event) => set("content")(event.target.value)}
                />
              )}
            </Field>
          ) : (
            <div className="mx-auto max-w-3xl">
              {document.intro.length ? (
                <div className="mb-8">
                  <PolicyBlocks blocks={document.intro} idPrefix="intro" />
                </div>
              ) : null}
              <div className="space-y-10">
                {document.sections.map((section) => (
                  <section key={section.id}>
                    <h2 className="font-display flex gap-3 text-[21px] leading-tight font-semibold text-ink">
                      <span className="text-brand-600">{section.number}.</span>
                      <span>{section.title}</span>
                    </h2>
                    <div className="mt-3">
                      <PolicyBlocks blocks={section.blocks} idPrefix={section.id} />
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {document.placeholders.length ? (
            <Alert tone="warning" className="mt-5" title="Placeholders in this version">
              These details have not been confirmed, so readers will see a marked placeholder:
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {document.placeholders.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </CardBody>
        <CardFooter>
          {editable ? (
            <Button onClick={() => save()} loading={pending} disabled={!dirty}>
              Save draft
            </Button>
          ) : null}
          {actions
            .filter((action): action is Exclude<PolicyAction, "edit"> => action !== "edit")
            .map((action) => (
              <Button
                key={action}
                variant={
                  action === "delete"
                    ? "danger"
                    : action === "publish" || action === "approve" || action === "submit"
                      ? "secondary"
                      : "outline"
                }
                disabled={pending}
                onClick={() => request(action)}
              >
                {ACTION_LABELS[action]}
              </Button>
            ))}
        </CardFooter>
      </Card>

      <Alert tone="warning" title="Internal note: review before publication">
        These policies should be reviewed and approved by the appropriate CARISCA/KNUST authority
        and, where necessary, qualified legal counsel before publication.
      </Alert>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming ? `${ACTION_LABELS[confirming]}?` : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={confirming === "delete" ? "danger" : "primary"}
              loading={pending}
              onClick={() => confirming && run(confirming)}
            >
              {confirming ? ACTION_LABELS[confirming] : ""}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {confirming ? CONFIRMATIONS[confirming] : ""}
        </p>
      </Modal>
    </div>
  );
}
