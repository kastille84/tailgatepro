import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";

import { Button } from "../../ui_comps/button";
import { useWaitlist } from "../../hooks/useWaitlist";
import type { Audience } from "../../interfaces/plan";
import {
  StyledForm,
  StyledFieldRow,
  StyledField,
  StyledLabel,
  StyledTextInput,
  StyledFieldError,
  StyledSuccess,
} from "./Landing.styles";

const waitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  company: z.string().trim().max(120, "Company name is too long").optional(),
});

type WaitlistValues = z.infer<typeof waitlistSchema>;

interface WaitlistFormProps {
  /** Namespaces every field id so the form can render more than once per page. */
  idPrefix: string;
  /** Colour treatment for labels/errors when the form sits on a dark section. */
  tone?: "onDark" | "onLight";
  /** Plan audience the visitor was viewing, recorded with the signup. */
  audience?: Audience;
  /** Plan id the visitor clicked through from, recorded with the signup. */
  planInterest?: string;
}

export const WaitlistForm = ({
  idPrefix,
  tone = "onLight",
  audience,
  planInterest,
}: WaitlistFormProps) => {
  const onDark = tone === "onDark";
  const { joinWaitlist, isJoining, hasJoined, joinedEmail } = useWaitlist();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WaitlistValues>({
    resolver: zodResolver(waitlistSchema),
    mode: "onTouched",
  });

  const onSubmit = (data: WaitlistValues) => {
    joinWaitlist({ ...data, audience, planInterest });
  };

  if (hasJoined && joinedEmail) {
    return (
      <StyledSuccess role="status" $onDark={onDark}>
        <HiCheckCircle aria-hidden="true" />
        <span>
          You&apos;re on the list — we&apos;ll email{" "}
          <strong>{joinedEmail}</strong> when TailgatePro launches.
        </span>
      </StyledSuccess>
    );
  }

  const nameId = `${idPrefix}-waitlist-name`;
  const emailId = `${idPrefix}-waitlist-email`;
  const companyId = `${idPrefix}-waitlist-company`;

  return (
    <StyledForm onSubmit={handleSubmit(onSubmit)} noValidate $onDark={onDark}>
      <StyledFieldRow>
        <StyledField>
          <StyledLabel htmlFor={nameId} $onDark={onDark}>
            Name
          </StyledLabel>
          <StyledTextInput
            id={nameId}
            type="text"
            autoComplete="name"
            placeholder="Edwin Martinez"
            hasError={!!errors.name}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            {...register("name")}
          />
          {errors.name && (
            <StyledFieldError
              id={`${nameId}-error`}
              role="alert"
              $onDark={onDark}
            >
              {errors.name.message}
            </StyledFieldError>
          )}
        </StyledField>

        <StyledField>
          <StyledLabel htmlFor={emailId} $onDark={onDark}>
            Work email
          </StyledLabel>
          <StyledTextInput
            id={emailId}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            hasError={!!errors.email}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            {...register("email")}
          />
          {errors.email && (
            <StyledFieldError
              id={`${emailId}-error`}
              role="alert"
              $onDark={onDark}
            >
              {errors.email.message}
            </StyledFieldError>
          )}
        </StyledField>
      </StyledFieldRow>

      <StyledField>
        <StyledLabel htmlFor={companyId} $onDark={onDark}>
          Company <span>(optional)</span>
        </StyledLabel>
        <StyledTextInput
          id={companyId}
          type="text"
          autoComplete="organization"
          placeholder="Rivera Electric"
          hasError={!!errors.company}
          aria-describedby={errors.company ? `${companyId}-error` : undefined}
          {...register("company")}
        />
        {errors.company && (
          <StyledFieldError
            id={`${companyId}-error`}
            role="alert"
            $onDark={onDark}
          >
            {errors.company.message}
          </StyledFieldError>
        )}
      </StyledField>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={isJoining}
      >
        Join the waitlist
      </Button>
    </StyledForm>
  );
};
