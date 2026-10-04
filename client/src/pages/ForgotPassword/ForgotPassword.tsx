import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";
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
  StyledSuccess,
} from "./ForgotPassword.styles";
import { Footer } from "../../ui_comps/footer";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPassword = () => {
  const { sendPasswordReset } = useAuth();
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setIsSubmitting(true);
    try {
      await sendPasswordReset(values.email);
      // Always show the same success message, whether or not the email is
      // registered — never reveal which emails exist in the system.
      setIsSent(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailId = "forgot-password-email";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="forgot-password-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Reset password</StyledEyebrow>
          <StyledHeadline id="forgot-password-hero-heading">
            Forgot your password?
          </StyledHeadline>

          {isSent ? (
            <>
              <StyledSuccess role="status">
                <HiCheckCircle aria-hidden="true" />
                <span>
                  If an account exists for that email, we&apos;ve sent a
                  password reset link.
                </span>
              </StyledSuccess>
              <StyledLinkRow>
                <StyledLink to="/login">Back to login</StyledLink>
              </StyledLinkRow>
            </>
          ) : (
            <>
              <StyledLede>
                Enter the email you signed up with and we&apos;ll send you a
                link to reset your password.
              </StyledLede>

              <Form onSubmit={handleSubmit(onSubmit)} noValidate $onDark>
                <FormField
                  id={emailId}
                  label="Email"
                  error={errors.email?.message}
                  onDark
                >
                  <TextInput
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    hasError={!!errors.email}
                    aria-describedby={
                      errors.email ? `${emailId}-error` : undefined
                    }
                    {...register("email")}
                  />
                </FormField>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isSubmitting}
                >
                  Send reset link
                </Button>
              </Form>

              <StyledLinkRow>
                <StyledLink to="/login">Back to login</StyledLink>
              </StyledLinkRow>
            </>
          )}
        </StyledHeroInner>
      </StyledHero>
      <Footer />
    </StyledPage>
  );
};
