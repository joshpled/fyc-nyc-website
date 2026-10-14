/** Shared hero image settings so the <link rel=preload> matches the <picture> exactly. */
import { getImage } from 'astro:assets';
import poster from '../assets/img/video_poster.jpg';

export const HERO_WIDTHS = [640, 960, 1382];
export const HERO_SIZES = '100vw';
export const HERO_QUALITY = 70;

export async function heroPreload() {
  const img = await getImage({ src: poster, format: 'avif', widths: HERO_WIDTHS, sizes: HERO_SIZES, quality: HERO_QUALITY });
  return { href: img.src, srcset: img.srcSet.attribute, sizes: HERO_SIZES, type: 'image/avif' };
}
