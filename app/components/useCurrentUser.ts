"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export type CurrentUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

export function useCurrentUser() {
  const router = useRouter();
  const storedUser = useSyncExternalStore(
    (callback) => {
      window.addEventListener("storage", callback);
      return () => window.removeEventListener("storage", callback);
    },
    () => localStorage.getItem("user") ?? "",
    () => "__loading__"
  );

  const user = useMemo(() => {
    if (!storedUser || storedUser === "__loading__") return null;
    try {
      const parsedUser = JSON.parse(storedUser) as CurrentUser;
      return Number.isSafeInteger(parsedUser.user_id) && parsedUser.user_id > 0
        ? parsedUser
        : null;
    } catch {
      return null;
    }
  }, [storedUser]);

  const loaded = storedUser !== "__loading__";

  useEffect(() => {
    if (loaded && !user) {
      router.replace("/");
    }
  }, [loaded, router, user]);

  return { user, loaded };
}