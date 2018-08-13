const { readFileSync } = require('fs');

const middy = require('middy');
const { ssm, jsonBodyParser } = require('middy/middlewares');
const Twitter = require('twitter');

const setup = require('./puppeteer/setup');
const lookupPlate = require('./lookupPlate.js');
const crc = require('./crc.js');
const getHighscore = require('./getHighscore.js');

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
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
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
    [, state, number] = text.match(/\b([a-zA-Z]{2}):([a-zA-Z0-9]+)\b/);
  } catch (e) {
    console.log(e);
    return;
  }
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
    const { media_id_string } = await client.post('media/upload', {
      media: data
    });
    status.media_ids = media_id_string;
  } else if (result.error) {
    status.status += result.error;
  }
  const { id_str } = await client.post('statuses/update', status);
  const highScore = await getHighscore();
  if (!result.error && result.total > highScore) {
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
