const middy = require('middy');
const {ssm} = require('middy/middlewares');
const Twitter = require('twitter');

const setup = require('./puppeteer/setup');
const lookupPlate = require('./lookupPlate.js');
const crc = require('./crc.js');

module.exports.test = middy(async (event, context) => {
  // For keeping the browser launch
  context.callbackWaitsForEmptyEventLoop = false;
  const browser = await setup.getBrowser();
  console.log({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
  });
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
  cache: true,
  names: {
    CONSUMER_KEY: '/howsmydriving/consumer_key',
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
    ACCESS_TOKEN: '/howsmydriving/access_token',
    ACCESS_TOKEN_SECRET: '/howsmydriving/access_token_secret',
  },
}));


module.exports.crc = middy(async (event) => {
  console.log(event);
  const responseToken = crc(
    event.queryStringParameters.crc_token, process.env.CONSUMER_SECRET);
  return {
    response_token: `sha256=${responseToken}`,
  };
});

module.exports.crc.use(ssm({
  cache: true,
  names: {
    CONSUMER_SECRET: '/howsmydriving/consumer_secret',
  },
}));
