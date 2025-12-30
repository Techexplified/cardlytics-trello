export default async function handler(req, res) {
  const { q = "nature", page = 1, perPage = 12 } = req.query;

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?page=${page}&per_page=${perPage}&query=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Client-ID ${import.meta.env.VITE_UNSPLASH_KEY}`
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json([]);
    }

    const data = await response.json();

    const results = data.results.map(photo => ({
      id: photo.id,
      url: photo.urls.regular,
      thumb: photo.urls.small,
      alt: photo.alt_description,
      user: photo.user.name,
      userLink: photo.user.links.html
    }));

    res.status(200).json(results);
  } catch  {
    res.status(500).json([]);
  }
}
