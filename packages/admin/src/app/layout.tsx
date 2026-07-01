import type { Metadata } from 'next';
import Script from 'next/script';
import { Providers } from '@/components/Providers';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { getSetting } from '@/lib/settings';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Console — Faces of Plants',
  description: 'Administration console for Faces of Plants',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const runtimeSetting = await getSetting('analytics:ga4:admin_measurement_id');
  const settingValue = runtimeSetting?.settingValue?.trim() || '';
  const ga4MeasurementId = settingValue || process.env.NEXT_PUBLIC_GA4_ADMIN_ID;

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {ga4MeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-admin-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${ga4MeasurementId}', {
                  send_page_view: false,
                  anonymize_ip: true
                });
              `}
            </Script>
            <GoogleAnalytics measurementId={ga4MeasurementId} />
          </>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
