import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FcGoogle } from "react-icons/fc";
import toast from "react-hot-toast";

import { useAuth } from "../../context/auth";
import { Button } from "../../ui_comps/button";
import { Footer } from "../../ui_comps/footer";
import { Form, FormField, TextInput } from "../../ui_comps/form";
import {
  StyledPage,
  StyledHero,
  StyledHeroInner,
  StyledEyebrow,
  StyledHeadline,
  StyledLede,
  StyledDivider,
  StyledLinkRow,
  StyledLink,
  StyledStatus,
} from "./Login.styles";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export const Login = () => {
  const { user, loading, loginWithGoogle, loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
  });

  const handleGoogleLogin = async () => {
    setIsConnecting(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.error("We couldn't start Google sign-in. Please try again.");
      setIsConnecting(false);
    }
  };

  const onSubmit = async (values: LoginValues) => {
    setIsSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StyledPage>
        <StyledStatus role="status" aria-live="polite">
          Checking your session…
        </StyledStatus>
      </StyledPage>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const emailId = "login-email";
  const passwordId = "login-password";

  return (
    <StyledPage>
      <StyledHero aria-labelledby="login-hero-heading">
        <StyledHeroInner>
          <StyledEyebrow>Sign in</StyledEyebrow>
          <StyledHeadline id="login-hero-heading">
            Welcome back to TailgatePro
          </StyledHeadline>
          <StyledLede>
            Sign in to get to your toolbox talks, meeting logs, and compliance
            dashboard.
          </StyledLede>

          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<FcGoogle aria-hidden="true" />}
            loading={isConnecting}
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </Button>

          <StyledDivider>or</StyledDivider>

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
                autoComplete="current-password"
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
              loading={isSubmitting}
            >
              Sign in
            </Button>
          </Form>

          <StyledLinkRow>
            <StyledLink to="/forgot-password">Forgot password?</StyledLink>
            <StyledLink to="/signup">Create an account</StyledLink>
          </StyledLinkRow>
        </StyledHeroInner>
      </StyledHero>
      <Footer />
    </StyledPage>
  );
};
