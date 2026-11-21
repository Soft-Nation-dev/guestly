import type { DocumentKind } from "@/types/experience";

export const hotel = {
  name: "Guestly",
  tagline: "Your comfort, our priority.",
  description: "A more thoughtful stay, from the moment you book to the moment you leave.",
  location: "Lagos, Nigeria",
  currency: "NGN",
  heroImage: "/images/deluxe-executive-suite.jpg",
  experiences: [
    { title: "A room for every stay", description: "Explore comfortable rooms and suites, find availability and choose your perfect space.", icon: "bed" },
    { title: "Pre-arrival check-in", description: "Submit your details before arriving and spend less time at the front desk.", icon: "key" },
    { title: "Personal concierge", description: "Get hotel assistance and request services during your stay.", icon: "chat" },
    { title: "Track your requests", description: "Follow the progress of your service requests from received to done.", icon: "list" },
  ],
  facilities: [
    { title: "Dining at Guestly", image: "/images/restaurant.jpg", description: "Enjoy a relaxed dining experience in welcoming surroundings." },
    { title: "Executive lounge", image: "/images/executive-lounge.jpg", description: "A comfortable space to unwind between plans." },
    { title: "Lagoon terrace pool", image: "/images/lagoon-terrace-pool.jpg", description: "Make time for a moment of relaxation." },
  ],
} as const;

export const roomImages = [
  "/images/standard-cozy-haven.jpg", "/images/deluxe-executive-suite.jpg",
  "/images/garden-view-room.jpg", "/images/ocean-panorama-suite.jpg",
  "/images/city-view-room.jpg", "/images/executive-suite.jpg",
];

export const documentKinds: DocumentKind[] = ["Passport", "National ID", "Driver's licence"];
