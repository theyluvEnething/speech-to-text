import React from "react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import AuthView from "@/views/AuthView";
import { MainApp } from "../MainApp";

export function RootComponent(): React.ReactElement {
  return (
    <>
      <SignedOut>
        <AuthView />
      </SignedOut>
      <SignedIn>
        <MainApp />
      </SignedIn>
    </>
  );
}