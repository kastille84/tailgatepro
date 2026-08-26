import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import { Toaster } from "react-hot-toast";

import GlobalStyles from "./styles/GlobalStyles";

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
      <QueryClientProvider client={queryClient}>
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        ></ReactQueryDevtools>
        <GlobalStyles />
        <BrowserRouter>
          <Routes>
            <Route path="/landing" element={<p>Hey</p>}></Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          gutter={12}
          containerStyle={{ margin: "8px" }}
          toastOptions={{
            success: {
              duration: 3000,
            },
            error: {
              duration: 6000,
            },
            style: {
              fontSize: "16px",
              maxWidth: "500px",
              padding: "16px 24px",
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
    </div>
  );
}

export default App;
