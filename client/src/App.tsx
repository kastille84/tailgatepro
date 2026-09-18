import styled, { ThemeProvider } from "styled-components";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/auth";
import { PwaInstallProvider } from "./context/pwa-install";
import { OnlineStatusProvider } from "./context/online-status";

import GlobalStyles from "./styles/GlobalStyles";
import theme from "./styles/theme";
import { queryClient } from "./utils/queryClient";
// Registers how the offline queue replays a "project" outbox row — a
// side-effect import, loaded once here so it's in place before any Projects
// mutation can enqueue. See docs/offline-sync-design.md.
import "./services/projectReplayHandler";
// Same, for a "talk" outbox row.
import "./services/talkReplayHandler";
// Same, for "meeting_log", "crew_photo", and "meeting_completion" outbox rows.
import "./services/meetingLogReplayHandler";
// Same, for a "signature" outbox row.
import "./services/signatureReplayHandler";

import { Navbar } from "./ui_comps/navbar/Navbar";
import { ScrollToTop } from "./ui_comps/scroll-to-top";
import { SyncStatusBanner } from "./ui_comps/sync-status-banner";
import { RequireAuth } from "./features/authentication";

import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { ContentLibrary } from "./pages/ContentLibrary";
import { MeetingFlow } from "./pages/MeetingFlow";

// Pins Navbar + SyncStatusBanner together as one scroll-fixed block, so the
// banner never scrolls away from the nav it sits under.
const StyledStickyHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 1000;
`;

function App() {
  return (
    <div data-testid="app">
      <AuthProvider>
        <OnlineStatusProvider>
          <PwaInstallProvider>
            <ThemeProvider theme={theme}>
              <QueryClientProvider client={queryClient}>
                <ReactQueryDevtools
                  initialIsOpen={false}
                  buttonPosition="bottom-left"
                ></ReactQueryDevtools>
                <GlobalStyles />
                <BrowserRouter>
                  <ScrollToTop />
                  <StyledStickyHeader>
                    <Navbar />
                    <SyncStatusBanner />
                  </StyledStickyHeader>
                  <Routes>
                    <Route path="/" element={<Landing />}></Route>
                    <Route path="/landing" element={<Landing />}></Route>
                    <Route path="/pricing" element={<Pricing />}></Route>
                    <Route path="/login" element={<Login />}></Route>
                    <Route path="/signup" element={<Signup />}></Route>
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    ></Route>
                    <Route
                      path="/reset-password"
                      element={<ResetPassword />}
                    ></Route>
                    <Route element={<RequireAuth />}>
                      <Route
                        path="/dashboard"
                        element={<Dashboard />}
                      ></Route>
                      <Route path="/projects" element={<Projects />}></Route>
                      <Route
                        path="/talks"
                        element={<ContentLibrary />}
                      ></Route>
                      <Route
                        path="/meetings/new"
                        element={<MeetingFlow />}
                      ></Route>
                    </Route>
                  </Routes>
                </BrowserRouter>
                <Toaster
                  position="bottom-right"
                  gutter={12}
                  containerStyle={{ margin: "0.8rem" }}
                  toastOptions={{
                    success: {
                      duration: 3000,
                    },
                    error: {
                      duration: 6000,
                    },
                    style: {
                      fontSize: "1.6rem",
                      maxWidth: "50rem",
                      padding: "1.6rem 2.4rem",
                      backgroundColor: "var(--color-concrete-100)",
                      color: "var(--color-navy-700)",
                      opacity: 0,
                    },
                    ariaProps: {
                      role: "alert",
                      "aria-live": "polite",
                    },
                  }}
                />
              </QueryClientProvider>
            </ThemeProvider>
          </PwaInstallProvider>
        </OnlineStatusProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
