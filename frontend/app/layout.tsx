import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from '../context/ThemeContext';

export const metadata: Metadata = {
  title: 'LPU - Smart Faculty Attendance System',
  description: 'Lovely Professional University Geo-Verified Biometric Attendance Platform.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LPU Attendance',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#5B45F5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('lpu-theme');
                  var isDark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="h-full bg-[#F5F7FC] dark:bg-[#0B1120] text-[#17233F] dark:text-[#F1F5F9] flex flex-col font-sans selection:bg-[#F1EDFF] dark:selection:bg-indigo-950/70 selection:text-[#5B45F5] dark:selection:text-indigo-300 transition-colors duration-150"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
