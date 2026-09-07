import type { Metadata } from "next";
import { HomePageContent } from "@/components/HomePageContent";

const HOME_DESCRIPTION =
  "Precision CT/PET parts and seamless service for hospitals and imaging centers. Browse inventory, request support, and partner with Titan Imaging Service.";

export const metadata: Metadata = {
  title: "CT & PET Parts & Service",
  description: HOME_DESCRIPTION,
  openGraph: {
    title: "Titan Imaging Service | CT & PET Parts & Service",
    description: HOME_DESCRIPTION,
    url: "/",
  },
  twitter: {
    title: "Titan Imaging Service | CT & PET Parts & Service",
    description: HOME_DESCRIPTION,
  },
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <HomePageContent variant="production" />;
}
