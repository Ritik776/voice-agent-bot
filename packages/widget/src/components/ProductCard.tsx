interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string | null;
  sellingPoints: string[];
  matchReason: string;
}

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const formattedPrice =
    product.currency === 'INR'
      ? `\u20B9${product.price}`
      : `${product.currency} ${product.price}`;

  return (
    <a
      class="vs-product-card"
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {product.imageUrl && (
        <img
          class="vs-product-img"
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
        />
      )}
      <div class="vs-product-info">
        <div class="vs-product-name">{product.name}</div>
        <div class="vs-product-price">{formattedPrice}</div>
        {product.sellingPoints.slice(0, 2).map((sp) => (
          <div class="vs-product-point" key={sp}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {sp}
          </div>
        ))}
        <div class="vs-product-cta">View Product</div>
      </div>
    </a>
  );
}
