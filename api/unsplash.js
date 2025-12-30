export default async function handler(req, res) {
  const { q = "nature", page = 1, perPage = 12 } = req.query;

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?page=${page}&per_page=${perPage}&query=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    res.status(200).json(
      data.results.map(photo => ({
        id: photo.id,
        url: photo.urls.regular,
        thumb: photo.urls.small,
        alt: photo.alt_description,
        user: photo.user.name,
        userLink: photo.user.links.html
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}
