import { IMAGES } from "@/lib/images";
import { getSiteUrl } from "@/lib/site";

const DESCRIPTION =
  "CT/PET parts, service, and support—precision parts and seamless service for medical imaging centers and hospitals nationwide.";

export function SiteJsonLd() {
  const url = getSiteUrl();
  const graph = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name: "Titan Imaging Service",
      description: DESCRIPTION,
      url,
      logo: `${url}${IMAGES.logo}`,
      image: `${url}${IMAGES.prototypeHero}`,
      telephone: "+1-904-742-6265",
      email: "info@test.com",
      areaServed: {
        "@type": "Country",
        name: "United States",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}/#website`,
      name: "Titan Imaging Service",
      description: DESCRIPTION,
      url,
      publisher: { "@id": `${url}/#organization` },
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${url}/inventory?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
