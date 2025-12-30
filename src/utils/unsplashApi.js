export const searchUnsplashPhotos = async (query, page = 1, perPage = 12) => {
  try {
    const response = await fetch(
      `/api/unsplash?q=${encodeURIComponent(query)}&page=${page}&perPage=${perPage}`
    );

    if (!response.ok) {
      throw new Error("Proxy error");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Unsplash photos:", error);
    return [];
  }
};