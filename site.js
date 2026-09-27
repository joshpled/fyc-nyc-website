const page = document.body.dataset.page;

const links = [
  ['home', 'Home', 'index.html'],
  ['menu', 'Food & drinks', 'menu.html'],
  ['gather', 'Gather', 'gather.html'],
  ['visit', 'Visit', 'visit.html'],
];

const navLinks = links.map(([key, label, href]) =>
  `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`
).join('');

document.getElementById('site-header').innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="index.html" aria-label="F.Y.C. / N.Y.C. home"><span>F.Y.C.</span><span>N.Y.C.</span></a>
    <nav class="main-nav" id="main-nav" aria-label="Main navigation">${navLinks}</nav>
    <a class="header-book" href="https://resy.com/cities/new-york-ny/venues/fyc-nyc?seats=" target="_blank" rel="noopener">Book a table <span aria-hidden="true">↗</span></a>
    <button class="menu-toggle" type="button" aria-label="Open menu" aria-controls="main-nav" aria-expanded="false"><span></span><span></span></button>
  </header>
`;

document.getElementById('site-footer').innerHTML = `
  <footer class="site-footer">
    <div class="site-footer__top">
      <div><p class="eyebrow">FAMILY. YOU. CHOOSE.</p><div class="footer-wordmark">F.Y.C. <span>/</span> N.Y.C.</div></div>
      <div class="site-footer__nav" aria-label="Footer navigation">${navLinks}</div>
      <div class="site-footer__actions"><a href="https://resy.com/cities/new-york-ny/venues/fyc-nyc?seats=" target="_blank" rel="noopener">Reservations <span aria-hidden="true">↗</span></a><a href="https://order.toasttab.com/egiftcards/fyc-nyc-44-west-17th-street" target="_blank" rel="noopener">Gift cards <span aria-hidden="true">↗</span></a><a href="https://www.instagram.com/thefycnyc/" target="_blank" rel="noopener">Instagram <span aria-hidden="true">↗</span></a></div>
    </div>
    <div class="site-footer__bottom"><span>44 West 17th Street · New York, NY 10011</span><span>© F.Y.C. / N.Y.C.</span></div>
  </footer>
`;

const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.getElementById('main-nav');

menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mainNav.classList.toggle('is-open', open);
});

mainNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open menu');
    mainNav.classList.remove('is-open');
  }
});

// The restaurant photos are supplied locally but excluded from the public repo.
// A fresh public checkout stays readable until the approved photos are provided.
document.querySelectorAll('img').forEach((img) => {
  const showPlaceholder = () => {
    if (img.dataset.placeholderShown === 'true') return;
    img.dataset.placeholderShown = 'true';
    img.alt = 'F.Y.C. / N.Y.C. brand placeholder';
    img.src = 'assets/photo-placeholder.svg';
  };

  img.addEventListener('error', showPlaceholder, { once: true });
  if (img.complete && img.naturalWidth === 0) showPlaceholder();
});
