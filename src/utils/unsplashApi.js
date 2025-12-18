const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_KEY;

export const searchUnsplashPhotos = async (query, page = 1, perPage = 12) => {
    if (!UNSPLASH_ACCESS_KEY) {
        console.error("Unsplash API key is missing");
        return [];
    }

    try {
        const response = await fetch(
            `https://api.unsplash.com/search/photos?page=${page}&per_page=${perPage}&query=${encodeURIComponent(query)}&client_id=${UNSPLASH_ACCESS_KEY}`
        );

        if (!response.ok) {
            throw new Error(`Unsplash API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.results.map(photo => ({
            id: photo.id,
            url: photo.urls.regular,
            thumb: photo.urls.small,
            alt: photo.alt_description,
            user: photo.user.name,
            userLink: photo.user.links.html
        }));
    } catch (error) {
        console.error("Error fetching Unsplash photos:", error);
        return [];
    }
};
