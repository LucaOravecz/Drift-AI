import { useEffect, useRef, useCallback } from "react";

interface AutoSaveOptions {
  key: string;
  data: any;
  interval?: number;
  onSave?: (data: any) => void;
  enabled?: boolean;
}

/**
 * Hook for auto-saving form data to localStorage
 * Saves data at specified intervals and provides recovery functionality
 */
export function useAutoSave({
  key,
  data,
  interval = 5000, // 5 seconds
  onSave,
  enabled = true,
}: AutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastSavedRef = useRef<string | undefined>(undefined);

  const saveData = useCallback(() => {
    try {
      const serialized = JSON.stringify(data);

      // Only save if data has actually changed
      if (serialized !== lastSavedRef.current) {
        localStorage.setItem(`draft_${key}`, serialized);
        localStorage.setItem(`draft_${key}_timestamp`, new Date().toISOString());
        lastSavedRef.current = serialized;
        onSave?.(data);
      }
    } catch (error) {
      console.error("Failed to auto-save data:", error);
    }
  }, [data, key, onSave]);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(saveData, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, interval, enabled, saveData]);

  const getSavedData = useCallback(() => {
    try {
      const saved = localStorage.getItem(`draft_${key}`);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Failed to retrieve saved data:", error);
      return null;
    }
  }, [key]);

  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(`draft_${key}`);
      localStorage.removeItem(`draft_${key}_timestamp`);
    } catch (error) {
      console.error("Failed to clear saved data:", error);
    }
  }, [key]);

  const getSavedDataTimestamp = useCallback(() => {
    try {
      const timestamp = localStorage.getItem(`draft_${key}_timestamp`);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error("Failed to retrieve timestamp:", error);
      return null;
    }
  }, [key]);

  return {
    saveData,
    getSavedData,
    clearSavedData,
    getSavedDataTimestamp,
  };
}
