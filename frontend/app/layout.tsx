import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { IMAGES } from "@/lib/images";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-orbitron",
});

const siteUrl = getSiteUrl();
const defaultDescription =
  "CT/PET parts, service, and support—precision parts and seamless service for medical imaging centers and hospitals nationwide.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CT & PET Parts & Service | TITAN IMAGING",
    template: "%s | TITAN IMAGING",
  },
  description: defaultDescription,
  applicationName: "Titan Imaging Service",
  keywords: [
    "CT parts",
    "PET parts",
    "PET/CT",
    "medical imaging parts",
    "imaging service",
    "GE PET/CT",
    "CT scanner",
    "PET scanner",
    "refurbished imaging equipment",
    "Jacksonville Florida",
  ],
  authors: [{ name: "Titan Imaging Service" }],
  creator: "Titan Imaging Service",
  publisher: "Titan Imaging Service",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Titan Imaging Service",
    title: "Titan Imaging Service | CT & PET Solutions",
    description: defaultDescription,
    images: [
      {
        url: IMAGES.prototypeHero,
        width: 1920,
        height: 1080,
        alt: "Titan Imaging Service — medical imaging parts and service",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Titan Imaging Service | CT & PET Solutions",
    description: defaultDescription,
    images: [IMAGES.prototypeHero],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased text-white">
        <SiteJsonLd />
        {children}
      </body>
    </html>
  );
}
