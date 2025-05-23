import { cookies } from 'next/headers';

import AppSidebarLayout from '@/components/sidebar-demo-2';
import { auth } from '../(auth)/auth';
import Script from 'next/script';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <div className="bg-white text-gray-900 min-h-screen">
        <AppSidebarLayout>{children}</AppSidebarLayout>
      </div>
    </>
  );
}
