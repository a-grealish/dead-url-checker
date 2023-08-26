const fs = require('fs');
const https = require('https');
const extractUrls = require('extract-urls');
const core = require('@actions/core');

const blacklisted = core.getInput('blacklist').split(',');
const files = core.getInput('files').split(',');
const repo = process.env.GITHUB_REPOSITORY;
let exitStatus = 0;

function removeDuplicates(urls) {
    return [...new Set(urls)];
}

async function getTestFromFile(file) {
    try {
        const text = fs.readFileSync(`./${file}`, 'utf-8');
        console.log('Found file in the locally checked out repo');
        return text;
    } catch (error) {
        console.log('Could not find file checked out locally, falling back to using public link');
    }

    try {
        const filepath = `https://raw.githubusercontent.com/${repo}/master/${file}`;
        const response = await fetchURL(filepath);
        return response;
    } catch (error) {
        console.log('Could not find file using fallback public link');
    }
}

async function fetchURL(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(data);
            });
            response.on('error', (error) => {
                reject(error);
            });
        });
    });
}

(async () => {
    for (const file of files) {
        const text = await getTestFromFile(file);

        const fileLinks = extractUrls(text);

        const links = fileLinks.filter(url => !url.includes('mailto://'));
        const linksToRequest = [];

        for (const link of links) {
            if (blacklisted.includes(link)) {
                console.log(`Removed ${link}`);
            } else {
                linksToRequest.push(link);
            }
        }

        console.log(`Checking URLs from ${file}`);

        const uniqueLinksToRequest = removeDuplicates(linksToRequest);

        console.log(`Removing duplicate URLs from ${file}`);

        for (const url of uniqueLinksToRequest) {
            try {
                const response = await fetchURL(url);
                if (response.startsWith('200 ')) {
                    console.log(`✓ ${response} ${url}`);
                } else if (parseInt(response) >= 400) {
                    console.log(`✕ ${response} ${url}`);
                    exitStatus = 1;
                } else {
                    console.log(`⚪ ${response} ${url}`);
                }
            } catch (error) {
                console.log(`✕ ERR ${url}`);
                exitStatus = 1;
            }
        }

        console.log();
    }

    process.exit(exitStatus);
})();