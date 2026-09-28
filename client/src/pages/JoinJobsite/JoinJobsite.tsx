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
import { useJoinLinkPreview } from "../../hooks/useJoinLinkPreview";
import { useAcceptJoinLink } from "../../hooks/useAcceptJoinLink";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import { PasswordInput } from "../../ui_comps/password-input";
import type { JobsiteJoinPreview } from "../../interfaces/jobsite";
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
} from "./JoinJobsite.styles";

/** Server-enforced (`requireRole(...MANAGER_ROLES)` on accept); mirrored here
 *  only to explain why a foreman can't join instead of showing a 403. */
const MANAGER_ROLES = ["admin", "safety_manager"];

const signupSchema = z.object({
  // Unlike the email-invite page, a QR/join link has no invited address —
  // the joiner types their own, same as an ordinary signup.
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
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

const HERO_ID = "join-jobsite-hero-heading";

interface JoinBannerProps {
  preview: JobsiteJoinPreview;
}

const JoinBanner = ({ preview }: JoinBannerProps) => (
  <StyledInviteBanner>
    <strong>{preview.gcCompanyName ?? "A general contractor"}</strong> uses
    TailgatePro on <strong>{preview.jobsiteName ?? "this job site"}</strong>.
  </StyledInviteBanner>
);

/**
 * Public page (not behind RequireAuth — the scanner may have no session) for
 * joining a jobsite via its standing QR/join link (Phase 9e,
 * `docs/jobsite-qr-join-design.md`). Self-guarding like AcceptJobsiteInvite:
 * the real gate is the server-verified token. Unlike that page, joining needs
 * no GC approval and no email match — anyone who can open the link and is (or
 * becomes) a subcontractor admin/safety_manager can join immediately.
 *
 * - Signed out: sign-in leads for an existing account, with a signup form for
 *   a brand-new company behind a button (the QR/join-link mirror of the
 *   email invite's Case B — `jobsiteJoinToken` rides in `user_metadata`; the
 *   server founds the company and accepts the join link). Unlike the invite
 *   page, the signup form asks for an email too, since no address is invited.
 * - Signed in: a one-click join for a subcontractor admin/safety manager, or
 *   an explanation of why this account can't join.
 */
export const JoinJobsite = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, signUpWithEmail } = useAuth();
  const { preview, isLoading, isError } = useJoinLinkPreview(token);
  const { createProfile, isCreating } = useCreateProfile();
  const { acceptJoinLink, isAccepting } = useAcceptJoinLink();
  const {
    isGc,
    role,
    isLoading: isUserLoading,
  } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
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
      const { session } = await signUpWithEmail(values.email, values.password, {
        name: values.name,
        companyName: values.companyName,
        jobsiteJoinToken: token!,
      });

      if (session) {
        await createProfile({ accessToken: session.access_token });
        navigate("/projects");
      } else {
        // "Confirm email" is on: no session yet. The details are stored as
        // user_metadata and the profile (and the join) is finished on first
        // login, same as an ordinary signup.
        setConfirmationEmail(values.email);
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not join this job site.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignIn = () =>
    navigate("/login", { state: { from: location.pathname } });

  const onJoin = async () => {
    try {
      await acceptJoinLink(token!);
      navigate("/projects");
    } catch {
      // useAcceptJoinLink already surfaces the failure as a toast.
    }
  };

  if (isLoading || authLoading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Loading this job site's link…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (isError || !preview) {
    return (
      <StyledPage>
        <StyledHero aria-labelledby={HERO_ID}>
          <StyledHeroInner>
            <StyledEyebrow>Job site link</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              This job site link is invalid
            </StyledHeadline>
            <StyledLede>
              Ask the general contractor for a fresh QR code or link, or sign
              in if you already have an account.
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
            <StyledEyebrow>Job site link</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              Check your email
              <StyledHeadlineEmail>{confirmationEmail}</StyledHeadlineEmail>
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
    const canJoin = !isGc && role !== null && MANAGER_ROLES.includes(role);

    let blocker: string | null = null;
    if (isGc) {
      blocker =
        "General contractor accounts can't join another contractor's job site.";
    } else if (!canJoin) {
      blocker =
        "Only an admin or safety manager can join a job site for your company. Ask one of them to open this link.";
    }

    return (
      <StyledPage>
        <StyledHero aria-labelledby={HERO_ID}>
          <StyledHeroInner>
            <StyledEyebrow>Job site link</StyledEyebrow>
            <StyledHeadline id={HERO_ID}>
              Join {preview.jobsiteName ?? "this job site"}
            </StyledHeadline>
            <JoinBanner preview={preview} />

            {isUserLoading ? (
              <StyledStatus role="status" aria-live="polite">
                Checking your account…
              </StyledStatus>
            ) : blocker ? (
              // Unlike AcceptJobsiteInvite's email-mismatch case, neither
              // blocker here (wrong company type, wrong role) is fixed by
              // signing in as someone else on this same device — no Log out
              // offered, same as that page's own isGc/role blockers.
              <StyledLede role="alert">{blocker}</StyledLede>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                loading={isAccepting}
                onClick={onJoin}
              >
                Join this job site
              </Button>
            )}
          </StyledHeroInner>
        </StyledHero>
        <Footer />
      </StyledPage>
    );
  }

  const emailId = "join-jobsite-email";
  const companyId = "join-jobsite-company";
  const nameId = "join-jobsite-name";
  const passwordId = "join-jobsite-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby={HERO_ID}>
        <StyledHeroInner>
          <StyledEyebrow>Job site link</StyledEyebrow>
          <StyledHeadline id={HERO_ID}>
            Join {preview.jobsiteName ?? "this job site"} on TailgatePro
          </StyledHeadline>

          <JoinBanner preview={preview} />

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSignIn}
          >
            Already on TailgatePro? Sign in to join
          </Button>

          {showSignup ? (
            <Form onSubmit={handleSubmit(onSignup)} noValidate $onDark>
              <FormField
                id={emailId}
                label="Your email"
                error={errors.email?.message}
                onDark
              >
                <TextInput
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder="foreman@subcontractor.com"
                  hasError={!!errors.email}
                  {...register("email")}
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
