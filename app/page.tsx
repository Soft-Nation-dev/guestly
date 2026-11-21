import Image from "@/components/ui/hotel-image";
import Link from "@/components/navigation/app-link";
import { SiteShell } from "@/components/layout/site-shell";
import { FeaturedRooms } from "@/components/public/featured-rooms";
import { StaySearch } from "@/components/public/stay-search";
import { Icon } from "@/components/ui/icon";
import { HotelHero } from "@/components/public/hotel-hero";
import { hotel } from "@/data/hotel";

export default function Home() {
  return <SiteShell>
    <div className="shell home-content">
      <HotelHero />
      <section className="panel reserve-panel" id="reserve" aria-labelledby="reserve-title">
        <div className="section-heading"><div><span className="eyebrow">Make yourself at home</span><h2 id="reserve-title">Reserve your stay</h2><p>Choose your dates and find a room that suits you.</p></div></div>
        <StaySearch />
      </section>
      <section className="tip-banner">
        <div className="feature-icon"><Icon name="key" width={24} height={24} /></div>
        <div><strong>Arriving soon?</strong><p>With pre-arrival check-in, you can submit your details before reaching the hotel.</p></div>
      </section>
      <section id="experience" className="content-section">
        <div className="section-heading"><div><span className="eyebrow">Designed around you</span><h2>Seamless guest experiences</h2><p>Everything you need for a smoother stay.</p></div></div>
        <div className="experience-grid">{hotel.experiences.map((experience) => <article className="panel experience-card" key={experience.title}><span className="feature-icon"><Icon name={experience.icon} width={24} height={24} /></span><h3>{experience.title}</h3><p>{experience.description}</p></article>)}</div>
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="eyebrow">Find your retreat</span><h2>Featured rooms &amp; suites</h2><p>Thoughtful spaces for work, rest and everything in between.</p></div><Link href="/rooms" className="text-link">View all rooms <Icon name="arrow" /></Link></div>
        <FeaturedRooms />
      </section>
      <section className="content-section">
        <div className="section-heading"><div><span className="eyebrow">More than a room</span><h2>Explore Guestly</h2><p>Discover spaces to dine, relax and recharge.</p></div></div>
        <div className="facility-grid">{hotel.facilities.map((facility) => <article className="facility-card" key={facility.title}><div className="facility-image"><Image src={facility.image} alt={facility.title} fill sizes="(max-width: 640px) 100vw, 33vw" /></div><div><h3>{facility.title}</h3><p>{facility.description}</p></div></article>)}</div>
      </section>
      <section className="closing-banner"><div><h2>Make your next stay effortless.</h2><p>Find the room that feels right for you.</p></div><Link className="button button-white" href="/rooms">Explore rooms <Icon name="arrow" /></Link></section>
    </div>
  </SiteShell>;
}
