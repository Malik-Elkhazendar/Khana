import { environment } from '../../../environments/environment';
import { getLandingFooterLinks, LandingLocale } from './landing-links';

function extractHrefs(locale: LandingLocale): string[] {
  return getLandingFooterLinks(locale).footerSections.flatMap((section) =>
    section.links.map((link) => link.href)
  );
}

describe('landing-links', () => {
  it('provides non-placeholder href values for en and ar footer links', () => {
    const allHrefs = [...extractHrefs('en'), ...extractHrefs('ar')];

    expect(allHrefs.length).toBeGreaterThan(0);
    allHrefs.forEach((href) => {
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
      expect(href).not.toBe('/#');
      expect(href.trim()).toBe(href);
    });
  });

  it('keeps Arabic in-page links locale-safe on /ar', () => {
    const arHrefs = extractHrefs('ar');
    const arAnchorLinks = arHrefs.filter((href) => href.includes('#'));

    expect(arAnchorLinks.length).toBeGreaterThan(0);
    arAnchorLinks.forEach((href) => {
      expect(href.startsWith('/ar#')).toBe(true);
      expect(href.startsWith('/#')).toBe(false);
    });
  });

  it('keeps English in-page links on root landing', () => {
    const enHrefs = extractHrefs('en');
    const enAnchorLinks = enHrefs.filter((href) => href.includes('#'));

    expect(enAnchorLinks.length).toBeGreaterThan(0);
    enAnchorLinks.forEach((href) => {
      expect(href.startsWith('#')).toBe(true);
    });
  });

  it('maps social and legal links from environment.marketing', () => {
    const enLinks = getLandingFooterLinks('en');
    const arLinks = getLandingFooterLinks('ar');

    expect(enLinks.socialLinks).toEqual(environment.marketing.socialLinks);
    expect(arLinks.socialLinks).toEqual(environment.marketing.socialLinks);

    expect(enLinks.legalLinks).toEqual(environment.marketing.legalLinks);
    expect(arLinks.legalLinks).toEqual(environment.marketing.legalLinks);
  });
});
