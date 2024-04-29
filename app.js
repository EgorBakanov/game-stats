const express = require('express');
const axios = require('axios').default;
const app = express();
const PORT = process.env.PORT || 3000;

const asyncHandler = (fn) => (req, res) => {
  console.log(`Request: ${req.originalUrl}`);
  return Promise.resolve(fn(req, res)).catch((error) => {
    console.error(error);
    res.send({ success: false, message: `Internal error (${error})` });
  });
};

function fetchSteamApi(endpoint) {
  return axios.get(`https://store.steampowered.com${endpoint}`).then((response) => response.data);
}

function fetchHl2bApi(name) {
  const searchTerms = name.replace(/[^\w\s'!:\/]/gi, '').split(' ');
  const body = {
    searchType: 'games',
    searchTerms: searchTerms,
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
  };
  const headers = {
    referer: 'https://howlongtobeat.com',
    origin: 'https://howlongtobeat.com',
    'Content-type': 'application/json;charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  return axios.post(`https://howlongtobeat.com/api/search`, body, { headers: headers }).then((response) => response.data);
}

app.get(
  '/:steamId',
  asyncHandler(async (req, res) => {
    const steamId = Number.parseInt(req.params.steamId);
    let result = { success: false };

    if (Number.isNaN(steamId)) {
      result.message = 'Incorrect id';
      res.send(result);
      return;
    }

    const detailsData = await fetchSteamApi(`/api/appdetails?appids=${steamId}`);
    const reviewData = await fetchSteamApi(`/appreviews/${steamId}?json=1&num_per_page=0`);
    const details = detailsData[steamId];

    if (!details?.success || !reviewData?.success) {
      result.message = 'Game not found';
      res.send(result);
      return;
    }

    const name = details?.data?.name;
    const releaseDate = details?.data.release_date?.date;
    const totalPositive = reviewData?.query_summary?.total_positive;
    const totalReviews = reviewData?.query_summary?.total_reviews;

    if (!name || !releaseDate || !totalPositive || !totalReviews) {
      result.message = 'Failed to fetch data';
      res.send(result);
      return;
    }

    let hl2bData = await fetchHl2bApi(name);
    let howLong2Beat = hl2bData?.data.find((data) => data.profile_steam == steamId);

    if (!howLong2Beat && details.data.type == 'dlc' && details.data.fullgame?.name) {
      const fullGameName = details.data.fullgame.name;
      hl2bData = await fetchHl2bApi(fullGameName);
      howLong2Beat = hl2bData?.data.find((data) => data.profile_steam == steamId);
    }

    if (!howLong2Beat) {
      result.message = 'Game time not found';
      res.send(result);
      return;
    }

    const comp100 = howLong2Beat.comp_100;

    if (!comp100) {
      result.message = 'Failed to fetch data';
      res.send(result);
      return;
    }

    result.success = true;
    result.name = name;
    result.id = steamId;
    result.releaseDate = Date.parse(releaseDate);
    result.rating = Math.round((totalPositive / totalReviews) * 10000) / 100;
    result.totalTime = Math.ceil(comp100 / 3600);
    res.send(result);
  })
);

app.get(
  '/',
  asyncHandler(async (req, res) => {
    res.redirect('https://github.com/EgorBakanov/game-stats');
  })
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
