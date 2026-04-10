import os

# Lazy-load ChromaDB
_client = None
_collection_cache: dict = {}


def _get_client():
    global _client
    if _client is None:
        try:
            import chromadb
            persist_dir = os.path.join(os.path.dirname(__file__), "chroma_data")
            _client = chromadb.PersistentClient(path=persist_dir)
            print(f"[VectorStore] ChromaDB initialized at {persist_dir}")
        except Exception as e:
            print(f"[VectorStore] ChromaDB not available: {e}")
            return None
    return _client


def _get_collection(merchant_id: str):
    if merchant_id in _collection_cache:
        return _collection_cache[merchant_id]

    client = _get_client()
    if client is None:
        return None

    collection = client.get_or_create_collection(
        name=f"products_{merchant_id}",
        metadata={"hnsw:space": "cosine"},
    )
    _collection_cache[merchant_id] = collection
    return collection


async def search_products(query: str, merchant_id: str, top_k: int = 3) -> list[dict]:
    """Search products by semantic similarity using ChromaDB."""
    collection = _get_collection(merchant_id)
    if collection is None or collection.count() == 0:
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(top_k, collection.count()),
        )

        matches = []
        if results and results["ids"] and results["ids"][0]:
            for i, product_id in enumerate(results["ids"][0]):
                score = 1.0 - (results["distances"][0][i] if results["distances"] else 0)
                metadata = results["metadatas"][0][i] if results["metadatas"] else {}

                matches.append({
                    "product_id": product_id,
                    "score": round(score, 3),
                    "match_reason": metadata.get("match_reason", f"Semantic match (score: {score:.2f})"),
                })

        return matches
    except Exception as e:
        print(f"[VectorStore] Search error: {e}")
        return []


async def embed_products(merchant_id: str, products: list[dict]) -> int:
    """Embed products into ChromaDB."""
    collection = _get_collection(merchant_id)
    if collection is None:
        return 0

    ids = []
    documents = []
    metadatas = []

    for p in products:
        product_id = p.get("id", "")
        # Build a rich text document for embedding
        text_parts = [
            p.get("name", ""),
            p.get("description", ""),
            " ".join(p.get("useCases", [])),
            " ".join(p.get("tags", [])),
            " ".join(p.get("sellingPoints", [])),
        ]
        doc = " | ".join(part for part in text_parts if part)

        ids.append(product_id)
        documents.append(doc)
        metadatas.append({
            "name": p.get("name", ""),
            "price": str(p.get("price", 0)),
            "match_reason": f"Recommended: {p.get('name', '')}",
        })

    try:
        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        print(f"[VectorStore] Embedded {len(ids)} products for merchant {merchant_id}")
        return len(ids)
    except Exception as e:
        print(f"[VectorStore] Embed error: {e}")
        return 0
