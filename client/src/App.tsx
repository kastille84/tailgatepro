import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/auth";

import GlobalStyles from "./styles/GlobalStyles";
import theme from "./styles/theme";

import { Navbar } from "./ui_comps/navbar/Navbar";
import { ScrollToTop } from "./ui_comps/scroll-to-top";

import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime: 60 * 1000,
      staleTime: 0,
      gcTime: 0,
    },
  },
});

function App() {
  return (
    <div data-testid="app">
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            ></ReactQueryDevtools>
            <GlobalStyles />
            <BrowserRouter>
              <ScrollToTop />
              <Navbar />
              <Routes>
                <Route path="/landing" element={<Landing />}></Route>
                <Route path="/pricing" element={<Pricing />}></Route>
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
      </AuthProvider>
    </div>
  );
}

export default App;
