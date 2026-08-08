"use client";

import { useEffect, useState } from "react";
import type { CrmSnapshot } from "@/features/crm/types";

export function useCrm() {
  const [data, setData] = useState<CrmSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCrmData() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/crm");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load CRM data"));
      } finally {
        setIsLoading(false);
      }
    }

    fetchCrmData();
  }, []);

  const refetch = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/crm");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load CRM data"));
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
}

export function useCrmAction() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (action: any) => {
    try {
      setIsPending(true);
      setError(null);
      const response = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An error occurred");
      setError(error);
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  const reset = () => {
    setError(null);
    setIsPending(false);
  };

  return { mutateAsync, isPending, error, reset };
}
