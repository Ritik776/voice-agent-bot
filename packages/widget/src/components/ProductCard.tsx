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

export function ProductCard({ product }: { product: Product }) {
  const price = product.currency === 'INR' ? `₹${product.price}` : `${product.currency} ${product.price}`;

  return (
    <a class="vs-product-card" href={product.url} target="_blank" rel="noopener noreferrer">
      {product.imageUrl && (
        <img class="vs-product-img" src={product.imageUrl} alt={product.name} loading="lazy" />
      )}
      <div class="vs-product-body">
        <div class="vs-product-name">{product.name}</div>
        <div class="vs-product-price">{price}</div>
        {product.sellingPoints.slice(0, 2).map((sp) => (
          <div class="vs-product-point" key={sp}>
            <span class="vs-product-point-dot" />
            {sp}
          </div>
        ))}
        <div class="vs-product-cta">View Product →</div>
      </div>
    </a>
  );
}
