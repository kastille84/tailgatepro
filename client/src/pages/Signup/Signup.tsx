import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { useCreateProfile } from "../../hooks/useCreateProfile";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FieldRow, FormField, TextInput } from "../../ui_comps/form";
import { SegmentedToggle } from "../../ui_comps/segmented-toggle";
import type { CompanyType } from "../../interfaces/company";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledFieldGroup,
  StyledFieldLabel,
  StyledLinkRow,
  StyledLink,
  StyledSuccess,
} from "./Signup.styles";

const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "subcontractor", label: "Subcontractor" },
  { value: "gc", label: "General Contractor" },
];

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(120, "Company name is too long"),
  companyType: z.enum(["gc", "subcontractor"]),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

export const Signup = () => {
  const { signUpWithEmail } = useAuth();
  const { createProfile, isCreating } = useCreateProfile();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
    defaultValues: { companyType: "subcontractor" },
  });

  const onSubmit = async (values: SignupValues) => {
    setIsSubmitting(true);
    try {
      const { session } = await signUpWithEmail(values.email, values.password);

      if (session) {
        await createProfile({
          name: values.name,
          companyName: values.companyName,
          companyType: values.companyType,
          accessToken: session.access_token,
        });
        navigate("/dashboard");
      } else {
        // Supabase "Confirm email" is on for this project — no session yet,
        // so there's no authenticated request to create the profile with.
        // Deferred profile creation on first login is a future follow-up.
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sign up.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="signup-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Sign up</StyledEyebrow>
            <StyledHeadline id="signup-hero-heading">
              Check your email
            </StyledHeadline>
            <StyledSuccess role="status">
              <HiCheckCircle aria-hidden="true" />
              <span>
                Confirm your account from the email we just sent, then log in —
                we&apos;ll finish setting up your profile.
              </span>
            </StyledSuccess>
            <StyledLinkRow>
              <StyledLink to="/login">Go to login</StyledLink>
            </StyledLinkRow>
          </StyledHeroInner>
        </StyledHero>
      </StyledPage>
    );
  }

  const nameId = "signup-name";
  const companyNameId = "signup-company-name";
  const emailId = "signup-email";
  const passwordId = "signup-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="signup-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Sign up</StyledEyebrow>
          <StyledHeadline id="signup-hero-heading">
            Create your TailgatePro account
          </StyledHeadline>
          <StyledLede>
            Start free — subcontractors run offline toolbox talks, general
            contractors get a compliance dashboard.
          </StyledLede>

          <Form onSubmit={handleSubmit(onSubmit)} noValidate $onDark>
            <StyledFieldGroup>
              <StyledFieldLabel id="signup-company-type-label">
                I&apos;m signing up as a
              </StyledFieldLabel>
              <Controller
                name="companyType"
                control={control}
                render={({ field }) => (
                  <SegmentedToggle<CompanyType>
                    options={COMPANY_TYPE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    ariaLabel="I'm signing up as a"
                  />
                )}
              />
            </StyledFieldGroup>

            <FieldRow>
              <FormField
                id={nameId}
                label="Name"
                error={errors.name?.message}
                onDark
              >
                <TextInput
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  placeholder="Edwin Martinez"
                  hasError={!!errors.name}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                  {...register("name")}
                />
              </FormField>

              <FormField
                id={companyNameId}
                label="Company name"
                error={errors.companyName?.message}
                onDark
              >
                <TextInput
                  id={companyNameId}
                  type="text"
                  autoComplete="organization"
                  placeholder="Rivera Electric"
                  hasError={!!errors.companyName}
                  aria-describedby={
                    errors.companyName ? `${companyNameId}-error` : undefined
                  }
                  {...register("companyName")}
                />
              </FormField>
            </FieldRow>

            <FormField
              id={emailId}
              label="Work email"
              error={errors.email?.message}
              onDark
            >
              <TextInput
                id={emailId}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                hasError={!!errors.email}
                aria-describedby={errors.email ? `${emailId}-error` : undefined}
                {...register("email")}
              />
            </FormField>

            <FormField
              id={passwordId}
              label="Password"
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting || isCreating}
            >
              Create account
            </Button>
          </Form>

          <StyledLinkRow>
            <StyledLink to="/login">
              Already have an account? Sign in
            </StyledLink>
          </StyledLinkRow>
        </StyledHeroInner>
      </StyledHero>
      <Footer />
    </StyledPage>
  );
};
