from vector_store import embed_products


async def embed_products_batch(merchant_id: str, products: list[dict]) -> int:
    """Embed a batch of products into the vector store."""
    return await embed_products(merchant_id, products)
