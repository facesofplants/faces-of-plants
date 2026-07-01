'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type GtagPayload = Record<string, string | number | boolean | undefined>;

type GtagFunction = (command: string, eventNameOrConfig: string | Date, payload?: GtagPayload) => void;

interface AnalyticsWindow extends Window {
  gtag?: GtagFunction;
}

interface GoogleAnalyticsProps {
  measurementId: string;
}

export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const windowWithAnalytics = window as AnalyticsWindow;
    if (!windowWithAnalytics.gtag) {
      return;
    }

    const safePathname = pathname ?? '/';
    const query = searchParams?.toString() ?? '';
    const pagePath = query ? `${safePathname}?${query}` : safePathname;

    windowWithAnalytics.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: pagePath,
      send_to: measurementId,
    });
  }, [measurementId, pathname, searchParams]);

  return null;
}