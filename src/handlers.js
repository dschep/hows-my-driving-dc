const middy = require('middy');
const {ssm} = require('middy/middlewares');

const {get_challenge_response} = require('./crc.js');

module.exports.crc = middy(async (event) => {
  console.log(event);
  const responseToken = get_challenge_response(
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
