const { readFileSync } = require('fs');

const AWS = require('aws-sdk');
const middy = require('middy');
const { ssm, jsonBodyParser } = require('middy/middlewares');
const Twitter = require('twitter');

const setup = require('./puppeteer/setup');
const lookupPlate = require('./lookupPlate.js');
const crc = require('./crc.js');
const getHighscore = require('./getHighscore.js');

const s3 = new AWS.S3();

const PLATE_REGEX = /\b([a-zA-Z]{2}):\s*([a-zA-Z0-9]+)\b/;

module.exports.test = middy(async (event, context) => {
  // For keeping the browser launch
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
  console.log(event);
  return lookupPlate(browser, event.state, event.number);
});
module.exports.test.use(
  ssm({
    names: {
      CONSUMER_KEY: '/howsmydriving/consumer_key',
      CONSUMER_SECRET: '/howsmydriving/consumer_secret',
      ACCESS_TOKEN: '/howsmydriving/access_token',
      ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret'
    }
  })
);

module.exports.crc = middy(async event => {
  console.log(event);
  if (!event.queryStringParameters || !event.queryStringParameters.crc_token) {
    return { statusCode: 400 };
  }
  const responseToken = crc(
    event.queryStringParameters.crc_token,
    process.env.CONSUMER_SECRET
  );
  return {
    body: JSON.stringify({ response_token: `sha256=${responseToken}` })
  };
});

module.exports.crc.use(
  ssm({
    cache: true,
    names: {
      CONSUMER_SECRET: '/howsmydriving/consumer_secret'
    }
  })
);

module.exports.register = middy(async event => {
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  return client.post(
    `/account_activity/all/dev/webhooks.json?url=${encodeURIComponent(
      event.webhook
    )}`
  );
});
module.exports.register.use(
  ssm({
    names: {
      CONSUMER_KEY: '/howsmydriving/consumer_key',
      CONSUMER_SECRET: '/howsmydriving/consumer_secret',
      ACCESS_TOKEN: '/howsmydriving/access_token',
      ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret'
    }
  })
);

module.exports.subscribe = middy(async (/*event*/) => {
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  return client.post(`/account_activity/all/dev/subscriptions.json`);
});
module.exports.subscribe.use(
  ssm({
    names: {
      CONSUMER_KEY: '/howsmydriving/consumer_key',
      CONSUMER_SECRET: '/howsmydriving/consumer_secret',
      ACCESS_TOKEN: '/howsmydriving/access_token',
      ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret'
    }
  })
);

module.exports.webhook = middy(async (event, context) => {
  console.log(event);
  const browser = await setup.getBrowser();
  try {
    const client = new Twitter({
      consumer_key: process.env.CONSUMER_KEY,
      consumer_secret: process.env.CONSUMER_SECRET,
      access_token_key: process.env.ACCESS_TOKEN,
      access_token_secret: process.env.ACCESS_TOKEN_SECRET
    });
    if (!event.body.tweet_create_events) {
      return;
    }
    console.log(event.body.tweet_create_events);
    if (
      event.body.tweet_create_events[0].user.screen_name.toLowerCase() ===
      'howsmydrivingdc'
    ) {
      console.log('ignore own tweet');
      return;
    }
    if (event.body.tweet_create_events[0].retweeted_status) {
      console.log('ignore retweeted status');
      return;
    }
    if (
      event.body.tweet_create_events[0].is_quote_status &&
      !event.body.tweet_create_events[0].text.includes(
        event.body.tweet_create_events[0].quoted_status.text
      )
    ) {
      console.log('ignore quote tweet');
      return;
    }
    let state, number;
    try {
      const text = event.body.tweet_create_events[0].truncated
        ? event.body.tweet_create_events[0].extended_tweet.full_text
        : event.body.tweet_create_events[0].text;
      [, state, number] = text.match(PLATE_REGEX);
    } catch (e) {
      console.log(e);
      return;
    }
    console.log(state, number);
    let result;
    for (let i = 0; i < 5; i++) {
      result = await lookupPlate(browser, state.toUpperCase(), number);
      if (result.error !== 'captcha error') {
        break;
      }
    }
    console.log('lets tweet!');
    const status = {
      in_reply_to_status_id: event.body.tweet_create_events[0].id_str,
      status: `@${event.body.tweet_create_events[0].user.screen_name} `
    };
    if (result.path) {
      const data = readFileSync(result.path);
      console.log('loaded image');
      status.status += `${state}:${number} has $${
        result.total
      } in outstanding tickets:`;
      let media_id_string;
      try {
        const mediaResp = await client.post('media/upload', {
          media: data
        });
        media_id_string = mediaResp.media_id_string;
      } catch (e) {
        console.log(JSON.stringify(e));
      }
      status.media_ids = media_id_string;
    } else if (result.error) {
      status.status += `Result for ${state}:${number} - ${result.error}`;
    }
    let id_str;
    try {
      const statusResp = await client.post('statuses/update', status);
      id_str = statusResp.id_str;
    } catch (e) {
      console.log(JSON.stringify(e));
    }
    await s3
      .putObject({
        Bucket: process.env.BUCKET,
        Key: `${id_str}.html`,
        Body: result.html
      })
      .promise();
    if (state.toLowerCase() === 'md' && number.toLowerCase() === '2dh2148') {
      console.log('no more high scores for MD:2DH2148');
      return;
    }
    if (result.error) {
      return;
    }
    const highScore = await getHighscore(result.total);
    if (result.total > highScore) {
      const highScoreStatus = {
        status: `🚨 @${
          event.body.tweet_create_events[0].user.screen_name
        } set a new high score with ${state}:${number}: $${
          result.total
        } in unpaid tickets! 🚨

        https://twitter.com/HowsMyDrivingDC/status/${id_str}`
      };
      await client.post('statuses/update', highScoreStatus);
    }
  } finally {
    await browser.close()
  }
});
module.exports.webhook.use(
  ssm({
    cache: true,
    names: {
      CONSUMER_KEY: '/howsmydriving/consumer_key',
      CONSUMER_SECRET: '/howsmydriving/consumer_secret',
      ACCESS_TOKEN: '/howsmydriving/access_token',
      ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret'
    }
  })
);
module.exports.webhook.use(jsonBodyParser());

