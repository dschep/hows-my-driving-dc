const AWS = require('aws-sdk');

const defaultHighScore = 16198; // https://twitter.com/HowsMyDrivingDC/status/1091565303333572609

module.exports = async function(newScore) {
  const simpledb = new AWS.SimpleDB({ });

  // Create domain if it doesn't exist yet
  const { DomainNames } = await simpledb.listDomains().promise();
  if (!(DomainNames || []).includes('howsmydrivingdc')) {
    await simpledb.createDomains({DomainName:'howsmydrivingdc'}).promise();
  }

  // get current highscore
  let highScore = defaultHighScore;
  try {
    const { Attributes: [ { Value } ] } = await simpledb.getAttributes({
      AttributeNames: ['high-score'],
      DomainName: 'howsmydrivingdc',
      'ItemName': 'high-score'
    }).promise()
    highScore = Value ? parseInt(Value) : defaultHighScore;
  } catch (err) {
    console.error('error fetching high score, usign default', err)
  }

  // save new high score if greater
  if (newScore > highScore) {
    await simpledb.putAttributes({
      Attributes:[ {Name:'high-score', Value: newScore.toString(), Replace: true} ],
      DomainName: 'howsmydrivingdc',
      ItemName: 'high-score'
    }).promise()
  }

  return highScore;
};
