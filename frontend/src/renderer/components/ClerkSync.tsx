import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useStore } from "@/store";

function ClerkSync(): null {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const setIsAuthenticated = useStore((s) => s.setIsAuthenticated);

  useEffect(() => {
    if (isLoaded) {
      setIsAuthenticated(!!isSignedIn);
    }
  }, [isLoaded, isSignedIn, setIsAuthenticated]);

  return null;
}

export default ClerkSync;
