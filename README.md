# Hows My Driving DC Twitter Bot

Uses pupeteer(for interacting with the DMV form) and tesseract.js(for solving the captcha) on lambda.
Uses this form: https://prodpci.etimspayments.com/pbw/include/dc_parking/input.jsp

## Deploy
```
npm i -g serverless
npm i
sls deploy
```

Currently a proof of concept, waiting for twitter account activity webhook access.

Bootstraped from https://github.com/sambaiz/puppeteer-lambda-starter-kit

## Archiver
There's a script for archiving the bot's history to a sqlite db. run it like this:
```
sls invoke local  -f archive
```
I've even checked in the sqlite db for other to peruse:
https://github.com/dschep/hows-my-driving-dc/blob/master/archive.db

## Screenshot
![](./screenshot.png)


## Backstory?
Curious how @howsmydrivingdc came to be? [Here's a short story in the form of twitter screenshots](https://github.com/dschep/hows-my-driving-dc/issues/4#issuecomment-407921395).
