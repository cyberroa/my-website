export type ServiceItem = {
  id: string;
  title: string;
  preview: string;
  body: string;
  bullets: string[];
};

export const SERVICES: ServiceItem[] = [
  {
    id: "1",
    title: "Installation & De-Installation",
    preview: "Professional coordination and execution of equipment removal and re-installation.",
    body: "We handle every aspect of equipment transitions—from careful de-installation to precise re-installation—ensuring minimal downtime and seamless system integration.",
    bullets: [
      "Site assessment and planning",
      "Coordination with facility teams",
      "Minimal disruption to operations",
      "Post-installation verification",
    ],
  },
  {
    id: "2",
    title: "Transportation & Logistics",
    preview: "Secure, reliable transportation for imaging systems and components.",
    body: "Our logistics network ensures your equipment arrives safely and on time. We follow industry best practices for handling sensitive medical imaging systems.",
    bullets: [
      "Specialized packaging and crating",
      "Climate-controlled transport options",
      "Full tracking and documentation",
      "White-glove delivery when needed",
    ],
  },
  {
    id: "3",
    title: "Technical Training",
    preview: "On-site and remote training to equip your staff with confidence.",
    body: "Customized training programs designed to help your team operate systems efficiently, troubleshoot common issues, and maintain peak performance.",
    bullets: [
      "On-site and remote options",
      "Hands-on system operation",
      "Basic troubleshooting skills",
      "Documentation and best practices",
    ],
  },
  {
    id: "4",
    title: "System Sales",
    preview: "Refurbished and pre-owned CT and PET systems tailored to your needs.",
    body: "Quality refurbished systems for hospitals, imaging centers, and private practices. Each system is thoroughly tested and backed by our expertise.",
    bullets: [
      "GE PET/CT systems",
      "Pre-purchase consultation",
      "Installation and commissioning",
      "Warranty and support options",
    ],
  },
  {
    id: "5",
    title: "Service Contracts",
    preview: "Flexible agreements for ongoing maintenance and support.",
    body: "Ongoing maintenance, technical support, and performance optimization tailored to your facility's needs and budget.",
    bullets: [
      "Preventive maintenance schedules",
      "Priority response times",
      "Performance optimization",
      "Flexible terms",
    ],
  },
  {
    id: "6",
    title: "Parts & Support",
    preview: "Rapid access to OEM and refurbished parts with expert support.",
    body: "Keep your equipment operating at peak performance with fast access to quality parts and expert technical support when you need it.",
    bullets: [
      "OEM and refurbished parts",
      "Live inventory search",
      "Expert technical guidance",
      "Rapid shipping options",
    ],
  },
  {
    id: "7",
    title: "PET/CT Mechanical Audits & Inspections",
    preview: "Hands-on audits that extend equipment life and catch failures before downtime.",
    body: "Titan Imaging performs mechanical audits and inspections on GE PET/CT systems so biomedical teams can prioritize repairs, plan parts, and keep scanners productive longer—often at a fraction of OEM service premiums.",
    bullets: [
      "Mechanical and performance inspection",
      "Documented findings and repair recommendations",
      "Parts and follow-up coordination",
      "Service-contract and PM planning",
    ],
  },
];
