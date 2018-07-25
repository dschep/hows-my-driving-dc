// cribbed from https://github.com/twitterdev/account-activity-dashboard/blob/master/helpers/security.js
const crypto = require('crypto');

/**
 * Creates a HMAC SHA-256 hash created from the app TOKEN and
 * your app Consumer Secret.
 * @param {String} crcToken  the token provided by the incoming GET request
 * @param  {String} consumerSecret  the API consumer secret
 * @return {String}
 */
module.exports = (crcToken, consumerSecret) =>
  crypto
    .createHmac('sha256', consumerSecret)
    .update(crcToken)
    .digest('base64');
