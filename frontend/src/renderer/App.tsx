import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/clerk";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClerkSync from "@/components/ClerkSync";
import { RootComponent } from "./RootComponent";

function App(): React.ReactElement {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ErrorBoundary>
        <ClerkSync />
        <RootComponent />
      </ErrorBoundary>
    </ClerkProvider>
  );
}

export default App;
