const puppeteer = require('puppeteer');

exports.getBrowser = () =>
  puppeteer.launch({
    headless: true,
    executablePath: process.env.IS_LOCAL ? undefined : '/opt/headless_shell',
    args: ['--no-sandbox', '--disable-gpu', '--single-process']
  });
