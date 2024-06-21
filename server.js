const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // Serve static files from the "public" directory

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
        console.error('Invalid URL format:', e);
        return res.status(400).send('Invalid URL format');
    }

    try {
        const browser = await puppeteer.launch({ headless: true });
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

        if (!jsonLdData || !jsonLdData['@graph']) {
            console.error('No JSON-LD data found or @graph property missing.');
            return res.status(500).send('Error extracting JSON-LD data');
        }

        // Find Person data in JSON-LD
        const profileData = jsonLdData['@graph'].find(item => item['@type'] === 'Person');

        if (!profileData) {
            console.error('No Person data found in JSON-LD.');
            return res.status(500).send('Error extracting profile data');
        }

        // Arrange data
        const arrangedData = {
            name: profileData.name || '',
            jobTitle: Array.isArray(profileData.jobTitle) ? profileData.jobTitle.join(', ') : '',
            address: profileData.address ? `${profileData.address.addressLocality}, ${profileData.address.addressCountry}` : '',
            image: profileData.image ? profileData.image.contentUrl : '',
            worksFor: Array.isArray(profileData.worksFor) ? profileData.worksFor.map(org => org.name).join(', ') : '',
            education: Array.isArray(profileData.alumniOf) ? profileData.alumniOf.map(edu => ({
                name: edu.name || '',
                location: edu.location || '',
                description: edu.member?.description || '',
                startDate: edu.member?.startDate || '',
                endDate: edu.member?.endDate || ''
            })) : [],
            languages: Array.isArray(profileData.knowsLanguage) ? profileData.knowsLanguage.map(lang => lang.name).join(', ') : '',
            description: profileData.description || '',
            profileUrl: profileData.url || '',
            experiences: Array.isArray(profileData.alumniOf) ? profileData.alumniOf.map(exp => ({
                name: exp.name || '',
                location: exp.location || '',
                description: exp.member?.description || '',
                startDate: exp.member?.startDate || '',
                endDate: exp.member?.endDate || ''
            })) : [],
            worksForDetails: Array.isArray(profileData.worksFor) ? profileData.worksFor.map(org => ({
                name: org.name || '',
                location: org.location || '',
                description: org.member?.description || '',
                startDate: org.member?.startDate || '',
                endDate: org.member?.endDate || ''
            })) : []
        };

        res.json(arrangedData);
    } catch (error) {
        console.error('Error fetching or processing profile data:', error);
        res.status(500).send('Error fetching or processing profile data');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
