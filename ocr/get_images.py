#!/usr/bin/env python

import os
import shutil
import sqlite3
import time

import boto3
import requests
from twitter import Api as TwitterApi
from twitter.error import TwitterError


ssm = boto3.client('ssm')

twitter_params = {
    param['Name'].rsplit('/', 1)[-1]: param['Value']
    for param in ssm.get_parameters(
        Names=['/howsmydrivinganalytics/consumer_key',
               '/howsmydrivinganalytics/consumer_secret',
               '/howsmydrivinganalytics/access_token_key',
               '/howsmydrivinganalytics/access_token_secret'],
        WithDecryption=True)['Parameters']
}

twitter = TwitterApi(**twitter_params)

con = sqlite3.connect('../archive.db')
cur = con.cursor()

for tweet_id, text in cur.execute('select tweet_id, content from tweets'):
    if os.path.exists('archive_images/{}.jpg'.format(tweet_id)):
        print('skipping {}'.format(tweet_id))
        continue
    if os.path.exists('archive_images/{}.jpg'.format(tweet_id)):
        print('getting details {}'.format(tweet_id))
        continue
    if 'balance of $0.00' in text or 'not found' in text:
        print('skipping(notix) {}'.format(text))
        continue
    tweet = twitter.GetStatus(tweet_id, include_entities=True)
    time.sleep(.5)
    if tweet.media:
        if os.path.exists('archive_images/{}.jpg'.format(tweet_id)):
            print('downloading {}'.format(tweet_id))
            continue
        resp = requests.get(tweet.media[0].media_url, stream=True)
        if resp.status_code == 200:
            with open('archive_images/{}.jpg'.format(tweet_id), 'wb') as file_obj:
                resp.raw.decode_content = True
                shutil.copyfileobj(resp.raw, file_obj)
    else:
        print('skipping(nomedia) {}'.format(tweet_id))

con.close()
