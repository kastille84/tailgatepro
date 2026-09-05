import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { Button } from "../../ui_comps/button";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledLinkRow,
  StyledLink,
  StyledStatus,
} from "./ResetPassword.styles";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const ResetPassword = () => {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setIsSubmitting(true);
    try {
      await updatePassword(values.password);
      toast.success("Password updated. You're all set.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Checking your reset link…
        </StyledStatus>
      </StyledPage>
    );
  }

  // This page is public (not behind RequireAuth): its "session" comes from
  // the recovery token in the reset-link URL, which the Supabase client
  // establishes automatically — not from a prior login.
  if (!session) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="reset-password-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Reset password</StyledEyebrow>
            <StyledHeadline id="reset-password-hero-heading">
              This link is invalid or has expired
            </StyledHeadline>
            <StyledLede>Request a new password reset link.</StyledLede>
            <StyledLinkRow>
              <StyledLink to="/forgot-password">
                Request a new link
              </StyledLink>
            </StyledLinkRow>
          </StyledHeroInner>
        </StyledHero>
      </StyledPage>
    );
  }

  const passwordId = "reset-password-password";
  const confirmPasswordId = "reset-password-confirm-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="reset-password-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Reset password</StyledEyebrow>
          <StyledHeadline id="reset-password-hero-heading">
            Choose a new password
          </StyledHeadline>

          <Form onSubmit={handleSubmit(onSubmit)} noValidate $onDark>
            <FormField
              id={passwordId}
              label="New password"
              error={errors.password?.message}
              onDark
            >
              <TextInput
                id={passwordId}
                type="password"
                autoComplete="new-password"
                hasError={!!errors.password}
                aria-describedby={
                  errors.password ? `${passwordId}-error` : undefined
                }
                {...register("password")}
              />
            </FormField>

            <FormField
              id={confirmPasswordId}
              label="Confirm new password"
              error={errors.confirmPassword?.message}
              onDark
            >
              <TextInput
                id={confirmPasswordId}
                type="password"
                autoComplete="new-password"
                hasError={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword
                    ? `${confirmPasswordId}-error`
                    : undefined
                }
                {...register("confirmPassword")}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
            >
              Update password
            </Button>
          </Form>
        </StyledHeroInner>
      </StyledHero>
    </StyledPage>
  );
};
