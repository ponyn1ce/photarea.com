(function(){
  let products = [];

  // Elements
  const shopContainer = document.getElementById('shop-products');
  const shopAlert = document.getElementById('shopAlert');

  // Load Data
  const fallbackProducts = buildProductsFromDom();

  async function init() {
    await loadProducts();
  }

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        products = data;
        showAlert('', false);
      } else {
        products = fallbackProducts;
        showAlert('Каталог загружен из локальной версии. Серверные товары сейчас недоступны.', true);
      }
      renderProducts();
    } catch(e) {
      console.error(e);
      products = fallbackProducts;
      // showAlert('Не удалось получить товары с сервера. Используется локальная версия.', true);
      renderProducts();
    }
  }

  function showAlert(text, isVisible) {
    if(!shopAlert) return;
    shopAlert.textContent = text;
    shopAlert.hidden = !isVisible;
    shopAlert.classList.toggle('show', isVisible);
  }

  function buildProductsFromDom() {
    return Array.from(document.querySelectorAll('.shop-card')).map((card) => {
      const id = card.getAttribute('data-shop-id') || card.getAttribute('data-id') || '';
      const title = (card.querySelector('.shop-title') || {}).textContent || 'Product';
      const priceNode = card.querySelector('.shop-price');
      const oldPriceNode = priceNode ? priceNode.querySelector('.old') : null;
      const priceText = priceNode ? priceNode.childNodes[0].textContent.trim() : '';
      const oldPriceText = oldPriceNode ? oldPriceNode.textContent.trim() : '';
      const img = card.querySelector('img');
      const meta = (card.querySelector('.shop-meta') || {}).textContent || '';
      const isSale = !!card.querySelector('.shop-badge');
      const desc = card.getAttribute('data-desc') || '';
      const rating = card.getAttribute('data-rating') || '';
      const reviews = card.getAttribute('data-reviews') || meta.trim();
      const imagesAttr = card.getAttribute('data-images') || '';
      const images = imagesAttr
        ? imagesAttr.split(',').map(s => s.trim()).filter(Boolean)
        : (img ? [img.getAttribute('src')] : []);
      return {
        id,
        title,
        price: priceText,
        old_price: oldPriceText,
        description: desc,
        images,
        is_sale: isSale,
        rating,
        reviews_count: reviews
      };
    });
  }

  function renderProducts() {
    const DIVIDER = `<div class="shop-divider" aria-hidden="true"><span>PHOTAREA</span></div>`;
    shopContainer.innerHTML = products.map(p => {
      const img = (p.images && p.images.length > 0) ? p.images[0] : '/icon/default-product.png';
      return `
        <div class="shop-card" data-id="${p.id}">
          <div class="shop-media">
            <img src="${img}" alt="${p.title}">
            ${p.is_sale ? '<span class="shop-badge">SALE</span>' : ''}
          </div>
          <div class="shop-body">
            <h3 class="shop-title">${p.title}</h3>
            <div class="shop-price">
              ${p.price}
              ${p.old_price ? `<span class="old">${p.old_price}</span>` : ''}
            </div>
            <div class="shop-meta">${p.reviews_count || '0 отзывов'}</div>
          </div>
        </div>
      `;
    }).join(DIVIDER);

    // Re-attach listeners
    document.querySelectorAll('.shop-card').forEach(el => {
      el.addEventListener('click', () => openProductDetail(el.dataset.id));
    });
  }

  // Product Detail Logic
  const detailModal = document.getElementById('shopModal');
  const hero = document.getElementById('shopHeroImg');
  const thumbs = document.getElementById('shopThumbs');

  function openProductDetail(id) {
    const p = products.find(x => x.id == id);
    if(!p) return;

    document.getElementById('shopTitle').textContent = p.title;
    document.getElementById('shopPrice').textContent = p.price;
    document.getElementById('shopOldPrice').textContent = p.old_price || '';
    document.getElementById('shopDesc').textContent = p.description || '';
    document.getElementById('shopRating').textContent = p.rating || '0';
    document.getElementById('shopReviews').textContent = p.reviews_count || '0 reviews';

    const images = (p.images && p.images.length > 0) ? p.images : ['/icon/default-product.png'];
    hero.src = images[0];

    thumbs.innerHTML = '';
    images.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      if(index === 0) img.classList.add('selected');
      img.onclick = () => {
        if (hero.src === src) return;
        hero.classList.add('animating');
        setTimeout(() => {
          hero.src = src;
          hero.classList.remove('animating');
        }, 400);
        document.querySelectorAll('.shop-thumbs img').forEach(el => el.classList.remove('selected'));
        img.classList.add('selected');
      };
      thumbs.appendChild(img);
    });

    detailModal.classList.add('open');
    detailModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Buy button — Add to Cart
    const buyBtn = document.getElementById('shopBuy');
    if(buyBtn) {
      buyBtn.onclick = async () => {
        const token = localStorage.getItem('token');
        if(!token) return window.location.href = 'html/login.html';

        try {
          const res = await fetch('/api/user/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ productId: p.id })
          });

          if(res.ok) {
            alert('Товар добавлен в корзину');
            detailModal.classList.remove('open');
            document.body.style.overflow = '';
          } else {
            const data = await res.json();
            alert(data.message || 'Ошибка добавления');
          }
        } catch(e) {
          console.error(e);
          alert('Ошибка сети');
        }
      };
    }

    // Order Now
    const orderBtn = document.getElementById('shopOrder');
    if(orderBtn) {
      orderBtn.onclick = () => {
        localStorage.setItem('pending_order_product', JSON.stringify(p));
        sessionStorage.setItem('redirect_to_support', 'true');
        window.location.href = 'html/album-guide.html';
      };
    }
  }

  // Close modal
  function closeDetailModal() {
    detailModal.classList.remove('open');
    detailModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDetailModal));
  document.querySelector('.shop-close').addEventListener('click', closeDetailModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailModal.classList.contains('open')) closeDetailModal();
  });

  init();
})();
