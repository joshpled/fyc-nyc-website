/** JSON-LD builders. Everything comes from src/data so markup always matches the page. */
import site from '../data/site.json';
import { hours, toOpeningHoursSpec } from './hours';

const abs = (path: string) => new URL(path, site.url).toString();

export function restaurantSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'BarOrPub'],
    '@id': abs('/#restaurant'),
    name: site.name,
    alternateName: [site.shortName, 'FYC NYC', site.meaning],
    slogan: site.tagline,
    description: site.description,
    url: site.url,
    telephone: site.phoneE164,
    email: site.email,
    image: [abs('/og/og-default.jpg')],
    logo: abs('/og/logo.png'),
    priceRange: site.priceRange,
    servesCuisine: site.servesCuisine,
    acceptsReservations: true,
    hasMenu: abs('/menus/'),
    menu: abs('/menus/'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: site.links.googleMaps,
    areaServed: ['Flatiron', 'Chelsea', 'Union Square', 'Madison Square Park'],
    openingHoursSpecification: toOpeningHoursSpec(hours.bar),
    amenityFeature: site.amenities.map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
    // No aggregateRating: Google treats a business rating its own reviews as self-serving markup.
    sameAs: [site.social.instagram, site.social.facebook, site.booking.resyUrl, site.booking.opentableUrl],
    foundingDate: String(site.founded),
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: abs('/reserve/'),
        actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'],
      },
      result: { '@type': 'FoodEstablishmentReservation', name: 'Table reservation' },
    },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function faqSchema(faqs: { q: string; a: string | null }[]) {
  const answered = faqs.filter((f) => f.a);
  if (!answered.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: answered.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

type MenuItemData = { name: string | null; description?: string | null; price?: number | null; glass?: number | null; bottle?: number | null; tags?: string[]; placeholder?: boolean };
type MenuSectionData = { id: string; name: string; items: MenuItemData[] };

/** schema.org Menu for one menu page. Placeholder rows are skipped. */
export function menuSchema(opts: { name: string; path: string; sections: MenuSectionData[] }) {
  const diet: Record<string, string> = {
    vegetarian: 'https://schema.org/VegetarianDiet',
    'gluten-free': 'https://schema.org/GlutenFreeDiet',
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: opts.name,
    url: abs(opts.path),
    inLanguage: 'en-US',
    hasMenuSection: opts.sections
      .map((s) => ({
        '@type': 'MenuSection',
        name: s.name,
        hasMenuItem: s.items
          .filter((i) => !i.placeholder && i.name)
          .map((i) => {
            const price = i.price ?? i.glass ?? i.bottle;
            const suitable = (i.tags ?? []).map((t) => diet[t]).filter(Boolean);
            return {
              '@type': 'MenuItem',
              name: i.name,
              ...(i.description ? { description: i.description } : {}),
              ...(price != null ? { offers: { '@type': 'Offer', price: String(price), priceCurrency: 'USD' } } : {}),
              ...(suitable.length ? { suitableForDiet: suitable } : {}),
            };
          }),
      }))
      .filter((s) => s.hasMenuItem.length),
  };
}