module.exports.archive = middy(async () => {
  const sqlite = require('sqlite');
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  });
  const db = await sqlite.open('archive.db');

  await db.run(
    `
    CREATE TABLE IF NOT EXISTS tweets (
      tweet_id text,
      created_at timestamp,
      content text,
      state varchar(2),
      number text,
      amount double,
      user text,
      summoning_text text,
      zero_reason text
    )
    `
  );

  let { since_id } = await db.get('SELECT max(tweet_id) since_id FROM tweets');
  let max_id;
  while (true) {
    // eslint-disable-line no-constant-condition
    const ownTweets = await client.get('/statuses/user_timeline.json', {
      screen_name: 'howsmydrivingdc',
      count: 200,
      since_id: since_id || undefined, // eslint-disable-line no-undef
      max_id
    });
    for (const {
      text,
      id_str,
      created_at,
      in_reply_to_status_id_str
    } of ownTweets) {
      if (id_str === max_id) {
        continue;
      }
      max_id = id_str;
      const match = text.match(
        /@\S+ ([a-zA-Z]{2}):([a-zA-Z0-9]+) has \$(\d+(\.\d+)?) in outstanding tickets:/
      );
      let summoningTweet;
      try {
        summoningTweet = await client.get('/statuses/show.json', {
          id: in_reply_to_status_id_str,
          tweet_mode: 'extended'
        });
      } catch (e) {
        console.log('Summoning tweet deleted');
      }
      if (match) {
        await db.run(
          `INSERT INTO tweets (tweet_id, created_at, content, state, number, amount, user, summoning_text)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id_str,
            new Date(created_at).toISOString(),
            text,
            match[1],
            match[2],
            match[3],
            summoningTweet && summoningTweet.user.screen_name,
            summoningTweet && summoningTweet.full_text
          ]
        );
        console.log(`ADDED ${match[1]}:${match[2]} ${match[3]}`);
      } else {
        let zeroReason;
        if (text.includes('balance of $0')) {
          zeroReason = 'paid';
        } else if (text.includes('not found')) {
          zeroReason = 'unfound';
        } else {
          console.log(`SKIPPED ${text} - not a response to summoning`);
          continue;
        }
        const [, state, number] = summoningTweet
          ? summoningTweet.full_text.match(PLATE_REGEX)
          : [null, null, null];
        await db.run(
          `INSERT INTO tweets (tweet_id, created_at, content, state, number, amount, user, summoning_text, zero_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id_str,
            new Date(created_at).toISOString(),
            text,
            state,
            number,
            0,
            summoningTweet && summoningTweet.user.screen_name,
            summoningTweet && summoningTweet.full_text,
            zeroReason
          ]
        );
        console.log(`ADDED ${state}:${number} 0`);
      }
    }
    if (ownTweets.length <= 1)
      // bc of how max_id works, that tweet itself is always returned
      return;
  }
});
module.exports.archive.use(
  ssm({
    cache: true,
    names: {
      CONSUMER_KEY: '/howsmydriving/consumer_key',
      CONSUMER_SECRET: '/howsmydriving/consumer_secret',
      ACCESS_TOKEN: '/howsmydriving/access_token',
      ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret'
    }
  })
);
