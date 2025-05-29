import type {Metadata} from 'next';
// import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// const geistSans = GeistSans;
// const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'FruitFlow Supplier Portal',
  description: 'Streamlined order and payment management for fruit suppliers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
