import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { useCreateProfile } from "../../hooks/useCreateProfile";
import { useInvitePreview } from "../../hooks/useInvitePreview";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { PasswordInput } from "../../ui_comps/password-input";
import type { InviteRole } from "../../interfaces/companyInvite";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledHeadlineEmail,
  StyledLede,
  StyledInviteBanner,
  StyledLinkRow,
  StyledLink,
  StyledStatus,
  StyledSuccess,
} from "./AcceptInvite.styles";

const ROLE_LABELS: Record<InviteRole, string> = {
  admin: "Admin",
  safety_manager: "Safety Manager",
  foreman: "Foreman",
};

const acceptInviteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;

/**
 * Public page (not behind RequireAuth — the invitee has no session yet) for
 * accepting a Phase 8c company invite. Self-guarding, same pattern as
 * ResetPassword: the real gate is the server-verified token, not a Supabase
 * session. `GET /api/companies/invite/:token` previews the invite before any
 * account exists; on submit, `signUpWithEmail` carries `inviteToken` as
 * `user_metadata` so the server's `createProfile` can join the existing
 * company instead of creating a new one (see docs/tasks.md Phase 8c).
 */
export const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { preview, isLoading, isError } = useInvitePreview(token);
  const { signUpWithEmail } = useAuth();
  const { createProfile, isCreating } = useCreateProfile();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: AcceptInviteValues) => {
    setIsSubmitting(true);
    try {
      // preview/token are always set here: the form below only renders once
      // the loading/error early-returns above have passed.
      const { session } = await signUpWithEmail(preview!.email, values.password, {
        name: values.name,
        inviteToken: token!,
      });

      if (session) {
        await createProfile({ accessToken: session.access_token });
        navigate("/dashboard");
      } else {
        // Supabase "Confirm email" is on for this project — no session yet.
        // The fields entered here are stored as `user_metadata` and the
        // profile is created on first login (see Login.tsx), same as an
        // ordinary signup.
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not accept this invite.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading your invite…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (isError || !preview) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="accept-invite-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Invite</StyledEyebrow>
            <StyledHeadline id="accept-invite-hero-heading">
              This invite link is invalid or has expired
            </StyledHeadline>
            <StyledLede>
              Ask whoever invited you to send a new one, or sign in if you
              already have an account.
            </StyledLede>
            <StyledLinkRow>
              <StyledLink to="/login">Go to login</StyledLink>
            </StyledLinkRow>
          </StyledHeroInner>
        </StyledHero>
        <Footer />
      </StyledPage>
    );
  }

  if (awaitingConfirmation) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="accept-invite-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Invite</StyledEyebrow>
            <StyledHeadline id="accept-invite-hero-heading">
              Check your email
              <StyledHeadlineEmail>{preview.email}</StyledHeadlineEmail>
            </StyledHeadline>
            <StyledSuccess role="status">
              <HiCheckCircle aria-hidden="true" />
              <span>
                Confirm your account from the email we just sent, then log in
                — we&apos;ll finish setting you up at {preview.companyName}.
              </span>
            </StyledSuccess>
            <StyledLinkRow>
              <StyledLink to="/login">Go to login</StyledLink>
            </StyledLinkRow>
          </StyledHeroInner>
        </StyledHero>
        <Footer />
      </StyledPage>
    );
  }

  const nameId = "accept-invite-name";
  const passwordId = "accept-invite-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="accept-invite-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Invite</StyledEyebrow>
          <StyledHeadline id="accept-invite-hero-heading">
            Join {preview.companyName ?? "your team"} on TailgatePro
          </StyledHeadline>

          <StyledInviteBanner>
            You've been invited to join <strong>{preview.companyName}</strong>{" "}
            as <strong>{ROLE_LABELS[preview.role]}</strong>. Create your
            account below to get started.
          </StyledInviteBanner>

          <Form onSubmit={handleSubmit(onSubmit)} noValidate $onDark>
            <FormField id="accept-invite-email" label="Email" onDark>
              <TextInput
                id="accept-invite-email"
                type="email"
                value={preview.email}
                readOnly
                disabled
              />
            </FormField>

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
                placeholder="Jamie Foreman"
                hasError={!!errors.name}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
                {...register("name")}
              />
            </FormField>

            <FormField
              id={passwordId}
              label="Password"
              error={errors.password?.message}
              onDark
            >
              <PasswordInput
                id={passwordId}
                autoComplete="new-password"
                defaultVisible
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
