const Twitter = require('twitter');

module.exports = async function() {
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  let pages = 0;
  let max_id;
  while (pages < 10) {
    // eslint-disable-next-line no-undef
    const ownTweets = await new Promise((resolve, reject) =>
      client.get(
        '/statuses/user_timeline.json',
        { screen_name: 'howsmydrivingdc', count: 200, max_id },
        (error, data) => {
          if (!error) {
            resolve(data);
          } else {
            console.log('getting own tweets', error);
            reject(error);
          }
        }
      )
    );
    for (const { text, id_str } of ownTweets) {
      const match = text.match(
        /set a new high score with [a-zA-Z]{2}:[a-zA-Z0-9]+: \$(\d+) in unpaid tickets/
      );
      if (match) return Number(match[1]);
      else max_id = id_str;
    }
    pages++;
  }
  throw Error("couldn't find a high score with in 10 pages of own tweets");
};
