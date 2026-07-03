(function () {
  const config = window.COMMERCE_CONFIG || {};
  const STORAGE_KEY = 'aerune_commerce_core_v2';
  const canUseCloud = !config.demoMode &&
    /^https:\/\//.test(config.supabaseUrl || '') &&
    !String(config.supabaseUrl || '').includes('PASTE_') &&
    String(config.supabaseAnonKey || '').length > 30 &&
    !String(config.supabaseAnonKey || '').includes('PASTE_') &&
    window.supabase && typeof window.supabase.createClient === 'function';
  const sb = canUseCloud ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

  const now = () => new Date().toISOString();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = () => (window.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const slugify = (v) => String(v || 'untitled').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const codeToken = (v, fallback = 'ITEM') => (String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || fallback).slice(0, 6);
  const nextInternalBarcode = (existing = []) => {
    const prefix = '200'; // internal, non-GS1-use code prefix for in-shop scanning
    let n = Math.max(0, ...existing.map(v => Number(String(v || '').replace(/\D/g, '').slice(-9)) || 0)) + 1;
    const base = `${prefix}${String(n).padStart(9,'0')}`.slice(0,12);
    const check = (10 - base.split('').reverse().reduce((sum,d,i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10) % 10;
    return `${base}${check}`;
  };
  const suggestSku = ({ storefront = '', collection = '', title = '', existing = [], exceptId = '' } = {}) => {
    const prefix = codeToken(storefront || 'AER', 'AER');
    const group = codeToken(collection || title || 'ITEM', 'ITEM').slice(0,3);
    const stem = `${prefix}-${group}-`;
    const used = existing.filter(p => p.id !== exceptId && String(p.sku || '').startsWith(stem)).map(p => Number(String(p.sku).split('-').pop()) || 0);
    return `${stem}${String(Math.max(0, ...used) + 1).padStart(4,'0')}`;
  };
  const money = (amount, currency = 'NPR') => new Intl.NumberFormat('en-NP', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
  const text = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const stockState = (p) => Number(p.stock_qty || 0) <= 0 ? 'out_of_stock' : Number(p.stock_qty || 0) <= Number(p.low_stock_at || 0) ? 'low_stock' : 'in_stock';

  const defaults = {
    storefronts: [
      {
        id: 'store-aerune', slug: 'aerune', name: 'Aerune', mark: 'AE', domain: '', currency: 'NPR', theme: 'alpine', status: 'published',
        announcement: 'Designed in Nepal. Built for the long way home.', hero_eyebrow: 'FIELD-READY TREKKING SYSTEMS',
        hero_title: 'Carry the story, not the strain.', hero_subtitle: 'Technical packs and travel companions made for real trails, changing weather, and the work that happens between departures.',
        primary_cta: 'Explore the collection', secondary_cta: 'Field notes', footer_note: 'Designed in Nepal. Made for the long way home.', created_at: now(), updated_at: now()
      },
      {
        id: 'store-workroom', slug: 'the-work-room', name: 'The Work Room', mark: 'WR', domain: '', currency: 'NPR', theme: 'editorial', status: 'draft',
        announcement: 'A considered collection from The Work Room.', hero_eyebrow: 'CURATED EVERYDAY GOODS',
        hero_title: 'Useful things, kept simple.', hero_subtitle: 'A separate customer storefront controlled from the same Commerce Core.',
        primary_cta: 'Browse items', secondary_cta: 'Visit journal', footer_note: 'The Work Room — curated with intent.', created_at: now(), updated_at: now()
      }
    ],
    collections: [
      { id: 'col-altitude', storefront_id: 'store-aerune', name: 'Altitude', handle: 'altitude', description: 'Trekking packs for trail and field work.', cover_url: '', sort_order: 1, is_visible: true, created_at: now(), updated_at: now() },
      { id: 'col-sera', storefront_id: 'store-aerune', name: 'Sera', handle: 'sera', description: 'Light travel and shorter trail movement.', cover_url: '', sort_order: 2, is_visible: true, created_at: now(), updated_at: now() },
      { id: 'col-atlas', storefront_id: 'store-aerune', name: 'Atlas', handle: 'atlas', description: 'Where the trail gets serious.', cover_url: '', sort_order: 3, is_visible: true, created_at: now(), updated_at: now() },
      { id: 'col-rainwear', storefront_id: 'store-aerune', name: 'Rainwear', handle: 'rainwear', description: 'Weather layers for people and packs.', cover_url: '', sort_order: 4, is_visible: true, created_at: now(), updated_at: now() }
    ],
    products: [
      { id: 'prod-altitude', title: 'Altitude Ridge', handle: 'altitude-ridge', sku: 'AER-ALT-RIDGE', barcode: '2001000000013', description: 'A technical trekking pack with protected camera carry, fast access, tripod support, and all-day load stability.', price_npr: 18900, compare_at_npr: 21900, stock_qty: 12, low_stock_at: 4, status: 'published', image_url: '', badges: 'Trekking, Creator Carry, 45L', created_at: now(), updated_at: now() },
      { id: 'prod-sera', title: 'Sera Air', handle: 'sera-air', sku: 'AER-SER-AIR', barcode: '2001000000020', description: 'A lighter travel and short-trek daypack with compression-ready organisation and an easy all-day carry.', price_npr: 9800, compare_at_npr: 0, stock_qty: 18, low_stock_at: 5, status: 'published', image_url: '', badges: 'Travel, Daypack, 24L', created_at: now(), updated_at: now() },
      { id: 'prod-atlas', title: 'Atlas Alpine', handle: 'atlas-alpine', sku: 'AER-ATL-ALPINE', barcode: '2001000000037', description: 'A high-performance trekking pack for demanding routes, with stable load transfer and serious trail organisation.', price_npr: 21500, compare_at_npr: 0, stock_qty: 3, low_stock_at: 4, status: 'published', image_url: '', badges: 'Technical, Alpine, 55L', created_at: now(), updated_at: now() },
      { id: 'prod-terrain', title: 'Terrain Shell', handle: 'terrain-shell', sku: 'AER-TER-SHELL', barcode: '2001000000044', description: 'A weather layer that protects both you and your pack when the weather turns.', price_npr: 3600, compare_at_npr: 0, stock_qty: 22, low_stock_at: 6, status: 'published', image_url: '', badges: 'Rainwear, Pack Cover', created_at: now(), updated_at: now() },
      { id: 'prod-toge', title: 'Toge', handle: 'toge', sku: 'AER-TOG-01', barcode: '2001000000051', description: 'A Japanese-inspired compact carry system for city movement, short journeys, and thoughtful packing.', price_npr: 11200, compare_at_npr: 0, stock_qty: 7, low_stock_at: 3, status: 'draft', image_url: '', badges: 'Travel, Limited', created_at: now(), updated_at: now() }
    ],
    storefront_products: [
      { id: 'link-altitude', storefront_id: 'store-aerune', product_id: 'prod-altitude', collection_id: 'col-altitude', visible: true, position: 1, price_override_npr: null },
      { id: 'link-sera', storefront_id: 'store-aerune', product_id: 'prod-sera', collection_id: 'col-sera', visible: true, position: 2, price_override_npr: null },
      { id: 'link-atlas', storefront_id: 'store-aerune', product_id: 'prod-atlas', collection_id: 'col-atlas', visible: true, position: 3, price_override_npr: null },
      { id: 'link-terrain', storefront_id: 'store-aerune', product_id: 'prod-terrain', collection_id: 'col-rainwear', visible: true, position: 4, price_override_npr: null },
      { id: 'link-toge', storefront_id: 'store-aerune', product_id: 'prod-toge', collection_id: 'col-sera', visible: false, position: 5, price_override_npr: null }
    ],
    orders: [],
    order_items: []
  };

  function readDemo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const productRows = Array.isArray(parsed.products) ? parsed.products : clone(defaults.products);
        const seenBarcodes = [];
        const products = productRows.map((row) => { const barcode = row.barcode || nextInternalBarcode(seenBarcodes); seenBarcodes.push(barcode); return { ...row, barcode }; });
        return {
          storefronts: Array.isArray(parsed.storefronts) ? parsed.storefronts : clone(defaults.storefronts),
          collections: Array.isArray(parsed.collections) ? parsed.collections : clone(defaults.collections),
          products,
          storefront_products: Array.isArray(parsed.storefront_products) ? parsed.storefront_products : clone(defaults.storefront_products),
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          order_items: Array.isArray(parsed.order_items) ? parsed.order_items : []
        };
      }
    } catch (_) { /* reset below */ }
    const fresh = clone(defaults); localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); return fresh;
  }
  function writeDemo(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); window.dispatchEvent(new CustomEvent('commerce-demo-updated')); return state; }
  function sortByPosition(a, b) { return Number(a.position || a.sort_order || 0) - Number(b.position || b.sort_order || 0) || String(a.title || a.name).localeCompare(String(b.title || b.name)); }

  async function getStorefronts({ includeDrafts = false } = {}) {
    if (!sb) { const list = readDemo().storefronts.sort((a,b) => a.name.localeCompare(b.name)); return includeDrafts ? list : list.filter(x => x.status === 'published'); }
    let q = sb.from('storefronts').select('*').order('name'); if (!includeDrafts) q = q.eq('status', 'published');
    const { data, error } = await q; if (error) throw error; return data || [];
  }
  async function saveStorefront(row) {
    const payload = { ...row, id: row.id || uid(), slug: slugify(row.slug || row.name), mark: String(row.mark || row.name || 'AE').slice(0, 3).toUpperCase(), theme: ['alpine','editorial','noir'].includes(row.theme) ? row.theme : 'alpine', updated_at: now(), created_at: row.created_at || now() };
    if (!sb) { const s = readDemo(); const i = s.storefronts.findIndex(x => x.id === payload.id); i >= 0 ? s.storefronts[i] = { ...s.storefronts[i], ...payload } : s.storefronts.push(payload); writeDemo(s); return payload; }
    const { data, error } = await sb.from('storefronts').upsert(payload).select().single(); if (error) throw error; return data;
  }
  async function deleteStorefront(id) {
    if (!sb) { const s = readDemo(); s.storefronts = s.storefronts.filter(x => x.id !== id); s.collections = s.collections.filter(x => x.storefront_id !== id); s.storefront_products = s.storefront_products.filter(x => x.storefront_id !== id); writeDemo(s); return; }
    const { error } = await sb.from('storefronts').delete().eq('id', id); if (error) throw error;
  }
  async function getCollections({ storefrontId = null, includeHidden = false } = {}) {
    if (!sb) { let x = readDemo().collections; if (storefrontId) x = x.filter(v => v.storefront_id === storefrontId); if (!includeHidden) x = x.filter(v => v.is_visible); return x.slice().sort(sortByPosition); }
    let q = sb.from('collections').select('*').order('sort_order').order('name'); if (storefrontId) q = q.eq('storefront_id', storefrontId); if (!includeHidden) q = q.eq('is_visible', true); const { data, error } = await q; if (error) throw error; return data || [];
  }
  async function saveCollection(row) {
    const payload = { ...row, id: row.id || uid(), handle: slugify(row.handle || row.name), sort_order: Number(row.sort_order || 0), is_visible: row.is_visible !== false, updated_at: now(), created_at: row.created_at || now() };
    if (!sb) { const s = readDemo(); const i = s.collections.findIndex(x => x.id === payload.id); i >= 0 ? s.collections[i] = { ...s.collections[i], ...payload } : s.collections.push(payload); writeDemo(s); return payload; }
    const { data, error } = await sb.from('collections').upsert(payload).select().single(); if (error) throw error; return data;
  }
  async function deleteCollection(id) {
    if (!sb) { const s = readDemo(); s.collections = s.collections.filter(x => x.id !== id); s.storefront_products = s.storefront_products.map(x => x.collection_id === id ? { ...x, collection_id: null } : x); writeDemo(s); return; }
    const { error } = await sb.from('collections').delete().eq('id', id); if (error) throw error;
  }
  async function getProducts({ includeDrafts = false } = {}) {
    if (!sb) { let x = readDemo().products; if (!includeDrafts) x = x.filter(v => v.status === 'published'); return x.slice().sort((a,b) => a.title.localeCompare(b.title)); }
    let q = sb.from('products').select('*').order('title'); if (!includeDrafts) q = q.eq('status', 'published'); const { data, error } = await q; if (error) throw error; return data || [];
  }
  async function saveProduct(row) {
    const demoProducts = !sb ? readDemo().products : []; const suggestedBarcode = nextInternalBarcode(demoProducts.map(x => x.barcode));
    const payload = { ...row, id: row.id || uid(), handle: slugify(row.handle || row.title), sku: String(row.sku || '').trim(), barcode: String(row.barcode || suggestedBarcode).trim(), price_npr: Number(row.price_npr || 0), compare_at_npr: Number(row.compare_at_npr || 0), stock_qty: Number(row.stock_qty || 0), low_stock_at: Number(row.low_stock_at || 0), status: row.status === 'draft' ? 'draft' : 'published', updated_at: now(), created_at: row.created_at || now() };
    if (!sb) { const s = readDemo(); const i = s.products.findIndex(x => x.id === payload.id); i >= 0 ? s.products[i] = { ...s.products[i], ...payload } : s.products.push(payload); writeDemo(s); return payload; }
    const { data, error } = await sb.from('products').upsert(payload).select().single(); if (error) throw error; return data;
  }
  async function deleteProduct(id) {
    if (!sb) { const s = readDemo(); s.products = s.products.filter(x => x.id !== id); s.storefront_products = s.storefront_products.filter(x => x.product_id !== id); writeDemo(s); return; }
    const { error } = await sb.from('products').delete().eq('id', id); if (error) throw error;
  }
  async function getAssignments({ storefrontId = null, productId = null, includeHidden = true } = {}) {
    if (!sb) { let x = readDemo().storefront_products; if (storefrontId) x = x.filter(v => v.storefront_id === storefrontId); if (productId) x = x.filter(v => v.product_id === productId); if (!includeHidden) x = x.filter(v => v.visible); return x.slice().sort(sortByPosition); }
    let q = sb.from('storefront_products').select('*').order('position'); if (storefrontId) q = q.eq('storefront_id', storefrontId); if (productId) q = q.eq('product_id', productId); if (!includeHidden) q = q.eq('visible', true); const { data, error } = await q; if (error) throw error; return data || [];
  }
  async function replaceProductAssignments(productId, links) {
    const cleaned = links.filter(x => x.storefront_id).map((x, index) => ({ ...x, id: x.id || uid(), product_id: productId, visible: x.visible !== false, position: Number(x.position || index + 1), price_override_npr: x.price_override_npr === '' || x.price_override_npr == null ? null : Number(x.price_override_npr) }));
    if (!sb) { const s = readDemo(); s.storefront_products = s.storefront_products.filter(x => x.product_id !== productId).concat(cleaned); writeDemo(s); return cleaned; }
    const { error: delError } = await sb.from('storefront_products').delete().eq('product_id', productId); if (delError) throw delError;
    if (cleaned.length) { const { error } = await sb.from('storefront_products').upsert(cleaned); if (error) throw error; }
    return cleaned;
  }
  async function getCatalog(slug) {
    const storefronts = await getStorefronts({ includeDrafts: false });
    const hostname = String(location.hostname || '').toLowerCase();
    const storefront = storefronts.find(x => String(x.domain || '').toLowerCase() === hostname && hostname !== '') || storefronts.find(x => x.slug === slug) || storefronts.find(x => x.slug === config.defaultStorefront) || storefronts[0];
    if (!storefront) return { storefront: null, collections: [], products: [] };
    const [collections, products, assignments] = await Promise.all([getCollections({ storefrontId: storefront.id, includeHidden: true }), getProducts({ includeDrafts: true }), getAssignments({ storefrontId: storefront.id, includeHidden: true })]);
    const mapProducts = new Map(products.map(x => [x.id, x])); const mapCollections = new Map(collections.map(x => [x.id, x]));
    const catalog = assignments.map(link => {
      const product = mapProducts.get(link.product_id); if (!product) return null;
      return { ...product, assignment: link, collection: mapCollections.get(link.collection_id) || null, effective_price_npr: link.price_override_npr == null ? product.price_npr : link.price_override_npr };
    }).filter(Boolean).filter(x => x.assignment.visible && x.status === 'published').sort((a,b) => sortByPosition(a.assignment, b.assignment));
    return { storefront, collections: collections.filter(x => x.is_visible), products: catalog };
  }
  function localOrderNumber(source) { const d = new Date(); return `${source === 'pos' ? 'POS' : 'WEB'}-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`; }
  async function placeOrder({ storefront_slug, customer, items, payment_method = 'cod', note = '', source = 'online' }) {
    if (!items?.length) throw new Error('Your cart is empty.');
    if (sb) {
      const { data, error } = await sb.rpc('place_order', { p_storefront_slug: storefront_slug, p_customer: customer || {}, p_items: items.map(x => ({ product_id: x.product_id, quantity: Number(x.quantity || 1) })), p_payment_method: payment_method, p_note: note || null, p_source: source });
      if (error) throw error; return Array.isArray(data) ? data[0] : data;
    }
    const s = readDemo(); const storefront = s.storefronts.find(x => x.slug === storefront_slug) || s.storefronts[0];
    let subtotal = 0; const prepared = [];
    for (const i of items) {
      const p = s.products.find(x => x.id === i.product_id); const link = s.storefront_products.find(x => x.product_id === i.product_id && x.storefront_id === storefront.id); if (!p || !link) throw new Error('One product is no longer available.');
      const qty = Number(i.quantity || 1); if (p.stock_qty < qty) throw new Error(`${p.title} does not have enough stock.`);
      const price = link.price_override_npr == null ? p.price_npr : link.price_override_npr; subtotal += price * qty; p.stock_qty -= qty; p.updated_at = now(); prepared.push({ id: uid(), product_id: p.id, title: p.title, sku: p.sku, quantity: qty, unit_price_npr: price, line_total_npr: price * qty });
    }
    const id = uid(); const order = { id, order_number: localOrderNumber(source), storefront_id: storefront.id, source, customer_name: String(customer?.name || ''), customer_phone: String(customer?.phone || ''), customer_email: String(customer?.email || ''), shipping_address: String(customer?.address || ''), note, payment_method, payment_status: payment_method === 'cod' ? 'unpaid' : 'awaiting_confirmation', fulfillment_status: 'new', subtotal_npr: subtotal, shipping_npr: 0, total_npr: subtotal, created_at: now(), updated_at: now() };
    s.orders.unshift(order); s.order_items.push(...prepared.map(x => ({ ...x, order_id: id }))); writeDemo(s); return { order_id: id, order_number: order.order_number };
  }
  async function getOrders() {
    if (!sb) { const s = readDemo(); return s.orders.slice().sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).map(o => ({ ...o, order_items: s.order_items.filter(i => i.order_id === o.id) })); }
    const { data, error } = await sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }); if (error) throw error; return data || [];
  }
  async function updateOrderStatus(id, fulfillment_status) {
    if (!sb) { const s = readDemo(); const o = s.orders.find(x => x.id === id); if (o) { o.fulfillment_status = fulfillment_status; o.updated_at = now(); } writeDemo(s); return; }
    const { error } = await sb.from('orders').update({ fulfillment_status, updated_at: now() }).eq('id', id); if (error) throw error;
  }
  async function uploadImage(file) {
    if (!file) return '';
    if (!sb) return new Promise((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error('Could not read image.')); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
    const safe = String(file.name || 'product-image').replace(/[^a-zA-Z0-9._-]/g, '-'); const path = `products/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: false, cacheControl: '3600' }); if (error) throw error;
    return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }
  async function session() { if (!sb) return { user: { email: 'demo@aerune.local' }, demo: true }; const { data, error } = await sb.auth.getSession(); if (error) throw error; return data.session; }
  async function signIn(email, password) { if (!sb) return { user: { email: 'demo@aerune.local' }, demo: true }; const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data; }
  async function signUp(email, password) { if (!sb) return { user: { email: 'demo@aerune.local' }, demo: true }; const { data, error } = await sb.auth.signUp({ email, password }); if (error) throw error; return data; }
  async function signOut() { if (sb) { const { error } = await sb.auth.signOut(); if (error) throw error; } }
  function subscribe(callback) {
    if (!sb) { const listener = () => callback(); window.addEventListener('commerce-demo-updated', listener); window.addEventListener('storage', listener); return () => { window.removeEventListener('commerce-demo-updated', listener); window.removeEventListener('storage', listener); }; }
    const c = sb.channel('commerce-core-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storefronts' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storefront_products' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
      .subscribe();
    return () => sb.removeChannel(c);
  }
  function resetDemo() { localStorage.removeItem(STORAGE_KEY); readDemo(); window.dispatchEvent(new CustomEvent('commerce-demo-updated')); }

  window.Core = {
    isCloud: Boolean(sb), isDemo: !sb, sb, getStorefronts, saveStorefront, deleteStorefront, getCollections, saveCollection, deleteCollection,
    getProducts, saveProduct, deleteProduct, getAssignments, replaceProductAssignments, getCatalog, placeOrder, getOrders, updateOrderStatus,
    uploadImage, session, signIn, signUp, signOut, subscribe, resetDemo, money, text, slugify, stockState, readDemo, suggestSku, nextInternalBarcode
  };
})();
