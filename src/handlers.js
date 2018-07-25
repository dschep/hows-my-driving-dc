const {readFileSync} = require('fs');

const middy = require('middy');
const {ssm, jsonBodyParser} = require('middy/middlewares');
const Twitter = require('twitter');

const setup = require('./puppeteer/setup');
const lookupPlate = require('./lookupPlate.js');
const crc = require('./crc.js');

module.exports.test = middy(async (event, context) => {
  // For keeping the browser launch
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  });
  console.log(event);
  return lookupPlate(browser, client, event.state, event.number);
});
module.exports.test.use(ssm({
  names: {
    CONSUMER_KEY: '/howsmydriving/consumer_key',
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
    ACCESS_TOKEN: '/howsmydriving/access_token',
    ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret',
  },
}));


module.exports.crc = middy(async (event) => {
  console.log(event);
  if (!event.queryStringParameters || !event.queryStringParameters.crc_token) {
    return {statusCode: 400};
  }
  const responseToken = crc(
    event.queryStringParameters.crc_token, process.env.CONSUMER_SECRET);
  return {
    body: JSON.stringify({response_token: `sha256=${responseToken}`}),
  };
});

module.exports.crc.use(ssm({
  cache: true,
  names: {
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
  },
}));

module.exports.register = middy(async (event) => {
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  });
  // eslint-disable-next-line no-undef
  return new Promise((resolve, reject) => client.post(
    `/account_activity/all/dev/webhooks.json?url=${encodeURIComponent(event.webhook)}`,
    (error, data) => {
      if (error) {
        reject(JSON.stringify(error));
      } else {
        resolve(data);
      }
    }
  ));
});
module.exports.register.use(ssm({
  names: {
    CONSUMER_KEY: '/howsmydriving/consumer_key',
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
    ACCESS_TOKEN: '/howsmydriving/access_token',
    ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret',
  },
}));

module.exports.subscribe = middy(async (/*event*/) => {
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  });
  // eslint-disable-next-line no-undef
  return new Promise((resolve, reject) => client.post(
    `/account_activity/all/dev/subscriptions.json`,
    (error, data) => {
      if (error) {
        reject(JSON.stringify(error));
      } else {
        resolve(data);
      }
    }
  ));
});
module.exports.subscribe.use(ssm({
  names: {
    CONSUMER_KEY: '/howsmydriving/consumer_key',
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
    ACCESS_TOKEN: '/howsmydriving/access_token',
    ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret',
  },
}));

module.exports.webhook = middy(async (event, context) => {
  console.log(event);
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
  const client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  });
  if (!event.body.tweet_create_events) {
    return;
  }
  const [, state, number] = event.body.tweet_create_events[0].text.match(/\b([a-zA-Z]{2}):([a-zA-Z0-9]+)\b/);
  const ticketsOrError = await lookupPlate(browser, state.toUpperCase(), number);
  console.log('lets tweet!');
  const status = {
    in_reply_to_status_id: event.body.tweet_create_events[0].id_str,
    status: `@${event.body.tweet_create_events[0].user.screen_name} `,
  };
  if (ticketsOrError.startsWith('/')) {
    const data = readFileSync('/tmp/tickets.png');
    console.log('loaded image');
    status.status += `${state} ${number} has outstanding tickets:`;
    // eslint-disable-next-line no-undef
    status.media_ids = await new Promise((resolve, reject) => client.post(
      'media/upload',
      {media: data},
      (error, media) => {
        if (!error) {
          // If successful, a media object will be returned.
          console.log(media);
          resolve(media.media_id_string);
        } else {
          console.log('problem uploading', error);
          reject(error);
        }
      }));
  } else {
    status.status += ticketsOrError;
  }
  // eslint-disable-next-line no-undef
  return new Promise((resolve, reject) => client.post(
    'statuses/update',
    status,
    (error, tweet) => {
      if (!error) {
        console.log(tweet);
        resolve();
      } else {
        console.log('problem tweeting', error);
        reject(error);
      }
    }));
});
module.exports.webhook.use(ssm({
  cache: true,
  names: {
    CONSUMER_KEY: '/howsmydriving/consumer_key',
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
    ACCESS_TOKEN: '/howsmydriving/access_token',
    ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret',
  },
}));
module.exports.webhook.use(jsonBodyParser())
