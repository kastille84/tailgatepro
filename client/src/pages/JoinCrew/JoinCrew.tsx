import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { useCreateProfile } from "../../hooks/useCreateProfile";
import { useCrewJoinPreview } from "../../hooks/useCrewJoinPreview";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { PasswordInput } from "../../ui_comps/password-input";
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
} from "../AcceptInvite/AcceptInvite.styles";

const joinCrewSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type JoinCrewValues = z.infer<typeof joinCrewSchema>;

/**
 * Public page (not behind RequireAuth, since the foreman has no session yet) for
 * joining an in-house crew from its open join link or QR (Phase 13f-join,
 * docs/in-house-subs-design.md). `GET /api/companies/crew-join/:token` previews
 * the crew; on submit, `signUpWithEmail` carries `crewJoinToken` as
 * `user_metadata` so the server's `createProfile` adds them to the crew as a
 * foreman. Unlike an email invite there is no preset email: they use their own.
 * One person belongs to one company, so a signed-in visitor is asked to sign out.
 */
export const JoinCrew = () => {
  const { token } = useParams<{ token: string }>();
  const { preview, isLoading, isError } = useCrewJoinPreview(token);
  const { session, signUpWithEmail, logout } = useAuth();
  const { createProfile, isCreating } = useCreateProfile();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinCrewValues>({
    resolver: zodResolver(joinCrewSchema),
    mode: "onTouched",
  });

  const onSubmit = async (values: JoinCrewValues) => {
    setIsSubmitting(true);
    try {
      // token is always set here: the form only renders once the preview has loaded.
      const { session: newSession } = await signUpWithEmail(values.email, values.password, {
        name: values.name,
        crewJoinToken: token!,
      });

      if (newSession) {
        await createProfile({ accessToken: newSession.access_token });
        navigate("/dashboard");
      } else {
        // Supabase "Confirm email" is on: no session yet. The details are stored
        // as `user_metadata` and the profile is created on first login.
        setConfirmationEmail(values.email);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join this crew.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading your join link…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (isError || !preview) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="join-crew-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Join link</StyledEyebrow>
            <StyledHeadline id="join-crew-hero-heading">
              This join link is invalid or has expired
            </StyledHeadline>
            <StyledLede>
              Ask whoever shared it for a new one, or sign in if you already have an account.
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

  if (confirmationEmail) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="join-crew-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Join link</StyledEyebrow>
            <StyledHeadline id="join-crew-hero-heading">
              Check your email
              <StyledHeadlineEmail>{confirmationEmail}</StyledHeadlineEmail>
            </StyledHeadline>
            <StyledSuccess role="status">
              <HiCheckCircle aria-hidden="true" />
              <span>
                Confirm your account from the email we just sent, then log in. We'll finish
                setting you up in {preview.crewName}.
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

  if (session) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby="join-crew-hero-heading">
          <StyledHeroInner>
            <StyledEyebrow>Join link</StyledEyebrow>
            <StyledHeadline id="join-crew-hero-heading">You're already signed in</StyledHeadline>
            <StyledLede>
              A person belongs to one company. Sign out to join {preview.crewName} with a different
              email.
            </StyledLede>
            <Button type="button" variant="primary" size="lg" onClick={() => logout()}>
              Sign out
            </Button>
          </StyledHeroInner>
        </StyledHero>
        <Footer />
      </StyledPage>
    );
  }

  const emailId = "join-crew-email";
  const nameId = "join-crew-name";
  const passwordId = "join-crew-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="join-crew-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Join link</StyledEyebrow>
          <StyledHeadline id="join-crew-hero-heading">
            Join {preview.crewName} on TailgatePro
          </StyledHeadline>

          <StyledInviteBanner>
            You're joining <strong>{preview.crewName}</strong>
            {preview.gcName ? (
              <>
                {" "}
                for <strong>{preview.gcName}</strong>
              </>
            ) : null}{" "}
            as a <strong>Foreman</strong>. Create your account below to get started.
          </StyledInviteBanner>

          <Form onSubmit={handleSubmit(onSubmit)} noValidate $onDark>
            <FormField id={emailId} label="Email" error={errors.email?.message} onDark>
              <TextInput
                id={emailId}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                hasError={!!errors.email}
                aria-describedby={errors.email ? `${emailId}-error` : undefined}
                {...register("email")}
              />
            </FormField>

            <FormField id={nameId} label="Name" error={errors.name?.message} onDark>
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

            <FormField id={passwordId} label="Password" error={errors.password?.message} onDark>
              <PasswordInput
                id={passwordId}
                autoComplete="new-password"
                defaultVisible
                hasError={!!errors.password}
                aria-describedby={errors.password ? `${passwordId}-error` : undefined}
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
            <StyledLink to="/login">Already have an account? Sign in</StyledLink>
          </StyledLinkRow>
        </StyledHeroInner>
      </StyledHero>
      <Footer />
    </StyledPage>
  );
};
