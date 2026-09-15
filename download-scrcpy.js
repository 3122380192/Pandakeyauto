const https = require('https');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const url = "https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-win64-v3.1.zip";
const zipPath = path.join(__dirname, "scrcpy.zip");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (currentUrl) => {
      https.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download: status ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

async function run() {
  console.log("Starting download scrcpy-win64-v3.1.zip...");
  await download(url, zipPath);
  console.log("Download completed! Extracting...");
  
  execSync(`tar -xf scrcpy.zip`);
  console.log("Extracted. Moving files to bin...");

  const extractedFolder = path.join(__dirname, "scrcpy-win64-v3.1");
  const binFolder = path.join(__dirname, "bin");
  if (!fs.existsSync(binFolder)) {
    fs.mkdirSync(binFolder);
  }

  const files = fs.readdirSync(extractedFolder);
  for (const f of files) {
    const src = path.join(extractedFolder, f);
    const dst = path.join(binFolder, f);
    fs.copyFileSync(src, dst);
  }

  // cleanup
  fs.rmSync(extractedFolder, { recursive: true, force: true });
  fs.unlinkSync(zipPath);
  console.log("Setup bin/ scrcpy successfully!");
}

run().catch(err => {
  console.error("Error setting up scrcpy:", err);
  process.exit(1);
});
