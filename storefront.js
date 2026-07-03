(() => {
  const app = document.getElementById('storefront-app');
  const toastEl = document.getElementById('toast');
  let state = { storefront: null, collections: [], products: [], selectedCollection: 'all', cart: [], product: null };
  let unsub = null;

  const qs = new URLSearchParams(location.search);
  const requestedSite = qs.get('site') || window.COMMERCE_CONFIG?.defaultStorefront || 'aerune';
  const cartKey = (slug) => `commerce_cart_${slug || requestedSite}`;
  const toast = (message) => { toastEl.textContent = message; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 2800); };
  const getCart = () => { try { return JSON.parse(localStorage.getItem(cartKey(state.storefront?.slug)) || '[]'); } catch (_) { return []; } };
  const saveCart = () => localStorage.setItem(cartKey(state.storefront?.slug), JSON.stringify(state.cart));
  const totalQty = () => state.cart.reduce((n, x) => n + Number(x.quantity || 0), 0);
  const itemFor = (id) => state.products.find(x => x.id === id);
  const visibleProducts = () => state.products.filter(p => state.selectedCollection === 'all' || p.collection?.id === state.selectedCollection);

  function visual(product, className = '') {
    if (product.image_url) return `<div class="product-visual ${className}"><img src="${Core.text(product.image_url)}" alt="${Core.text(product.title)}" /></div>`;
    return `<div class="product-visual ${className}" aria-label="${Core.text(product.title)} product placeholder"><div class="visual-pack"></div></div>`;
  }
  function stockPill(product) {
    const status = Core.stockState(product);
    if (status === 'out_of_stock') return `<span class="pill danger">Sold out</span>`;
    if (status === 'low_stock') return `<span class="pill warn">Low stock</span>`;
    return `<span class="pill good">In stock</span>`;
  }
  function productCard(product) {
    const price = product.effective_price_npr ?? product.price_npr;
    return `<article class="product-card">
      ${visual(product)}
      <div class="card-content">
        <div class="card-top"><h3>${Core.text(product.title)}</h3>${stockPill(product)}</div>
        <p class="tagline">${Core.text(product.badges || product.collection?.name || 'Field-tested carry')}</p>
        <div class="price">${Core.money(price, state.storefront.currency)}${Number(product.compare_at_npr || 0) > price ? `<span class="compare">${Core.money(product.compare_at_npr, state.storefront.currency)}</span>` : ''}</div>
        <div class="product-actions"><button class="link-btn" data-view-product="${product.id}">View details</button><button class="soft-btn btn-sm" ${Core.stockState(product) === 'out_of_stock' ? 'disabled' : ''} data-add-product="${product.id}">Add</button></div>
      </div>
    </article>`;
  }
  function heroMedia(storefront) {
    const url = String(storefront?.hero_media_url || '').trim();
    if (!url) return '';
    const isVideo = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url);
    return `<div class="hero-media" aria-hidden="true">${isVideo ? `<video src="${Core.text(url)}" autoplay muted loop playsinline></video>` : `<img src="${Core.text(url)}" alt="" />`}</div>`;
  }
  function render() {
    if (!state.storefront) { app.innerHTML = `<main class="section"><div class="empty"><b>No published storefront was found.</b><br>Open <code>admin.html</code> and publish a storefront, or use <code>?site=aerune</code>.</div></main>`; return; }
    const products = visibleProducts();
    document.title = `${state.storefront.name} — ${state.storefront.hero_title || 'Official Store'}`;
    app.innerHTML = `<div class="theme-${Core.text(state.storefront.theme || 'alpine')}">
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="./?site=${encodeURIComponent(state.storefront.slug)}"><span class="brand-mark">${Core.text(state.storefront.mark || state.storefront.name.slice(0,2))}</span><span>${Core.text(state.storefront.name)}<small>${Core.text(state.storefront.announcement || 'Official online store')}</small></span></a>
          <nav class="nav"><a href="#shop">Shop</a><a href="#collections">Collections</a><a href="#story">Field notes</a><a href="admin.html">Control Booth</a></nav>
          <div class="header-actions"><a class="ghost-btn btn-sm" href="pos.html">POS</a><button class="icon-btn cart-count" data-open-cart aria-label="Open cart">⌑${totalQty() ? `<b>${totalQty()}</b>` : ''}</button></div>
        </div>
      </header>
      <main>
        <section class="hero">
          <div class="terrain"></div>${heroMedia(state.storefront)}
          <div class="hero-inner">
            <div class="hero-copy"><div class="eyebrow">${Core.text(state.storefront.hero_eyebrow || 'Independent technical carry')}</div><h1>${Core.text(state.storefront.hero_title || 'Carry further.')}</h1><p>${Core.text(state.storefront.hero_subtitle || '')}</p><div class="hero-buttons"><a class="dark-btn" href="#shop">${Core.text(state.storefront.primary_cta || 'Explore products')} →</a><a class="ghost-btn" href="#story">${Core.text(state.storefront.secondary_cta || 'Our story')}</a></div></div>
            <div class="hero-pack" aria-hidden="true"></div>
          </div>
        </section>
        <section class="section" id="collections"><div class="section-head"><div><div class="eyebrow" style="color:var(--moss)">COLLECTION WORLDS</div><h2>Built around the way you move.</h2></div><p>Each collection is managed from your Control Booth. Reorder it, rename it, hide it, and change its story without touching code.</p></div><div class="collection-rail">${state.collections.slice(0,3).map((c,i) => `<a href="#shop" class="collection-card" data-collection-link="${c.id}"><small>0${i+1} / ${Core.text(c.handle || 'collection')}</small><h3>${Core.text(c.name)}</h3><p>${Core.text(c.description || 'A focused system for movement.')}</p></a>`).join('') || `<div class="empty">Create collections in your Control Booth.</div>`}</div></section>
        <section class="section" id="shop" style="padding-top:34px"><div class="section-head"><div><div class="eyebrow" style="color:var(--moss)">SHOP THE SYSTEM</div><h2>Selected for the next departure.</h2></div><div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end"><button class="category-tab ${state.selectedCollection==='all'?'active':''}" data-filter="all">All pieces</button>${state.collections.map(c => `<button class="category-tab ${state.selectedCollection===c.id?'active':''}" data-filter="${c.id}">${Core.text(c.name)}</button>`).join('')}</div></div><div class="product-grid">${products.length ? products.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1">No published pieces in this collection yet.</div>`}</div></section>
        <section class="section" id="story" style="padding-top:15px"><div class="panel" style="background:var(--moss);color:#fff;border:0;padding:42px;border-radius:22px"><div class="eyebrow">MADE FOR THE LONG WAY HOME</div><h2 style="font-family:Georgia,serif;font-size:clamp(35px,4vw,60px);font-weight:500;letter-spacing:-.06em;max-width:650px;margin:0 0 15px">Small details matter when the trail gets serious.</h2><p style="max-width:600px;color:rgba(255,255,255,.75);line-height:1.65;margin:0">${Core.text(state.storefront.footer_note || 'Designed in Nepal. Built for the long way home.')}</p></div></section>
      </main>
      <footer style="border-top:1px solid var(--line);padding:35px 28px"><div style="max-width:var(--max);margin:auto;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;color:var(--muted);font-size:13px"><span>© ${new Date().getFullYear()} ${Core.text(state.storefront.name)}.</span><span>Customer storefront · live product data · controlled from one place.</span></div></footer>
      ${renderCart()}${state.product ? renderProductModal(state.product) : ''}</div>`;
  }
  function renderCart() {
    const details = state.cart.map(c => ({ ...c, product: itemFor(c.product_id) })).filter(x => x.product);
    const amount = details.reduce((n, x) => n + (x.product.effective_price_npr ?? x.product.price_npr) * x.quantity, 0);
    return `<aside class="drawer" id="cart-drawer"><div class="drawer-head"><div><b>Your field kit</b><div style="font-size:12px;color:var(--muted);margin-top:4px">${totalQty()} item${totalQty()===1?'':'s'}</div></div><button class="icon-btn" data-close-cart>×</button></div><div class="drawer-body">${details.length ? details.map(x => `<div class="cart-item"><div class="mini-visual">${x.product.image_url ? `<img src="${Core.text(x.product.image_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />` : `<div class="visual-pack"></div>`}</div><div><h4>${Core.text(x.product.title)}</h4><p>${Core.money(x.product.effective_price_npr ?? x.product.price_npr, state.storefront.currency)}</p><div class="qty"><button data-qty="${x.product_id}" data-change="-1">−</button><b>${x.quantity}</b><button data-qty="${x.product_id}" data-change="1">+</button></div></div><button class="link-btn" data-remove-cart="${x.product_id}" aria-label="Remove">×</button></div>`).join('') : `<div class="empty">Your kit is empty.<br>Find a piece that takes you further.</div>`}</div><div class="drawer-foot"><div class="total-line"><span>Total</span><span>${Core.money(amount, state.storefront.currency)}</span></div><button class="dark-btn" style="width:100%" data-checkout ${details.length?'':'disabled'}>Continue to checkout</button><p style="margin:10px 0 0;color:var(--muted);font-size:11px;line-height:1.45">Checkout accepts delivery details and records the order in your central dashboard. Connect a payment gateway later when you are ready.</p></div></aside>`;
  }
  function renderProductModal(product) {
    const price = product.effective_price_npr ?? product.price_npr;
    return `<div class="modal-backdrop" data-close-product-modal><section class="modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()"><div class="modal-header"><h3>${Core.text(product.title)}</h3><button class="icon-btn" data-close-product-modal>×</button></div><div class="modal-body"><div style="border-radius:15px;overflow:hidden;margin-bottom:18px">${visual(product)}</div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px">${stockPill(product)}<b style="font-size:20px">${Core.money(price,state.storefront.currency)}</b></div><p style="line-height:1.65;color:var(--muted)">${Core.text(product.description || '')}</p><div class="notice">${Core.text(product.badges || 'Designed for movement.')}</div></div><div class="modal-footer"><button class="ghost-btn" data-close-product-modal>Close</button><button class="dark-btn" data-add-product="${product.id}" ${Core.stockState(product)==='out_of_stock'?'disabled':''}>Add to kit</button></div></section></div>`;
  }
  function checkoutModal() {
    const modal = document.createElement('div'); modal.className = 'modal-backdrop'; modal.id = 'checkout-modal';
    modal.innerHTML = `<section class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h3>Checkout</h3><button class="icon-btn" data-close-checkout>×</button></div><form id="checkout-form"><div class="modal-body"><div class="notice" style="margin-bottom:16px">This starter checkout records the order and reserves the stock. Choose Cash on Delivery or QR confirmation. Live card payments can be added after your payment provider is chosen.</div><div class="form-grid"><div class="field"><label>Full name *</label><input name="name" required placeholder="Your name" /></div><div class="field"><label>Phone number *</label><input name="phone" required placeholder="98XXXXXXXX" /></div></div><div class="field"><label>Email (optional)</label><input name="email" type="email" placeholder="you@email.com" /></div><div class="field"><label>Delivery address *</label><textarea name="address" required rows="3" placeholder="Area, city, nearby landmark"></textarea></div><div class="field"><label>Payment method</label><select name="payment_method"><option value="cod">Cash on delivery</option><option value="qr">Pay by QR / confirm after order</option></select></div><div class="field"><label>Note (optional)</label><input name="note" placeholder="Colour, delivery, or gift note" /></div></div><div class="modal-footer"><button type="button" class="ghost-btn" data-close-checkout>Cancel</button><button type="submit" class="dark-btn">Place order</button></div></form></section>`;
    document.body.appendChild(modal); document.getElementById('checkout-form').addEventListener('submit', submitCheckout);
  }
  async function submitCheckout(e) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const btn = e.currentTarget.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Placing order…';
    try {
      const result = await Core.placeOrder({ storefront_slug: state.storefront.slug, customer: { name:fd.get('name'), phone:fd.get('phone'), email:fd.get('email'), address:fd.get('address') }, items: state.cart.map(x => ({ product_id:x.product_id, quantity:x.quantity })), payment_method:fd.get('payment_method'), note:fd.get('note'), source:'online' });
      state.cart = []; saveCart(); document.getElementById('checkout-modal')?.remove(); document.querySelector('#cart-drawer')?.classList.remove('open'); toast(`Order ${result.order_number || ''} received. We will confirm it shortly.`); await load();
    } catch (err) { toast(err.message || 'Could not place the order.'); btn.disabled = false; btn.textContent = 'Place order'; }
  }
  function add(id) { const p = itemFor(id); if (!p || Core.stockState(p)==='out_of_stock') return; const found = state.cart.find(x => x.product_id === id); const current = found?.quantity || 0; if (current >= p.stock_qty) return toast('Only the available stock can be added.'); if (found) found.quantity += 1; else state.cart.push({ product_id:id, quantity:1 }); saveCart(); render(); document.querySelector('#cart-drawer')?.classList.add('open'); }
  function changeQty(id, delta) { const found = state.cart.find(x => x.product_id === id); const p = itemFor(id); if (!found || !p) return; found.quantity += Number(delta); if (found.quantity <= 0) state.cart = state.cart.filter(x=>x.product_id!==id); if (found.quantity > p.stock_qty) found.quantity = p.stock_qty; saveCart(); render(); document.querySelector('#cart-drawer')?.classList.add('open'); }
  async function load() { const result = await Core.getCatalog(requestedSite); state = { ...state, ...result, cart: getCart() }; render(); }
  app.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-product]'); if (addBtn) { add(addBtn.dataset.addProduct); return; }
    const view = e.target.closest('[data-view-product]'); if (view) { state.product = itemFor(view.dataset.viewProduct); render(); return; }
    const filter = e.target.closest('[data-filter]'); if (filter) { state.selectedCollection = filter.dataset.filter; render(); return; }
    const collectionLink = e.target.closest('[data-collection-link]'); if (collectionLink) { state.selectedCollection = collectionLink.dataset.collectionLink; return; }
    if (e.target.closest('[data-open-cart]')) { document.querySelector('#cart-drawer')?.classList.add('open'); return; }
    if (e.target.closest('[data-close-cart]')) { document.querySelector('#cart-drawer')?.classList.remove('open'); return; }
    if (e.target.closest('[data-close-product-modal]')) { state.product = null; render(); return; }
    const q = e.target.closest('[data-qty]'); if (q) { changeQty(q.dataset.qty, q.dataset.change); return; }
    const rem = e.target.closest('[data-remove-cart]'); if (rem) { state.cart = state.cart.filter(x => x.product_id !== rem.dataset.removeCart); saveCart(); render(); document.querySelector('#cart-drawer')?.classList.add('open'); return; }
    if (e.target.closest('[data-checkout]')) { checkoutModal(); return; }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-checkout]')) document.getElementById('checkout-modal')?.remove(); });
  load().then(() => { unsub = Core.subscribe(() => load().catch(() => {})); }).catch((err) => { app.innerHTML = `<main class="section"><div class="empty"><b>Could not load the storefront.</b><br>${Core.text(err.message || '')}</div></main>`; });
  window.addEventListener('beforeunload', () => unsub?.());
})();
