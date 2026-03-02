import type { Metadata } from "next";
import { Inter, Courier_Prime } from "next/font/google";
import "./globals.css";
import { SidebarWrapper } from "@/components/sidebar-wrapper";
import { AuthProvider } from "@/components/auth-provider";
import { BackgroundOrderWorker } from "@/components/background-order-worker";

const inter = Inter({ subsets: ["latin"] });
const courierPrime = Courier_Prime({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-courier-prime',
});

export const metadata: Metadata = {
  title: "JB - Store",
  description: "Point of Sale System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${courierPrime.variable}`}>
        <AuthProvider>
          <BackgroundOrderWorker />
          <div className="flex h-screen w-full overflow-hidden bg-background">
            <SidebarWrapper />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
