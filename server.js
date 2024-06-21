const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/search', async (req, res) => {
    const { linkedinUrl } = req.query;

    if (!linkedinUrl) {
        return res.status(400).send('Missing linkedinUrl parameter');
    }

    // Validate the URL
    let url;
    try {
        url = new URL(linkedinUrl);
    } catch (e) {
        return res.status(400).send('Invalid URL format');
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set user agent to a mobile device
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1');
        
        // Set viewport to mimic a mobile device
        await page.setViewport({ width: 375, height: 667 });

        console.log(`Navigating to URL: ${url.href}`); // Log the URL

        await page.goto(url.href, { waitUntil: 'networkidle2' });

        // Extract JSON-LD content
        const jsonLdData = await page.evaluate(() => {
            const jsonLdElement = document.querySelector('script[type="application/ld+json"]');
            return jsonLdElement ? JSON.parse(jsonLdElement.textContent) : null;
        });

        await browser.close();

        if (!jsonLdData) {
            return res.status(500).send('Error extracting JSON-LD data');
        }

        // Arrange the data in a readable format
        const profileData = jsonLdData['@graph'].find(item => item['@type'] === 'Person');

        const arrangedData = {
            name: profileData.name || '',
            jobTitle: profileData.jobTitle ? profileData.jobTitle.join(', ') : '',
            address: profileData.address ? `${profileData.address.addressLocality}, ${profileData.address.addressCountry}` : '',
            image: profileData.image ? profileData.image.contentUrl : '',
            worksFor: profileData.worksFor ? profileData.worksFor.map(org => org.name).join(', ') : '',
            education: profileData.alumniOf ? profileData.alumniOf.map(org => ({
                name: org.name,
                location: org.location,
                description: org.member?.description || '',
                startDate: org.member?.startDate || '',
                endDate: org.member?.endDate || ''
            })) : [],
            languages: profileData.knowsLanguage ? profileData.knowsLanguage.map(lang => lang.name).join(', ') : '',
            description: profileData.description || '',
            profileUrl: profileData.url || '',
            experiences: profileData.alumniOf ? profileData.alumniOf.map(org => ({
                name: org.name,
                location: org.location,
                description: org.member?.description || '',
                startDate: org.member?.startDate || '',
                endDate: org.member?.endDate || ''
            })) : [],
            worksForDetails: profileData.worksFor ? profileData.worksFor.map(org => ({
                name: org.name,
                location: org.location,
                description: org.member?.description || '',
                startDate: org.member?.startDate || '',
                endDate: org.member?.endDate || ''
            })) : []
        };

        res.json(arrangedData);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).send('Error fetching profile data');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
