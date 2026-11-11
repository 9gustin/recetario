import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Inter } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { DayPartProvider } from "@/components/theme/day-part-provider";
import { BRAND } from "@/lib/brand";
import {
  DAY_PART_COOKIE,
  THEME_COLORS,
  parseDayPartPreference,
  resolveDayPart,
} from "@/lib/theme/day-part";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

async function getTheme() {
  const store = await cookies();
  const preference = parseDayPartPreference(store.get(DAY_PART_COOKIE)?.value);
  return { preference, dayPart: resolveDayPart(preference) };
}

export async function generateViewport(): Promise<Viewport> {
  const { dayPart } = await getTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: THEME_COLORS[dayPart],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { preference, dayPart } = await getTheme();
  return (
    <html
      lang="es-AR"
      data-daypart={dayPart}
      className={cn("h-full antialiased", inter.variable, dmSerif.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">
        <DayPartProvider initialDayPart={dayPart} initialPreference={preference}>
          <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
            {children}
          </SerwistProvider>
          <Toaster />
        </DayPartProvider>
      </body>
    </html>
  );
}
