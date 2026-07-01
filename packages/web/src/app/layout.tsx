import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

import './globals.css';
import AppContent from '../components/AppContent';
import GoogleAnalytics from '../components/GoogleAnalytics';
import Providers from '../components/Providers';
import { getSystemSettings } from '../lib/system-settings';

export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSystemSettings(['analytics:ga4:web_measurement_id']);
  const settingValue = settings['analytics:ga4:web_measurement_id']?.trim() || '';
  const ga4MeasurementId = settingValue || process.env.NEXT_PUBLIC_GA4_WEB_ID;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {ga4MeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-web-init" strategy="afterInteractive">
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
        <Providers>
          <AppContent>{children}</AppContent>
        </Providers>
      </body>
    </html>
  );
}
