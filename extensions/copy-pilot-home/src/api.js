/**
 * Admin GraphQL helpers via shopify.query (Direct API).
 */

const PRODUCTS_QUERY = `#graphql
  query CopyPilotProducts($first: Int!, $query: String = null) {
    products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        vendor
        productType
        tags
        descriptionHtml
        featuredMedia {
          preview {
            image {
              url
              altText
            }
          }
        }
        media(first: 8) {
          nodes {
            id
            alt
            ... on MediaImage {
              preview {
                image {
                  url
                  altText
                }
              }
            }
          }
        }
        seo {
          title
          description
        }
      }
    }
  }
`;

const PRODUCT_UPDATE = `#graphql
  mutation CopyPilotProductUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        title
        descriptionHtml
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const MEDIA_UPDATE = `#graphql
  mutation CopyPilotMediaUpdate($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media {
        id
        alt
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

const MEDIA_CREATE = `#graphql
  mutation CopyPilotMediaCreate($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        alt
        mediaContentType
        status
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

async function gql(query, variables) {
  const result = await shopify.query(query, { variables });
  if (result?.errors?.length) {
    const msg = result.errors.map((e) => e.message).join("; ");
    throw new Error(msg || "GraphQL error");
  }
  return result?.data;
}

export async function fetchProducts({ first = 50, search = "" } = {}) {
  const variables = { first };
  if (search && String(search).trim()) {
    variables.query = `title:*${String(search).trim()}*`;
  }
  const data = await gql(PRODUCTS_QUERY, variables);
  return data?.products?.nodes || [];
}

/**
 * Publish SEO package without touching variants/inventory.
 * Updates: title, descriptionHtml, SEO title/description, media alt texts.
 */
export async function publishListing(pkg) {
  const productInput = {
    id: pkg.productId,
    title: pkg.salesTitle,
    descriptionHtml: pkg.bodyHtml,
    seo: {
      title: pkg.metaTitle,
      description: pkg.metaDescription,
    },
  };

  const updated = await gql(PRODUCT_UPDATE, { product: productInput });
  const errs = updated?.productUpdate?.userErrors || [];
  if (errs.length) {
    throw new Error(errs.map((e) => e.message).join("; "));
  }

  const mediaPayload = (pkg.imageSeo || [])
    .filter((m) => m.id && m.alt)
    .map((m) => ({ id: m.id, alt: m.alt }));

  if (mediaPayload.length) {
    const mediaRes = await gql(MEDIA_UPDATE, {
      productId: pkg.productId,
      media: mediaPayload,
    });
    const mErrs = mediaRes?.productUpdateMedia?.mediaUserErrors || [];
    if (mErrs.length) {
      throw new Error(mErrs.map((e) => e.message).join("; "));
    }
  }

  // Attach merchant-provided media (images / GIFs / external videos) — optional.
  let newMediaCount = 0;
  const newMedia = (pkg.newMedia || []).filter((m) => m.originalSource);
  if (newMedia.length) {
    const createRes = await gql(MEDIA_CREATE, {
      productId: pkg.productId,
      media: newMedia,
    });
    const cErrs = createRes?.productCreateMedia?.mediaUserErrors || [];
    if (cErrs.length) {
      throw new Error(cErrs.map((e) => e.message).join("; "));
    }
    newMediaCount = createRes?.productCreateMedia?.media?.length || newMedia.length;
  }

  return {
    ok: true,
    product: updated?.productUpdate?.product,
    imageCount: mediaPayload.length,
    newMediaCount,
  };
}
