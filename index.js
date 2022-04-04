require('dotenv').config()
const {Client} = require('pg')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const puppeteer = require('puppeteer')
const userAgent = require('user-agents')
const cheerio = require('cheerio')


const app = express()
const PORT = process.env.PORT || 5001

app.use(cors())
app.use(bodyParser())

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})
client.connect()

const LAUNCH_PUPPETEER_OPTS = {
    args: [
        '--headless: true',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
    ]
};

const PAGE_PUPPETEER_OPTS = {
    networkIdle2Timeout: 5000,
    waitUntil: 'networkidle2',
    timeout: 3000000
};

async function fetchSongUrl(url) {
    const browser = await puppeteer.launch(LAUNCH_PUPPETEER_OPTS)
    const page = await browser.newPage()
    await page.setUserAgent(userAgent.toString())
    await page.goto(url, PAGE_PUPPETEER_OPTS)
    const content = await page.content()
    const $ = cheerio.load(content)
    const data = {
        title: $('h2.songname').text(),
        cdn: $('audio').attr().src,
        img: $('div.cover-img')[1].attribs.style.split("'", 2)[1]
    }
    await browser.close()
    return data
}

app.get('/api/collection', async (req, res) => {
    console.log('start get req')
    try {
        const data = await client.query('select * from music')
        res.status(200).send(data.rows)
        console.log('get success')
    } catch (err) {
        res.status(404).send(err.stack)
        console.log('get error')
    }
})

app.post('/api/download', async (req, res) => {
    console.log('start post req')
    const data = await fetchSongUrl(req.body.url)
    console.log('incoming data:', data)
    try {
        const text = 'INSERT INTO music (title, cdn, img) VALUES($1, $2, $3)'
        const values = [data.title, data.cdn, data.img]
        await client.query(text, values)
        res.status(200).send(data)
        console.log('post success')
    } catch (err) {
        res.status(404).send(err.stack)
        console.log('post error:', err.stack)
    }
})

app.listen(PORT, () => {
    console.log(`Express app listening on port ${PORT}`)
})
