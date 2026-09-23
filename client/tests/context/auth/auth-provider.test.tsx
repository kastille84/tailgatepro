import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

// vi.mock's factory below is hoisted above these — vi.hoisted() is what lets
// the mock fns it references exist by the time that happens.
const { getSessionMock, onAuthStateChangeMock, unsubscribeMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    unsubscribeMock: vi.fn(),
  }),
);

// AuthProvider constructs its Supabase client at module load time
// (`createClient(...)` is a top-level call), so this mock must be in place
// before the module under test is ever imported -- vi.mock calls are
// hoisted above imports, which is what makes that safe here.
vi.mock("@supabase/supabase-js", async () => {
  const actual =
    await vi.importActual<typeof import("@supabase/supabase-js")>(
      "@supabase/supabase-js",
    );
  return {
    ...actual,
    createClient: () => ({
      auth: {
        getSession: getSessionMock,
        onAuthStateChange: onAuthStateChangeMock,
        signInWithOAuth: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn(),
      },
    }),
  };
});

vi.mock("../../../src/services/apiUsers", () => ({
  createProfile: vi.fn(),
}));

import { AuthProvider } from "../../../src/context/auth";
import * as apiUsers from "../../../src/services/apiUsers";

const makeSession = (userId: string): Session =>
  ({
    access_token: `token-${userId}`,
    user: { id: userId },
  }) as Session;

const renderProvider = () =>
  render(
    <AuthProvider>
      <div data-testid="child" />
    </AuthProvider>,
  );

describe("AuthProvider: ensureProfile safety net", () => {
  let authStateChangeCallback: (
    event: string,
    session: Session | null,
  ) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockImplementation((callback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    });
    vi.mocked(apiUsers.createProfile).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls createProfile once getSession resolves with a session (the confirm-link auto-login case)", async () => {
    // This is the case that previously fell through every existing call
    // site: no manual login, no signup-page submit -- just an already-
    // established session by the time the provider mounts.
    const session = makeSession("user-1");
    getSessionMock.mockResolvedValue({ data: { session } });

    renderProvider();

    await waitFor(() =>
      expect(apiUsers.createProfile).toHaveBeenCalledWith({
        accessToken: "token-user-1",
      }),
    );
  });

  it("does not call createProfile when getSession resolves with no session", async () => {
    renderProvider();

    await waitFor(() => expect(getSessionMock).toHaveBeenCalled());
    expect(apiUsers.createProfile).not.toHaveBeenCalled();
  });

  it("calls createProfile when onAuthStateChange fires with a session", async () => {
    renderProvider();
    await waitFor(() => expect(onAuthStateChangeMock).toHaveBeenCalled());

    const session = makeSession("user-2");
    act(() => authStateChangeCallback("SIGNED_IN", session));

    await waitFor(() =>
      expect(apiUsers.createProfile).toHaveBeenCalledWith({
        accessToken: "token-user-2",
      }),
    );
  });

  it("does not re-call createProfile for the same user id on a later event (dedupe)", async () => {
    const session = makeSession("user-3");
    getSessionMock.mockResolvedValue({ data: { session } });

    renderProvider();
    await waitFor(() =>
      expect(apiUsers.createProfile).toHaveBeenCalledTimes(1),
    );

    // Simulate a token refresh for the same user -- must not re-POST.
    act(() => authStateChangeCallback("TOKEN_REFRESHED", session));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiUsers.createProfile).toHaveBeenCalledTimes(1);
  });

  it("calls createProfile again for a different user id", async () => {
    const first = makeSession("user-4");
    getSessionMock.mockResolvedValue({ data: { session: first } });

    renderProvider();
    await waitFor(() =>
      expect(apiUsers.createProfile).toHaveBeenCalledTimes(1),
    );

    const second = makeSession("user-5");
    act(() => authStateChangeCallback("SIGNED_IN", second));

    await waitFor(() =>
      expect(apiUsers.createProfile).toHaveBeenCalledTimes(2),
    );
    expect(apiUsers.createProfile).toHaveBeenLastCalledWith({
      accessToken: "token-user-5",
    });
  });

  it("does not call createProfile when onAuthStateChange fires with no session (signed out)", async () => {
    renderProvider();
    await waitFor(() => expect(onAuthStateChangeMock).toHaveBeenCalled());

    act(() => authStateChangeCallback("SIGNED_OUT", null));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiUsers.createProfile).not.toHaveBeenCalled();
  });

  it("swallows a createProfile rejection without throwing or blocking rendering", async () => {
    vi.mocked(apiUsers.createProfile).mockRejectedValue(
      new Error("network down"),
    );
    const session = makeSession("user-6");
    getSessionMock.mockResolvedValue({ data: { session } });

    const { findByTestId } = renderProvider();

    await waitFor(() => expect(apiUsers.createProfile).toHaveBeenCalled());
    expect(await findByTestId("child")).toBeDefined();
  });
});
