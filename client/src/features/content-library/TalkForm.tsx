import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "../../ui_comps/button";
import { BulletListEditor } from "../../ui_comps/bullet-list-editor";
import {
  Field,
  FieldError,
  Form,
  FormField,
  Label,
  Textarea,
  TextInput,
} from "../../ui_comps/form";
import { Modal } from "../../ui_comps/modal";
import { useCreateTalk } from "../../hooks/useCreateTalk";
import { useTalks } from "../../hooks/useTalks";
import { StyledActions, StyledListRow } from "./styles";

// Mirrors the express-validator chains in server/routes/talks.js.
// `talkingPoints`/`siteHazardsToCheck`/`discussionQuestions` are plain
// `string[]` (matching the server payload 1:1) because BulletListEditor
// already filters out blank bullets before calling onChange — no
// `{ value: string }[]` wrapper needed. `oshaStandards` is the one list still
// on useFieldArray + plain add/remove rows (short codes, little benefit from
// rich editing), which is why it alone needs that wrapper shape.
const talkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  tradeTag: z.string().trim().max(60, "Trade is too long").optional(),
  summary: z.string().trim().max(1000, "Summary is too long").optional(),
  talkingPoints: z.array(z.string()).min(1, "Add at least one talking point"),
  siteHazardsToCheck: z.array(z.string()),
  discussionQuestions: z.array(z.string()),
  oshaStandards: z.array(
    z.object({
      value: z.string().trim().min(1, "Can't be blank").max(500, "Too long"),
    }),
  ),
  estimatedMinutes: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        !value || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 480),
      { message: "Estimated minutes must be a positive number" },
    ),
});

type TalkFormValues = z.infer<typeof talkSchema>;

interface TalkFormProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Create a company-scoped custom talk. Create-only — no edit/delete this
 * round (docs/tasks.md 2d). No `talk` prop or remount-`key` trick like
 * ProjectForm's edit mode needs: Modal doesn't render closed children, so
 * this form always starts fresh from the same empty `defaultValues`.
 */
export const TalkForm = ({ isOpen, onClose }: TalkFormProps) => {
  const { createTalk, isCreating } = useCreateTalk();
  const { tradeOptions } = useTalks();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TalkFormValues>({
    resolver: zodResolver(talkSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      tradeTag: "",
      summary: "",
      talkingPoints: [],
      siteHazardsToCheck: [],
      discussionQuestions: [],
      oshaStandards: [],
      estimatedMinutes: "",
    },
  });

  const {
    fields: oshaFields,
    append: appendOsha,
    remove: removeOsha,
  } = useFieldArray({ control, name: "oshaStandards" });

  const onSubmit = async (values: TalkFormValues) => {
    try {
      await createTalk({
        title: values.title,
        tradeTag: values.tradeTag?.trim() || undefined,
        summary: values.summary?.trim() || undefined,
        talkingPoints: values.talkingPoints,
        siteHazardsToCheck: values.siteHazardsToCheck,
        discussionQuestions: values.discussionQuestions,
        // Zod's per-item `.trim().min(1)` already guarantees every row here
        // is a non-blank, trimmed string (a blank row blocks submission
        // instead — see the "Can't be blank" schema message) — no need to
        // re-trim or filter here.
        oshaStandards: values.oshaStandards.map((standard) => standard.value),
        estimatedMinutes: values.estimatedMinutes
          ? Number(values.estimatedMinutes)
          : undefined,
      });
      onClose();
    } catch {
      // useCreateTalk already surfaces the failure as a toast.
    }
  };

  const titleId = "talk-title";
  const tradeId = "talk-trade";
  const tradeListId = "talk-trade-options";
  const summaryId = "talk-summary";
  const talkingPointsId = "talk-talking-points";
  const hazardsId = "talk-hazards";
  const questionsId = "talk-discussion-questions";
  const minutesId = "talk-estimated-minutes";
  const listHint = "One per line — press Enter to add another.";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New talk" size="lg">
      <Form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField id={titleId} label="Title" error={errors.title?.message}>
          <TextInput
            id={titleId}
            type="text"
            placeholder="Ladder Safety Refresher"
            hasError={!!errors.title}
            {...register("title")}
          />
        </FormField>

        <FormField id={tradeId} label="Trade (optional)" error={errors.tradeTag?.message}>
          <TextInput
            id={tradeId}
            type="text"
            list={tradeListId}
            placeholder="Roofing"
            hasError={!!errors.tradeTag}
            {...register("tradeTag")}
          />
        </FormField>
        <datalist id={tradeListId}>
          {tradeOptions.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>

        <FormField id={summaryId} label="Summary (optional)" error={errors.summary?.message}>
          <Textarea
            id={summaryId}
            placeholder="One or two sentences on what this talk covers."
            hasError={!!errors.summary}
            {...register("summary")}
          />
        </FormField>

        <Controller
          name="talkingPoints"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              id={talkingPointsId}
              label="Talking points"
              hint={listHint}
              error={fieldState.error?.message}
            >
              <BulletListEditor
                id={talkingPointsId}
                value={field.value}
                onChange={field.onChange}
                hasError={!!fieldState.error}
              />
            </FormField>
          )}
        />

        <Controller
          name="siteHazardsToCheck"
          control={control}
          render={({ field }) => (
            <FormField
              id={hazardsId}
              label="Hazards to check on site (optional)"
              hint={listHint}
            >
              <BulletListEditor id={hazardsId} value={field.value} onChange={field.onChange} />
            </FormField>
          )}
        />

        <Controller
          name="discussionQuestions"
          control={control}
          render={({ field }) => (
            <FormField
              id={questionsId}
              label="Discussion questions (optional)"
              hint={listHint}
            >
              <BulletListEditor id={questionsId} value={field.value} onChange={field.onChange} />
            </FormField>
          )}
        />

        <Field>
          <Label>OSHA standards (optional)</Label>
          {oshaFields.map((field, index) => {
            const rowError = errors.oshaStandards?.[index]?.value;
            return (
              <Field key={field.id}>
                <StyledListRow>
                  <TextInput
                    type="text"
                    placeholder="29 CFR 1926.416"
                    aria-label={`OSHA standard ${index + 1}`}
                    hasError={!!rowError}
                    {...register(`oshaStandards.${index}.value`)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeOsha(index)}
                    aria-label={`Remove OSHA standard ${index + 1}`}
                  >
                    Remove
                  </Button>
                </StyledListRow>
                {rowError && <FieldError role="alert">{rowError.message}</FieldError>}
              </Field>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => appendOsha({ value: "" })}
          >
            Add OSHA standard
          </Button>
        </Field>

        <FormField
          id={minutesId}
          label="Estimated minutes (optional)"
          error={errors.estimatedMinutes?.message}
        >
          <TextInput
            id={minutesId}
            type="number"
            inputMode="numeric"
            placeholder="5"
            hasError={!!errors.estimatedMinutes}
            {...register("estimatedMinutes")}
          />
        </FormField>

        <StyledActions>
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={isCreating}>
            Create talk
          </Button>
        </StyledActions>
      </Form>
    </Modal>
  );
};
