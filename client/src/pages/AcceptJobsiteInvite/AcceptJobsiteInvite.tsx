import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HiCheckCircle } from "react-icons/hi2";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { useCreateProfile } from "../../hooks/useCreateProfile";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useJobsiteInvitePreview } from "../../hooks/useJobsiteInvitePreview";
import { useAcceptJobsiteInvite } from "../../hooks/useAcceptJobsiteInvite";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { PasswordInput } from "../../ui_comps/password-input";
import type { JobsiteInvitePreview } from "../../interfaces/jobsite";
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
} from "./AcceptJobsiteInvite.styles";

/** Server-enforced (`requireRole(...MANAGER_ROLES)` on accept); mirrored here
 *  only to explain why a foreman can't accept instead of showing a 403. */
const MANAGER_ROLES = ["admin", "safety_manager"];

const signupSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(120, "Company name is too long"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

const HERO_ID = "accept-jobsite-invite-hero-heading";

interface InviteBannerProps {
  preview: JobsiteInvitePreview;
}

const InviteBanner = ({ preview }: InviteBannerProps) => (
  <StyledInviteBanner>
    <strong>{preview.gcCompanyName ?? "A general contractor"}</strong> invited
    your company to <strong>{preview.jobsiteName ?? "a job site"}</strong> on
    TailgatePro.
  </StyledInviteBanner>
);

/**
 * Public page (not behind RequireAuth — the invitee may have no session) for
 * accepting a GC's Phase 8d jobsite invite. Self-guarding like AcceptInvite:
 * the real gate is the server-verified token.
 *
 * - Signed out: sign-in leads (an existing account needs no details — the
 *   signed-in branch derives everything from the profile), with a signup form
 *   for a brand-new company behind a button (Case B — `jobsiteInviteToken`
 *   rides in `user_metadata`; the server founds the company and accepts the
 *   invite). The page can't tell whether the invited email already has an
 *   account without disclosing that publicly, so it offers both.
 * - Signed in: a one-click accept for an existing subcontractor admin/safety
 *   manager (Case A), or an explanation of why this account can't accept.
 */
export const AcceptJobsiteInvite = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signUpWithEmail, logout } = useAuth();
  const { preview, isLoading, isError } = useJobsiteInvitePreview(token);
  const { createProfile, isCreating } = useCreateProfile();
  const { acceptInvite, isAccepting } = useAcceptJobsiteInvite();
  const {
    isGc,
    role,
    isLoading: isUserLoading,
  } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onTouched",
  });

  const onSignup = async (values: SignupValues) => {
    setIsSubmitting(true);
    try {
      // preview/token are always set here: the form only renders once the
      // loading/error early-returns below have passed.
      const { session } = await signUpWithEmail(preview!.email, values.password, {
        name: values.name,
        companyName: values.companyName,
        jobsiteInviteToken: token!,
      });

      if (session) {
        await createProfile({ accessToken: session.access_token });
        navigate("/projects");
      } else {
        // "Confirm email" is on: no session yet. The details are stored as
        // `user_metadata` and the profile (and the invite accept) is finished
        // on first login, same as an ordinary signup.
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

  const onSignIn = () =>
    navigate("/login", {
      state: { from: location.pathname, email: preview!.email },
    });

  const onAccept = async () => {
    try {
      await acceptInvite(token!);
      navigate("/projects");
    } catch {
      // useAcceptJobsiteInvite already surfaces the failure as a toast.
    }
  };

  if (isLoading || authLoading) {
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
        <StyledHero aria-labelledby={HERO_ID}>
          <StyledHeroInner>
            <StyledEyebrow>Job site invite</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              This invite link is invalid or has expired
            </StyledHeadline>
            <StyledLede>
              Ask the general contractor to send a new one, or sign in if you
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
        <StyledHero aria-labelledby={HERO_ID}>
          <StyledHeroInner>
            <StyledEyebrow>Job site invite</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              Check your email
              <StyledHeadlineEmail>{preview.email}</StyledHeadlineEmail>
            </StyledHeadline>
            <StyledSuccess role="status">
              <HiCheckCircle aria-hidden="true" />
              <span>
                Confirm your account from the email we just sent, then log in
                — we&apos;ll finish adding you to {preview.jobsiteName}.
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

  if (user) {
    const emailMismatch =
      (user.email ?? "").toLowerCase() !== preview.email.toLowerCase();
    const canAccept = !isGc && role !== null && MANAGER_ROLES.includes(role);

    let blocker: string | null = null;
    if (emailMismatch) {
      blocker = `This invite was sent to ${preview.email}, but you're signed in as ${user.email}. Log out and sign in with the invited address to accept it.`;
    } else if (isGc) {
      blocker =
        "General contractor accounts can't join another contractor's job site.";
    } else if (!canAccept) {
      blocker =
        "Only an admin or safety manager can accept a job site invite for your company. Ask one of them to open this link.";
    }

    return (
      <StyledPage>
        <StyledHero aria-labelledby={HERO_ID}>
          <StyledHeroInner>
            <StyledEyebrow>Job site invite</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              Join {preview.jobsiteName ?? "this job site"}
            </StyledHeadline>
            <InviteBanner preview={preview} />

            {isUserLoading ? (
              <StyledStatus role="status" aria-live="polite">
                Checking your account…
              </StyledStatus>
            ) : blocker ? (
              <>
                <StyledLede role="alert">{blocker}</StyledLede>
                {emailMismatch && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    fullWidth
                    onClick={() => logout()}
                  >
                    Log out
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                loading={isAccepting}
                onClick={onAccept}
              >
                Accept invite
              </Button>
            )}
          </StyledHeroInner>
        </StyledHero>
        <Footer />
      </StyledPage>
    );
  }

  const companyId = "accept-jobsite-invite-company";
  const nameId = "accept-jobsite-invite-name";
  const passwordId = "accept-jobsite-invite-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby={HERO_ID}>
        <StyledHeroInner>
          <StyledEyebrow>Job site invite</StyledEyebrow>
          <StyledHeadline id={HERO_ID}>
            Join {preview.jobsiteName ?? "this job site"} on TailgatePro
          </StyledHeadline>

          <InviteBanner preview={preview} />

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSignIn}
          >
            Already on TailgatePro? Sign in to accept
          </Button>

          {showSignup ? (
            <>
            <Form onSubmit={handleSubmit(onSignup)} noValidate $onDark>
              <FormField id="accept-jobsite-invite-email" label="Email" onDark>
                <TextInput
                  id="accept-jobsite-invite-email"
                  type="email"
                  value={preview.email}
                  readOnly
                  disabled
                />
              </FormField>

              <FormField
                id={companyId}
                label="Your company name"
                error={errors.companyName?.message}
                onDark
              >
                <TextInput
                  id={companyId}
                  type="text"
                  autoComplete="organization"
                  placeholder="Acme Roofing"
                  hasError={!!errors.companyName}
                  {...register("companyName")}
                />
              </FormField>

              <FormField
                id={nameId}
                label="Your name"
                error={errors.name?.message}
                onDark
              >
                <TextInput
                  id={nameId}
                  type="text"
                  autoComplete="name"
                  placeholder="Jamie Foreman"
                  hasError={!!errors.name}
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
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => setShowSignup(true)}
            >
              New to TailgatePro? Create a company account
            </Button>
          )}
        </StyledHeroInner>
      </StyledHero>
      <Footer />
    </StyledPage>
  );
};
