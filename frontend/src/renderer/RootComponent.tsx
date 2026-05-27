import React from "react";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import TitleBar from "@/components/TitleBar";
import AuthView from "@/views/AuthView";
import { MainApp } from "../MainApp";

export function RootComponent(): React.ReactElement {
  return (
    <div className="flex flex-col h-screen bg-background rounded-[20px] overflow-hidden window-enter">
      <TitleBar />
      <SignedOut>
        <AuthView />
      </SignedOut>
      <SignedIn>
        <MainApp />
      </SignedIn>
    </div>
  );
}