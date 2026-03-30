import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function scrapeSubject(subject, year) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const url = `https://myschool.ng/past-questions?exam=UTME&subject=${subject}&year=${year}`;
    console.log(`Navigating to ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2' });
    const html = await page.content();

    if (html.includes('Sorry, page not found')) {
        console.log('Blocked or 404.');
        await browser.close();
        return;
    }

    const $ = cheerio.load(html);

    console.log('Page Title:', $('title').text());

    const questions = [];

    $('.media').each((i, el) => {
        // Very basic extraction strategy, to be refined based on actual HTML
        const qText = $(el).find('div.question-desc').text().trim() || $(el).find('p').first().text().trim();
        console.log(`Q${i + 1}: ${qText.substring(0, 50)}...`);
    });

    await browser.close();
}

scrapeSubject('Mathematics', 2022).catch(console.error);
