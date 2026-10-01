import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppSettings = {
  currency: string;
  vatRate: number;
  depositPercent: number;
  travelAlertDays: number;
  soonFilterDays: number;
  pageSize: number;
  wordpressUrl: string;
  whatsappNumber: string;
  notifyDueSoon: boolean;
  notifyNewLead: boolean;
  autoClassifyWhatsapp: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "EGP",
  vatRate: 14,
  depositPercent: 25,
  travelAlertDays: 45,
  soonFilterDays: 30,
  pageSize: 8,
  wordpressUrl: "",
  whatsappNumber: "",
  notifyDueSoon: true,
  notifyNewLead: true,
  autoClassifyWhatsapp: true,
};

const STORAGE_KEY = "tawaf-crm-settings";

type SettingsCtx = {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
};

// singleton عبر globalThis حتى لا ينشئ HMR سياقاً مكرراً
const g = globalThis as unknown as { __settingsContext?: React.Context<SettingsCtx | null> };
const SettingsContext = (g.__settingsContext ??= createContext<SettingsCtx | null>(null));

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) });
    } catch {
      /* تجاهل */
    }
  }, []);

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      update: (patch) =>
        setSettings((prev) => {
          const next = { ...prev, ...patch };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* تجاهل */
          }
          return next;
        }),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
